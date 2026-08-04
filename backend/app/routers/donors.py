from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import Session, get_current_user
from app.models.domain import Donor, DonationMe, DonorMe, UpdateDonorProfileRequest
from app.services.store import get_store

router = APIRouter(tags=["donors"])


@router.get("/donors/me", response_model=DonorMe)
def get_my_donor(session: Session = Depends(get_current_user)) -> DonorMe:
    """Must be registered before /donors/{donor_id} — route order matters,
    otherwise "me" would be captured as a donor_id path param. Returns
    DonorMe (not the public Donor model) so the generated local-dev
    username can be attached without ever exposing it on the public
    route below — see
    specs/features/015-local-dev-generated-credentials/design.md."""
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
    local_username = get_store().get_donor_local_username(donor_id)
    receipts = get_store().list_donor_donation_receipts(donor_id)
    donations_me = [
        DonationMe(**d.model_dump(), receipt_url=receipts.get(d.id))
        for d in (donor.donations or [])
    ]
    return DonorMe(
        **donor.model_dump(exclude={"donations"}),
        donations=donations_me,
        local_username=local_username,
    )


@router.patch("/donors/me", response_model=Donor)
def update_my_donor(
    payload: UpdateDonorProfileRequest,
    session: Session = Depends(get_current_user),
) -> Donor:
    """See specs/features/018-profile-edit/design.md — lets a signed-in
    donor edit their own location/country/story. Same resolve-or-404 shape
    as GET /donors/me."""
    user_id, user = session
    donor_id = get_store().resolve_donor_id(user_id, user.email)
    if donor_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not linked to an approved donor yet",
        )
    return get_store().update_donor_profile(
        donor_id, payload.location, payload.country, payload.story
    )


@router.get("/donors/{donor_id}", response_model=Donor)
def get_donor(donor_id: str) -> Donor:
    donor = get_store().get_donor(donor_id)
    if donor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Donor not found"
        )
    return donor
