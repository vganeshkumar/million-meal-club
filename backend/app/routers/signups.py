from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import Session, get_current_user_optional
from app.models.domain import SignupRequest, SignupResponse
from app.services.store import get_store

router = APIRouter(tags=["signups"])


@router.post("/signups", response_model=SignupResponse)
def create_signup(
    body: SignupRequest,
    session: Session | None = Depends(get_current_user_optional),
) -> SignupResponse:
    user_id = session[0] if session else None
    user = session[1] if session else None

    # Required for both modes — from the session if signed in, otherwise
    # the form must supply them. Fixes a bug where a signed-in applicant's
    # name was never resolved (the frontend omits it client-side, expecting
    # the backend to fill it in from the session). See
    # specs/features/002-join-in-signup/design.md.
    name = user.name if user else body.name
    email = user.email if user else body.email
    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="name is required",
        )
    if not email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="email is required",
        )

    signup_id = get_store().create_signup(body, user_id, name, email)
    return SignupResponse(signup_id=signup_id)
