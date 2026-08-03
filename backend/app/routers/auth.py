import os

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.deps import Session, get_current_user, is_admin_email
from app.models.domain import (
    AuthUser,
    DummyLoginRequest,
    FacebookAuthRequest,
    GoogleAuthRequest,
)
from app.services.jwt_session import (
    SESSION_COOKIE_NAME,
    SESSION_TTL_SECONDS,
    issue_session_token,
)
from app.services.oauth import (
    OAuthVerificationError,
    verify_facebook_token,
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


@router.post("/google", response_model=AuthUser)
def sign_in_google(body: GoogleAuthRequest, response: Response) -> AuthUser:
    try:
        subject, email, name = verify_google_token(body.id_token)
    except OAuthVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e)
        ) from e
    user_id, name = get_store().get_or_create_user("google", subject, email, name)
    _set_session_cookie(response, issue_session_token(user_id, name, email, "google"))
    return _auth_user_with_roles(user_id, name, email, "google")


@router.post("/facebook", response_model=AuthUser)
def sign_in_facebook(body: FacebookAuthRequest, response: Response) -> AuthUser:
    try:
        subject, email, name = verify_facebook_token(body.access_token)
    except OAuthVerificationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e)
        ) from e
    user_id, name = get_store().get_or_create_user("facebook", subject, email, name)
    _set_session_cookie(response, issue_session_token(user_id, name, email, "facebook"))
    return _auth_user_with_roles(user_id, name, email, "facebook")


@router.post("/dummy", response_model=AuthUser)
def sign_in_dummy(body: DummyLoginRequest, response: Response) -> AuthUser:
    """Local-dev-only login with a role picker — see
    specs/00-constitution.md §4 and
    specs/features/008-persona-dashboards-and-roles/design.md. 404, not
    403, when disabled, so the endpoint isn't distinguishable from
    "doesn't exist" outside local dev."""
    if os.environ.get("ENABLE_DUMMY_LOGIN") != "true":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if body.username != "dummy_user" or body.password != "dummy_password":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    store = get_store()

    if body.role == "admin":
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
    elif body.role == "donor":
        email, name, subject = "dummy-donor@local.test", "Dummy Donor", "dummy-donor"
    else:
        email, name, subject = (
            "dummy-volunteer@local.test",
            "Dummy Volunteer",
            "dummy-volunteer",
        )

    user_id, name = store.get_or_create_user("dummy", subject, email, name)
    if body.role == "donor":
        store.provision_dummy_donor(user_id, email, name)
    elif body.role == "volunteer":
        store.provision_dummy_volunteer(user_id, email, name)

    _set_session_cookie(response, issue_session_token(user_id, name, email, "dummy"))
    return _auth_user_with_roles(user_id, name, email, "dummy")


@router.get("/me", response_model=AuthUser)
def me(session: Session = Depends(get_current_user)) -> AuthUser:
    _, user = session
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
