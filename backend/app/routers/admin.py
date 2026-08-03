from fastapi import APIRouter, Depends, Query, status

from app.deps import Session, require_admin
from app.models.domain import ConfigUpdateRequest, SignupAdminView, SubmissionAdminView
from app.services.email import get_email_sender
from app.services.store import get_store

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/submissions", response_model=list[SubmissionAdminView])
def list_submissions(
    status_filter: str = Query("pending", alias="status"),
    session: Session = Depends(require_admin),
) -> list[dict]:
    return get_store().list_submissions(status_filter)


@router.post(
    "/submissions/{submission_id}/approve", status_code=status.HTTP_204_NO_CONTENT
)
def approve_submission(
    submission_id: str, session: Session = Depends(require_admin)
) -> None:
    get_store().approve_submission(submission_id)


@router.post(
    "/submissions/{submission_id}/reject", status_code=status.HTTP_204_NO_CONTENT
)
def reject_submission(
    submission_id: str, session: Session = Depends(require_admin)
) -> None:
    get_store().reject_submission(submission_id)


@router.get("/signups", response_model=list[SignupAdminView])
def list_signups(
    status_filter: str = Query("requested_signoff", alias="status"),
    session: Session = Depends(require_admin),
) -> list[dict]:
    return get_store().list_signups(status_filter)


@router.post("/signups/{signup_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
def approve_signup(signup_id: str, session: Session = Depends(require_admin)) -> None:
    name, email = get_store().approve_signup(signup_id)
    get_email_sender().send_donor_onboarded(email, name)


@router.post("/signups/{signup_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_signup(signup_id: str, session: Session = Depends(require_admin)) -> None:
    get_store().reject_signup(signup_id)


@router.post("/config", status_code=status.HTTP_204_NO_CONTENT)
def update_config(
    body: ConfigUpdateRequest, session: Session = Depends(require_admin)
) -> None:
    get_store().update_config(**body.model_dump())
