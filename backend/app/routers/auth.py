import os

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.deps import Session, get_current_user, is_admin_email
from app.models.domain import (
    AuthUser,
    DummyLoginRequest,
    GoogleAuthRequest,
)
from app.services.jwt_session import (
    SESSION_COOKIE_NAME,
    SESSION_TTL_SECONDS,
    issue_session_token,
)
from app.services.oauth import (
    OAuthVerificationError,
    verify_google_token,
)
from app.services.store import get_store

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


def _auth_user_with_roles(
    user_id: str, name: str, email: str, provider: str
) -> AuthUser:
    store = get_store()
    return AuthUser(
        name=name,
        email=email,
        provider=provider,
        is_admin=is_admin_email(email),
        is_donor=store.resolve_donor_id(user_id, email) is not None,
        is_volunteer=store.resolve_volunteer_id(user_id, email) is not None,
    )


def _reject_if_membership_disabled(user_id: str, email: str) -> None:
    """Blocks sign-in for a donor/volunteer an admin has disabled — see
    specs/features/016-admin-membership-status/design.md. Called after
    get_or_create_user but before a session cookie is issued, so a
    disabled member's login attempt never gets a session at all. Scope is
    new sign-ins only — an already-open browser session isn't proactively
    revoked."""
    if get_store().is_membership_disabled(user_id, email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been disabled. Contact the founder if you believe this is a mistake.",
        )


@router.post("/google", response_model=AuthUser)
def sign_in_google(body: GoogleAuthRequest, response: Response) -> AuthUser:
    try:
        subject, email, name = verify_google_token(body.id_token)
    except OAuthVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e)
        ) from e
    user_id, name = get_store().get_or_create_user("google", subject, email, name)
    _reject_if_membership_disabled(user_id, email)
    _set_session_cookie(response, issue_session_token(user_id, name, email, "google"))
    return _auth_user_with_roles(user_id, name, email, "google")


@router.post("/dummy", response_model=AuthUser)
def sign_in_dummy(body: DummyLoginRequest, response: Response) -> AuthUser:
    """Local-dev-only login — see specs/00-constitution.md §4 and
    specs/features/015-local-dev-generated-credentials/design.md. 404,
    not 403, when disabled, so the endpoint isn't distinguishable from
    "doesn't exist" outside local dev. `username == "dummy_user"` is
    reserved for the admin shortcut; any other username is looked up as
    a generated Donor/Volunteer local_username (set at approval time)."""
    if os.environ.get("ENABLE_DUMMY_LOGIN") != "true":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if body.password != "dummy_password":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    store = get_store()

    if body.username == "dummy_user":
        admin_emails = [
            e.strip()
            for e in os.environ.get("ADMIN_EMAILS", "").split(",")
            if e.strip()
        ]
        if not admin_emails:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="ADMIN_EMAILS is not configured",
            )
        email, name, subject = admin_emails[0], "Local Admin", "dummy-admin"
    else:
        match = store.resolve_local_login(body.username)
        if match is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
            )
        email, name = match
        subject = f"dummy-local-{body.username}"

    user_id, name = store.get_or_create_user("dummy", subject, email, name)
    if body.username != "dummy_user":
        _reject_if_membership_disabled(user_id, email)
    _set_session_cookie(response, issue_session_token(user_id, name, email, "dummy"))
    return _auth_user_with_roles(user_id, name, email, "dummy")


@router.get("/me", response_model=AuthUser)
def me(session: Session = Depends(get_current_user)) -> AuthUser:
    _, user = session
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
