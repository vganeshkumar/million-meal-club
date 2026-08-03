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


@router.post("/submissions", response_model=SubmissionResponse)
def create_submission(
    body: SubmissionRequest, session: Session = Depends(get_current_user)
) -> SubmissionResponse:
    user_id, user = session
    store = get_store()

    if body.donor_id:
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
        location=body.location,
        meals=body.meals,
        photo_key=body.photo_key,
        receipt_key=body.receipt_key,
        caption=body.caption,
        delivery_role=body.delivery_role,
        partner_charity=body.partner_charity,
    )
    return SubmissionResponse(submission_id=submission_id)
