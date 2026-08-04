from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import Session, get_current_user
from app.models.domain import SubmissionRequest, SubmissionResponse
from app.services.store import get_store

router = APIRouter(tags=["submissions"])

DONOR_NOT_APPROVED_DETAIL = (
    "You need an approved donor application before submitting proof — "
    "see the Join In section."
)
NOT_A_VOLUNTEER_DETAIL = (
    "Only registered volunteers can submit proof on behalf of a donor."
)
EVENT_NOT_FOUND_DETAIL = "Donation event not found."
EVENT_ALREADY_SUBMITTED_DETAIL = (
    "Proof has already been submitted for this donation event."
)
NOT_YOUR_EVENT_DETAIL = (
    "You're not the donor or assigned volunteer for this donation event."
)


@router.post("/submissions", response_model=SubmissionResponse)
def create_submission(
    body: SubmissionRequest, session: Session = Depends(get_current_user)
) -> SubmissionResponse:
    user_id, user = session
    store = get_store()
    location = body.location
    donation_event_id = body.donation_event_id

    if donation_event_id:
        # Submitting against a pre-scheduled donation event — takes
        # precedence over donor_id (stronger, pre-validated authorization).
        # See specs/features/009-scheduled-donation-events/design.md.
        event = store.get_donation_event(donation_event_id)
        if event is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=EVENT_NOT_FOUND_DETAIL
            )
        if event.status in ("submitted", "completed"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=EVENT_ALREADY_SUBMITTED_DETAIL,
            )
        donor_id_of_user = store.resolve_donor_id(user_id, user.email)
        volunteer_id_of_user = store.resolve_volunteer_id(user_id, user.email)
        is_owning_donor = event.donor_id == donor_id_of_user
        is_assigned_volunteer = (
            event.volunteer_id is not None
            and event.volunteer_id == volunteer_id_of_user
        )
        if not (is_owning_donor or is_assigned_volunteer):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=NOT_YOUR_EVENT_DETAIL
            )
        donor_id = event.donor_id
        location = location or event.location
    elif body.donor_id:
        # Submitting on behalf of a donor — the submitter must be a linked
        # volunteer, not necessarily a donor themselves. See
        # specs/features/008-persona-dashboards-and-roles/design.md.
        if store.resolve_volunteer_id(user_id, user.email) is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=NOT_A_VOLUNTEER_DETAIL
            )
        donor_id = body.donor_id
    else:
        donor_id = store.resolve_donor_id(user_id, user.email)
        if donor_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=DONOR_NOT_APPROVED_DETAIL,
            )

    submission_id = store.create_submission(
        donor_id=donor_id,
        submitted_by_user_id=user_id,
        location=location,
        meals=body.meals,
        photo_key=body.photo_key,
        receipt_key=body.receipt_key,
        caption=body.caption,
        delivery_role=body.delivery_role,
        partner_charity=body.partner_charity,
        donation_event_id=donation_event_id,
    )
    return SubmissionResponse(submission_id=submission_id)
