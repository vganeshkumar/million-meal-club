from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import Session, get_current_user
from app.models.domain import (
    AssignVolunteerRequest,
    CreateDonationEventRequest,
    DonationEvent,
)
from app.services.store import get_store

router = APIRouter(prefix="/donation-events", tags=["donation-events"])

NOT_A_DONOR_DETAIL = "Only donors can schedule a donation event."
NOT_A_VOLUNTEER_DETAIL = "Only volunteers have assigned donation events."
EVENT_NOT_FOUND_DETAIL = "Donation event not found."
NOT_YOUR_EVENT_DETAIL = "You don't own this donation event."
ALREADY_SUBMITTED_DETAIL = (
    "Can't reassign — proof has already been submitted for this donation event."
)


def _resolve_donor_or_403(user_id: str, email: str) -> str:
    donor_id = get_store().resolve_donor_id(user_id, email)
    if donor_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=NOT_A_DONOR_DETAIL
        )
    return donor_id


@router.post("", response_model=DonationEvent)
def create_donation_event(
    body: CreateDonationEventRequest, session: Session = Depends(get_current_user)
) -> DonationEvent:
    user_id, user = session
    store = get_store()
    donor_id = _resolve_donor_or_403(user_id, user.email)
    donor = store.get_donor(donor_id)
    if donor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    volunteer_name = None
    if body.volunteer_id:
        volunteer = store.get_volunteer(body.volunteer_id)
        if volunteer is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Volunteer not found"
            )
        volunteer_name = volunteer.name

    return store.create_donation_event(
        donor_id=donor_id,
        donor_name=donor.name,
        location=body.location,
        date=body.date,
        volunteer_id=body.volunteer_id,
        volunteer_name=volunteer_name,
    )


@router.get("/mine", response_model=list[DonationEvent])
def list_my_donation_events(
    session: Session = Depends(get_current_user),
) -> list[DonationEvent]:
    user_id, user = session
    donor_id = _resolve_donor_or_403(user_id, user.email)
    return get_store().list_donation_events_for_donor(donor_id)


@router.get("/volunteer-assigned", response_model=list[DonationEvent])
def list_volunteer_assigned_events(
    session: Session = Depends(get_current_user),
) -> list[DonationEvent]:
    user_id, user = session
    volunteer_id = get_store().resolve_volunteer_id(user_id, user.email)
    if volunteer_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=NOT_A_VOLUNTEER_DETAIL
        )
    return get_store().list_donation_events_for_volunteer(volunteer_id)


@router.patch("/{event_id}/volunteer", response_model=DonationEvent)
def assign_volunteer(
    event_id: str,
    body: AssignVolunteerRequest,
    session: Session = Depends(get_current_user),
) -> DonationEvent:
    user_id, user = session
    store = get_store()
    donor_id = _resolve_donor_or_403(user_id, user.email)

    event = store.get_donation_event(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=EVENT_NOT_FOUND_DETAIL
        )
    if event.donor_id != donor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=NOT_YOUR_EVENT_DETAIL
        )

    volunteer_name = None
    if body.volunteer_id:
        volunteer = store.get_volunteer(body.volunteer_id)
        if volunteer is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Volunteer not found"
            )
        volunteer_name = volunteer.name

    try:
        return store.assign_donation_event_volunteer(
            event_id, body.volunteer_id, volunteer_name
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=ALREADY_SUBMITTED_DETAIL
        )
