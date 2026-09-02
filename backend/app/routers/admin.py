from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import Session, require_admin
from app.models.domain import (
    ConfigUpdateRequest,
    CreatePartnerCharityRequest,
    DonationEvent,
    DonorAdminView,
    PartnerCharityAdminView,
    SignupAdminView,
    SubmissionAdminView,
    UpdatePartnerCharityRequest,
    VolunteerAdminView,
)
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
    name, email, mode = get_store().approve_signup(signup_id)
    if mode == "donor":
        get_email_sender().send_donor_onboarded(email, name)
    else:
        get_email_sender().send_volunteer_onboarded(email, name)


@router.post("/signups/{signup_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_signup(signup_id: str, session: Session = Depends(require_admin)) -> None:
    get_store().reject_signup(signup_id)


@router.post("/config", status_code=status.HTTP_204_NO_CONTENT)
def update_config(
    body: ConfigUpdateRequest, session: Session = Depends(require_admin)
) -> None:
    get_store().update_config(**body.model_dump())


@router.get("/donors", response_model=list[DonorAdminView])
def list_all_donors(session: Session = Depends(require_admin)) -> list[DonorAdminView]:
    return get_store().list_all_donors()


@router.post("/donors/{donor_id}/disable", status_code=status.HTTP_204_NO_CONTENT)
def disable_donor(donor_id: str, session: Session = Depends(require_admin)) -> None:
    get_store().set_donor_status(donor_id, "disabled")


@router.post("/donors/{donor_id}/reactivate", status_code=status.HTTP_204_NO_CONTENT)
def reactivate_donor(donor_id: str, session: Session = Depends(require_admin)) -> None:
    get_store().set_donor_status(donor_id, "active")


@router.get("/volunteers", response_model=list[VolunteerAdminView])
def list_all_volunteers(
    session: Session = Depends(require_admin),
) -> list[VolunteerAdminView]:
    return get_store().list_all_volunteers()


@router.post("/volunteers/{volunteer_id}/disable", status_code=status.HTTP_204_NO_CONTENT)
def disable_volunteer(
    volunteer_id: str, session: Session = Depends(require_admin)
) -> None:
    get_store().set_volunteer_status(volunteer_id, "disabled")


@router.post(
    "/volunteers/{volunteer_id}/reactivate", status_code=status.HTTP_204_NO_CONTENT
)
def reactivate_volunteer(
    volunteer_id: str, session: Session = Depends(require_admin)
) -> None:
    get_store().set_volunteer_status(volunteer_id, "active")


@router.get("/charities", response_model=list[PartnerCharityAdminView])
def list_all_partner_charities(
    session: Session = Depends(require_admin),
) -> list[PartnerCharityAdminView]:
    """Every partner charity, any status — unlike GET /api/content, which
    only returns active ones. See
    specs/features/027-charity-partner-edit-and-deactivate/design.md."""
    return get_store().list_all_partner_charities()


@router.post(
    "/charities",
    response_model=PartnerCharityAdminView,
    status_code=status.HTTP_201_CREATED,
)
def create_partner_charity(
    body: CreatePartnerCharityRequest, session: Session = Depends(require_admin)
) -> PartnerCharityAdminView:
    return get_store().create_partner_charity(**body.model_dump())


@router.patch("/charities/{charity_id}", response_model=PartnerCharityAdminView)
def update_partner_charity(
    charity_id: str,
    body: UpdatePartnerCharityRequest,
    session: Session = Depends(require_admin),
) -> PartnerCharityAdminView:
    try:
        return get_store().update_partner_charity(charity_id, **body.model_dump())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Partner charity not found."
        )


@router.post("/charities/{charity_id}/disable", status_code=status.HTTP_204_NO_CONTENT)
def disable_partner_charity(
    charity_id: str, session: Session = Depends(require_admin)
) -> None:
    try:
        get_store().set_partner_charity_status(charity_id, "disabled")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Partner charity not found."
        )


@router.post(
    "/charities/{charity_id}/reactivate", status_code=status.HTTP_204_NO_CONTENT
)
def reactivate_partner_charity(
    charity_id: str, session: Session = Depends(require_admin)
) -> None:
    try:
        get_store().set_partner_charity_status(charity_id, "active")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Partner charity not found."
        )


@router.get("/donation-events", response_model=list[DonationEvent])
def list_admin_donation_events(
    status_filter: str = Query("scheduled", alias="status"),
    session: Session = Depends(require_admin),
) -> list[DonationEvent]:
    """Every DonationEvent matching `status_filter`, regardless of the
    donor/volunteer's own status — unlike GET /api/content, this is not
    filtered down to active-only members. See
    specs/features/016-admin-membership-status/design.md."""
    return [
        e
        for e in get_store().list_all_donation_events()
        if e.status == status_filter
    ]
