import os

from fastapi import Cookie, Depends, HTTPException, status

from app.models.domain import AuthUser
from app.services.jwt_session import SESSION_COOKIE_NAME, verify_session_token
from app.services.store import get_store

Session = tuple[str, AuthUser]


def is_admin_email(email: str) -> bool:
    admin_emails = {
        e.strip().lower()
        for e in os.environ.get("ADMIN_EMAILS", "").split(",")
        if e.strip()
    }
    return email.lower() in admin_emails


def get_current_user_optional(
    mmc_session: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> Session | None:
    if not mmc_session:
        return None
    payload = verify_session_token(mmc_session)
    if not payload:
        return None
    user_id = payload["user_id"]
    email = payload["email"]
    # Resolving here (not just at /submissions) means the moment a session
    # is checked at all — e.g. GET /api/auth/me — an unclaimed donor/
    # volunteer matching this email gets claimed, so the frontend sees
    # isDonor/isVolunteer flip to true as soon as possible after approval,
    # not just after the user happens to submit something. Idempotent: a
    # request against an already-linked identity is just a lookup. See
    # specs/features/008-persona-dashboards-and-roles/design.md.
    store = get_store()
    return user_id, AuthUser(
        name=payload["name"],
        email=email,
        provider=payload["provider"],
        is_admin=is_admin_email(email),
        is_donor=store.resolve_donor_id(user_id, email) is not None,
        is_volunteer=store.resolve_volunteer_id(user_id, email) is not None,
    )


def get_current_user(
    session: Session | None = Depends(get_current_user_optional),
) -> Session:
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in"
        )
    return session


def require_admin(
    session: Session = Depends(get_current_user),
) -> Session:
    _, user = session
    if not is_admin_email(user.email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )
    return session
