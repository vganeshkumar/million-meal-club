import html
import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse

from app.deps import Session, get_current_user
from app.models.domain import (
    AssignVolunteerRequest,
    CreateDonationEventRequest,
    DonationEvent,
    UpdateDonationEventRequest,
)
from app.services.geocode import geocode
from app.services.instagram import get_instagram_poster
from app.services.store import get_store

router = APIRouter(prefix="/donation-events", tags=["donation-events"])

NOT_A_DONOR_DETAIL = "Only donors can schedule a donation event."
NOT_A_VOLUNTEER_DETAIL = "Only volunteers have assigned donation events."
EVENT_NOT_FOUND_DETAIL = "Donation event not found."
NOT_YOUR_EVENT_DETAIL = "You don't own this donation event."
ALREADY_SUBMITTED_DETAIL = (
    "Can't reassign — proof has already been submitted for this donation event."
)
CANT_CANCEL_DETAIL = (
    "Can't cancel — this donation event has already been submitted or cancelled."
)
CANT_EDIT_DETAIL = (
    "Can't edit — this donation event has already been submitted, completed, "
    "or cancelled."
)
INVALID_TIME_RANGE_DETAIL = "End time must be after start time."

SITE_BASE_URL = os.environ.get("SITE_BASE_URL", "http://localhost:3000")
# Fixed, pre-made asset (frontend/public/instagram-scheduled-event.png) —
# there's no delivery photo yet at scheduling time, and Instagram requires
# an image on every feed post. See
# specs/features/030-instagram-auto-posting/design.md.
SCHEDULED_EVENT_IMAGE_URL = f"{SITE_BASE_URL}/instagram-scheduled-event.png"
# Static map images come from Geoapify's free-tier Static Maps API — no key
# provisioned yet (same situation as OAuth). Empty means "not configured":
# the share page's og:image is simply omitted, same fallback the frontend
# uses for the homepage card. See
# specs/features/023-event-location-time-and-sharing/design.md.
GEOAPIFY_API_KEY = os.environ.get("GEOAPIFY_API_KEY", "")


def _validate_time_range(start_time: str, end_time: str) -> None:
    if end_time <= start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_TIME_RANGE_DETAIL
        )


def _static_map_url(latitude: float, longitude: float) -> str:
    return (
        "https://maps.geoapify.com/v1/staticmap"
        "?style=osm-carto&width=600&height=300"
        f"&center=lonlat:{longitude},{latitude}&zoom=16"
        f"&marker=lonlat:{longitude},{latitude};color:%23d97b29;size:large"
        f"&apiKey={GEOAPIFY_API_KEY}"
    )


def _scheduled_event_caption(event: DonationEvent) -> str:
    return (
        f"📅 New meal delivery scheduled!\n\n"
        f"{event.donor_name} is delivering to {event.location} on "
        f"{event.date}.\n\n"
        "#MillionMealClub #FightHunger #CommunityService"
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
    _validate_time_range(body.start_time, body.end_time)

    volunteer_name = None
    if body.volunteer_id:
        volunteer = store.get_volunteer(body.volunteer_id)
        if volunteer is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Volunteer not found"
            )
        volunteer_name = volunteer.name

    coords = geocode(body.location)

    event = store.create_donation_event(
        donor_id=donor_id,
        donor_name=donor.name,
        location=body.location,
        date=body.date,
        start_time=body.start_time,
        end_time=body.end_time,
        volunteer_id=body.volunteer_id,
        volunteer_name=volunteer_name,
        latitude=coords[0] if coords else None,
        longitude=coords[1] if coords else None,
        packet_count=body.packet_count,
        delivery_role=body.delivery_role,
        partner_charity=body.partner_charity,
        notes=body.notes,
    )

    try:
        get_instagram_poster().post(
            SCHEDULED_EVENT_IMAGE_URL, _scheduled_event_caption(event)
        )
    except Exception as e:
        print(f"[instagram] failed to post scheduled event: {e}")

    return event


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


@router.patch("/{event_id}", response_model=DonationEvent)
def update_donation_event(
    event_id: str,
    body: UpdateDonationEventRequest,
    session: Session = Depends(get_current_user),
) -> DonationEvent:
    """The donor who owns the event, or the volunteer currently assigned
    to it, can edit its detail while it's still `scheduled` — see
    specs/features/022-edit-scheduled-donation-event/design.md."""
    user_id, user = session
    store = get_store()

    event = store.get_donation_event(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=EVENT_NOT_FOUND_DETAIL
        )

    donor_id = store.resolve_donor_id(user_id, user.email)
    volunteer_id = store.resolve_volunteer_id(user_id, user.email)
    is_owner = donor_id is not None and event.donor_id == donor_id
    is_assigned_volunteer = (
        volunteer_id is not None and event.volunteer_id == volunteer_id
    )
    if not (is_owner or is_assigned_volunteer):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=NOT_YOUR_EVENT_DETAIL
        )
    _validate_time_range(body.start_time, body.end_time)

    coords = geocode(body.location)

    try:
        return store.update_donation_event(
            event_id,
            location=body.location,
            date=body.date,
            start_time=body.start_time,
            end_time=body.end_time,
            latitude=coords[0] if coords else None,
            longitude=coords[1] if coords else None,
            packet_count=body.packet_count,
            delivery_role=body.delivery_role,
            partner_charity=body.partner_charity,
            notes=body.notes,
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=CANT_EDIT_DETAIL
        )


@router.post("/{event_id}/cancel", response_model=DonationEvent)
def cancel_donation_event(
    event_id: str, session: Session = Depends(get_current_user)
) -> DonationEvent:
    """A donor can cancel their own scheduled event; an admin can cancel
    any donor's. See specs/features/017-cancel-donation-events/design.md."""
    user_id, user = session
    store = get_store()

    event = store.get_donation_event(event_id)
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=EVENT_NOT_FOUND_DETAIL
        )

    if not user.is_admin:
        donor_id = _resolve_donor_or_403(user_id, user.email)
        if event.donor_id != donor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=NOT_YOUR_EVENT_DETAIL
            )

    try:
        return store.cancel_donation_event(event_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=CANT_CANCEL_DETAIL
        )


def _format_time_range(start_time: str | None, end_time: str | None) -> str | None:
    if not start_time or not end_time:
        return None

    def fmt(t: str) -> str:
        hour, minute = (int(p) for p in t.split(":"))
        period = "AM" if hour < 12 else "PM"
        hour12 = hour % 12 or 12
        return f"{hour12}:{minute:02d} {period}"

    return f"{fmt(start_time)} – {fmt(end_time)}"


@router.get("/{event_id}/share", response_class=HTMLResponse)
def share_donation_event(event_id: str) -> HTMLResponse:
    """Public, unauthenticated share page with Open Graph tags so a link
    to a scheduled donation event unfurls with a rich preview on X,
    Facebook, WhatsApp, etc. Redirects a human visitor back to the site's
    Events section — see
    specs/features/023-event-location-time-and-sharing/design.md."""
    event = get_store().get_donation_event(event_id)
    if event is None or event.status != "scheduled":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=EVENT_NOT_FOUND_DETAIL
        )

    title = html.escape(f"{event.donor_name} is delivering meals on {event.date}")
    time_range = _format_time_range(event.start_time, event.end_time)
    description = f"{time_range} at {event.location}" if time_range else event.location
    if event.notes:
        description = f"{description} — {event.notes}"
    description = html.escape(description)

    image_tag = ""
    if event.latitude is not None and event.longitude is not None and GEOAPIFY_API_KEY:
        image_url = html.escape(_static_map_url(event.latitude, event.longitude))
        image_tag = f'<meta property="og:image" content="{image_url}">'

    redirect_url = html.escape(f"{SITE_BASE_URL}/#events")

    return HTMLResponse(
        f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>{title}</title>
<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:type" content="website">
{image_tag}
<meta http-equiv="refresh" content="0; url={redirect_url}">
</head>
<body>
<p>Redirecting to <a href="{redirect_url}">The Million Meal Club</a>…</p>
</body>
</html>"""
    )
