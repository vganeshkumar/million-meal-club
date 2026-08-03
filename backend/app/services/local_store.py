"""In-memory data store for local development only (DATA_BACKEND=local, the
default for `uvicorn --reload`). Seeded with a few demo donors/events so the
site is browsable without AWS. Never used when DATA_BACKEND=dynamodb — see
app/services/dynamo_store.py for the real implementation and
specs/01-architecture.md for the table shapes this mirrors."""

import uuid
from datetime import datetime, timezone

from app.models.domain import (
    ContentResponse,
    Donation,
    Donor,
    EventItem,
    GalleryPhoto,
    PartnerCharity,
    SignupRequest,
    SiteConfig,
    Volunteer,
)
from app.services.blob import get_blob_store


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class LocalStore:
    def __init__(self) -> None:
        self._config = {
            "charity_name": "The Million Meal Club",
            "founder_name": "Ganesh Venkataraman",
            "total_meals": 10000,
            "milestone_2027": 100000,
            "goal_2030": 1000000,
            "accent_palette": ("oklch(38% 0.1 155)", "oklch(68% 0.15 55)"),
        }
        self._donors: dict[str, dict] = {}
        self._donations: dict[str, list[dict]] = {}
        self._events: list[dict] = []
        self._partner_charities: list[dict] = []
        self._gallery: list[dict] = []
        self._users: dict[str, dict] = {}
        self._users_by_identity: dict[str, str] = {}
        self._signups: list[dict] = []
        self._submissions: dict[str, dict] = {}
        self._volunteers: dict[str, dict] = {}
        self._event_rsvps: dict[str, set[str]] = {}  # volunteer_id -> {event_id}
        self._seed()

    def _seed(self) -> None:
        d1, d2, d3 = "donor-1", "donor-2", "donor-3"
        self._donors = {
            d1: {
                "id": d1,
                "name": "Priya Sharma",
                "location": "Austin, TX",
                "story": "My grandmother never turned away a hungry neighbor. This is the least I can do to carry that forward.",
            },
            d2: {
                "id": d2,
                "name": "Marcus Webb",
                "location": "Round Rock, TX",
                "story": "I drive for a living and pass the same shelters every week. Figured I might as well bring something.",
            },
            d3: {
                "id": d3,
                "name": "Aiko Tanaka",
                "location": "Cedar Park, TX",
                "story": "Started with one packet on a whim. Now it's part of my Saturday routine.",
            },
        }
        self._donations = {
            d1: [
                {
                    "id": "don-1a",
                    "date": "2026-04-12",
                    "location": "East Austin",
                    "meals": 220,
                    "caption": "Delivered with two volunteers to the community center.",
                    "photo_key": None,
                },
                {
                    "id": "don-1b",
                    "date": "2026-06-01",
                    "location": "East Austin",
                    "meals": 180,
                    "caption": "Second monthly drop-off, same route.",
                    "photo_key": None,
                },
            ],
            d2: [
                {
                    "id": "don-2a",
                    "date": "2026-05-03",
                    "location": "North Austin",
                    "meals": 150,
                    "caption": "Delivered during my regular route stop.",
                    "photo_key": None,
                }
            ],
            d3: [
                {
                    "id": "don-3a",
                    "date": "2026-05-20",
                    "location": "Cedar Park",
                    "meals": 90,
                    "caption": "First delivery — more to come!",
                    "photo_key": None,
                }
            ],
        }
        self._events = [
            {
                "id": "event-1",
                "date": "Aug 16, 2026",
                "time": "10:00 AM",
                "location": "East Austin Community Center",
                "packets_goal": 300,
                "description": "Our monthly packing and delivery drive — all volunteers welcome, no experience needed.",
            },
            {
                "id": "event-2",
                "date": "Sep 6, 2026",
                "time": "9:00 AM",
                "location": "Round Rock Fairgrounds",
                "packets_goal": 250,
                "description": "A joint drive with a local food bank — bring a friend.",
            },
            {
                "id": "event-3",
                "date": "Oct 4, 2026",
                "time": "10:00 AM",
                "location": "Cedar Park Recreation Center",
                "packets_goal": 200,
                "description": "Fall drive ahead of the holiday season — packet donations especially needed.",
            },
        ]
        self._partner_charities = [
            {
                "id": "charity-1",
                "name": "Central Texas Food Bank",
                "location": "Austin, TX",
                "description": "A regional food bank distributing to dozens of partner agencies across Central Texas.",
            },
            {
                "id": "charity-2",
                "name": "Round Rock Serving Center",
                "location": "Round Rock, TX",
                "description": "A local nonprofit running a weekly food pantry and hot-meal program.",
            },
            {
                "id": "charity-3",
                "name": "Cedar Park Community Table",
                "location": "Cedar Park, TX",
                "description": "A volunteer-run community kitchen serving families facing food insecurity.",
            },
        ]
        # FAQ copy is static frontend content (frontend/components/Faq.tsx),
        # not backend/DB-backed — see specs/01-architecture.md and the
        # design's "Data" section, which excludes faqsData from the
        # "replace with a real data source" set (it's already final copy).

    # -- content -----------------------------------------------------
    def get_content(self) -> ContentResponse:
        blob = get_blob_store()
        donors = self._ranked_donors(blob)
        return ContentResponse(
            config=SiteConfig(**self._config),
            donors=[
                Donor(
                    id=d["id"],
                    name=d["name"],
                    location=d["location"],
                    story=d["story"],
                    total_meals=d["total_meals"],
                    donation_count=d["donation_count"],
                )
                for d in donors
            ],
            events=[EventItem(**e) for e in self._events],
            partner_charities=[PartnerCharity(**c) for c in self._partner_charities],
            gallery=[
                GalleryPhoto(
                    id=g["id"], photo_url=blob.public_url(g["photo_key"]), caption=g.get("caption")
                )
                for g in self._gallery
            ],
        )

    def _ranked_donors(self, blob) -> list[dict]:
        out = []
        for d in self._donors.values():
            donations = self._donations.get(d["id"], [])
            total = sum(x["meals"] for x in donations)
            out.append({**d, "total_meals": total, "donation_count": len(donations)})
        out.sort(key=lambda d: d["total_meals"], reverse=True)
        return out

    def get_donor(self, donor_id: str) -> Donor | None:
        d = self._donors.get(donor_id)
        if not d:
            return None
        blob = get_blob_store()
        donations = self._donations.get(donor_id, [])
        total = sum(x["meals"] for x in donations)
        return Donor(
            id=d["id"],
            name=d["name"],
            location=d["location"],
            story=d["story"],
            total_meals=total,
            donation_count=len(donations),
            donations=[
                Donation(
                    id=x["id"],
                    date=x["date"],
                    location=x["location"],
                    meals=x["meals"],
                    caption=x["caption"],
                    photo_url=blob.public_url(x["photo_key"]) if x.get("photo_key") else None,
                )
                for x in sorted(donations, key=lambda x: x["date"], reverse=True)
            ],
        )

    def get_volunteer(self, volunteer_id: str) -> Volunteer | None:
        v = self._volunteers.get(volunteer_id)
        if not v:
            return None
        event_ids = self._event_rsvps.get(volunteer_id, set())
        events = [EventItem(**e) for e in self._events if e["id"] in event_ids]
        return Volunteer(
            id=v["id"],
            name=v["name"],
            location=v.get("location", ""),
            packets_per_trip=v.get("packets_per_trip"),
            availability=v.get("availability"),
            events=events,
        )

    # -- users ---------------------------------------------------------
    def get_or_create_user(
        self, provider: str, subject: str, email: str, name: str
    ) -> tuple[str, str]:
        identity_key = f"{provider}:{subject}"
        user_id = self._users_by_identity.get(identity_key)
        if user_id:
            self._users[user_id]["name"] = name
            self._users[user_id]["email"] = email
            return user_id, name
        user_id = uuid.uuid4().hex
        self._users[user_id] = {
            "provider": provider,
            "subject": subject,
            "email": email,
            "name": name,
            "created_at": _now(),
        }
        self._users_by_identity[identity_key] = user_id
        return user_id, name

    # -- signups ---------------------------------------------------------
    def create_signup(
        self, payload: SignupRequest, user_id: str | None, name: str, email: str
    ) -> str:
        signup_id = uuid.uuid4().hex
        item = {
            "signup_id": signup_id,
            "user_id": user_id,
            "created_at": _now(),
            **payload.model_dump(),
            "name": name,
            "email": email,
        }
        if payload.mode == "donor":
            item["status"] = "requested_signoff"
        else:
            # Volunteers have no approval gate — linkable immediately. See
            # specs/features/008-persona-dashboards-and-roles/design.md.
            volunteer_id = uuid.uuid4().hex
            self._volunteers[volunteer_id] = {
                "id": volunteer_id,
                "name": name,
                "location": payload.location,
                "email": email,
                "packets_per_trip": payload.packets_per_trip,
                "availability": payload.availability,
            }
        self._signups.append(item)
        return signup_id

    def list_signups(self, status: str) -> list[dict]:
        return [s for s in self._signups if s.get("status") == status]

    def approve_signup(self, signup_id: str) -> tuple[str, str]:
        signup = next(
            (s for s in self._signups if s["signup_id"] == signup_id), None
        )
        if not signup or signup.get("status") != "requested_signoff":
            raise ValueError("Signup not found or not pending")
        signup["status"] = "approved"

        name = signup.get("name") or "Anonymous"
        email = signup["email"]
        donor_id = uuid.uuid4().hex
        self._donors[donor_id] = {
            "id": donor_id,
            "name": name,
            "location": signup.get("location", ""),
            "story": signup.get("donor_story", ""),
            "email": email,
        }
        self._donations[donor_id] = []
        return name, email

    def reject_signup(self, signup_id: str) -> None:
        signup = next(
            (s for s in self._signups if s["signup_id"] == signup_id), None
        )
        if signup and signup.get("status") == "requested_signoff":
            signup["status"] = "rejected"

    # -- event RSVPs -------------------------------------------------------
    def add_event_rsvp(self, volunteer_id: str, event_id: str) -> None:
        self._event_rsvps.setdefault(volunteer_id, set()).add(event_id)

    def remove_event_rsvp(self, volunteer_id: str, event_id: str) -> None:
        self._event_rsvps.get(volunteer_id, set()).discard(event_id)

    # -- submissions -----------------------------------------------------
    def create_submission(
        self,
        donor_id: str,
        submitted_by_user_id: str,
        location: str,
        meals: int,
        photo_key: str,
        receipt_key: str | None,
        caption: str | None,
        delivery_role: str | None,
        partner_charity: str | None,
    ) -> str:
        submission_id = photo_key.split("/")[1] if "/" in photo_key else uuid.uuid4().hex
        self._submissions[submission_id] = {
            "submission_id": submission_id,
            "user_id": submitted_by_user_id,
            "donor_id": donor_id,
            "location": location,
            "meals": meals,
            "photo_key": photo_key,
            "receipt_key": receipt_key,
            "caption": caption,
            "delivery_role": delivery_role,
            "partner_charity": partner_charity,
            "status": "pending",
            "created_at": _now(),
        }
        return submission_id

    def resolve_donor_id(self, user_id: str, email: str) -> str | None:
        """find-or-claim-or-None — see
        specs/features/007-donor-application-approval/design.md and
        specs/features/008-persona-dashboards-and-roles/design.md. `email`
        is the session's already-verified email, not re-derived from the
        Users table."""
        for d in self._donors.values():
            if d.get("user_id") == user_id:
                return d["id"]
        if email:
            for d in self._donors.values():
                if d.get("email") == email and not d.get("user_id"):
                    d["user_id"] = user_id
                    return d["id"]
        return None

    def resolve_volunteer_id(self, user_id: str, email: str) -> str | None:
        """Same find-or-claim-or-None shape as resolve_donor_id, but
        against Volunteers — no "approved" concept to deny on."""
        for v in self._volunteers.values():
            if v.get("user_id") == user_id:
                return v["id"]
        if email:
            for v in self._volunteers.values():
                if v.get("email") == email and not v.get("user_id"):
                    v["user_id"] = user_id
                    return v["id"]
        return None

    def provision_dummy_donor(self, user_id: str, email: str, name: str) -> str:
        existing = self.resolve_donor_id(user_id, email)
        if existing:
            return existing
        donor_id = uuid.uuid4().hex
        self._donors[donor_id] = {
            "id": donor_id,
            "name": name,
            "location": "Austin, TX",
            "story": "Testing the donor dashboard locally.",
            "email": email,
            "user_id": user_id,
        }
        self._donations[donor_id] = [
            {
                "id": uuid.uuid4().hex,
                "date": _now()[:10],
                "location": "Austin, TX",
                "meals": 50,
                "caption": "Sample delivery for local testing.",
                "photo_key": None,
            }
        ]
        return donor_id

    def provision_dummy_volunteer(self, user_id: str, email: str, name: str) -> str:
        existing = self.resolve_volunteer_id(user_id, email)
        if existing:
            return existing
        volunteer_id = uuid.uuid4().hex
        self._volunteers[volunteer_id] = {
            "id": volunteer_id,
            "name": name,
            "location": "Austin, TX",
            "email": email,
            "user_id": user_id,
            "packets_per_trip": 20,
            "availability": "Weekends",
        }
        return volunteer_id

    def list_submissions(self, status: str) -> list[dict]:
        blob = get_blob_store()
        out = []
        for s in self._submissions.values():
            if s["status"] != status:
                continue
            out.append(
                {
                    **s,
                    "photo_url": blob.presign_get(s["photo_key"]),
                    "receipt_url": blob.presign_get(s["receipt_key"])
                    if s.get("receipt_key")
                    else None,
                }
            )
        return out

    def approve_submission(self, submission_id: str) -> None:
        s = self._submissions.get(submission_id)
        if not s or s["status"] != "pending":
            return
        blob = get_blob_store()
        donation_id = uuid.uuid4().hex
        approved_key = blob.copy_to_approved(s["photo_key"], donation_id)
        donor_id = s["donor_id"]
        self._donations.setdefault(donor_id, []).append(
            {
                "id": donation_id,
                "date": s["created_at"][:10],
                "location": s["location"],
                "meals": s["meals"],
                "caption": s.get("caption") or "",
                "photo_key": approved_key,
                "delivery_role": s.get("delivery_role"),
                "partner_charity": s.get("partner_charity"),
            }
        )
        self._config["total_meals"] += s["meals"]
        s["status"] = "approved"

    def reject_submission(self, submission_id: str) -> None:
        s = self._submissions.get(submission_id)
        if s and s["status"] == "pending":
            s["status"] = "rejected"

    def update_config(self, **fields) -> None:
        for k, v in fields.items():
            if v is not None:
                self._config[k] = v
