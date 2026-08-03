from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import Session, get_current_user
from app.models.domain import Donor
from app.services.store import get_store

router = APIRouter(tags=["donors"])


@router.get("/donors/me", response_model=Donor)
def get_my_donor(session: Session = Depends(get_current_user)) -> Donor:
    """Must be registered before /donors/{donor_id} — route order matters,
    otherwise "me" would be captured as a donor_id path param."""
    user_id, user = session
    donor_id = get_store().resolve_donor_id(user_id, user.email)
    if donor_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not linked to an approved donor yet",
        )
    donor = get_store().get_donor(donor_id)
    if donor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return donor


@router.get("/donors/{donor_id}", response_model=Donor)
def get_donor(donor_id: str) -> Donor:
    donor = get_store().get_donor(donor_id)
    if donor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Donor not found"
        )
    return donor
