from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import Session, get_current_user
from app.models.domain import Volunteer
from app.services.store import get_store

router = APIRouter(tags=["volunteers"])

NOT_A_VOLUNTEER_DETAIL = "Register as a volunteer first — see the Join In section."


@router.get("/volunteers/me", response_model=Volunteer)
def get_my_volunteer(session: Session = Depends(get_current_user)) -> Volunteer:
    user_id, user = session
    volunteer_id = get_store().resolve_volunteer_id(user_id, user.email)
    if volunteer_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not registered as a volunteer yet",
        )
    volunteer = get_store().get_volunteer(volunteer_id)
    if volunteer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return volunteer


@router.post("/events/{event_id}/rsvp", status_code=status.HTTP_204_NO_CONTENT)
def rsvp_to_event(event_id: str, session: Session = Depends(get_current_user)) -> None:
    user_id, user = session
    volunteer_id = get_store().resolve_volunteer_id(user_id, user.email)
    if volunteer_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=NOT_A_VOLUNTEER_DETAIL
        )
    get_store().add_event_rsvp(volunteer_id, event_id)


@router.delete("/events/{event_id}/rsvp", status_code=status.HTTP_204_NO_CONTENT)
def cancel_rsvp(event_id: str, session: Session = Depends(get_current_user)) -> None:
    user_id, user = session
    volunteer_id = get_store().resolve_volunteer_id(user_id, user.email)
    if volunteer_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=NOT_A_VOLUNTEER_DETAIL
        )
    get_store().remove_event_rsvp(volunteer_id, event_id)
