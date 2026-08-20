"""In-memory data store for local development only (DATA_BACKEND=local, the
default for `uvicorn --reload`). Seeded with a few demo donors/events so the
site is browsable without AWS. Never used when DATA_BACKEND=dynamodb — see
app/services/dynamo_store.py for the real implementation and
specs/01-architecture.md for the table shapes this mirrors."""

import re
import uuid
from datetime import datetime, timezone

from app.models.domain import (
    ContentResponse,
    Donation,
    DonationEvent,
    Donor,
    DonorAdminView,
    EventItem,
    PartnerCharity,
    SignupRequest,
    SiteConfig,
    Volunteer,
    VolunteerAdminView,
)
from app.services.blob import get_blob_store


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _generate_local_username(name: str, taken: set[str]) -> str:
    """See specs/features/015-local-dev-generated-credentials/design.md —
    lowercased name, spaces -> underscores, anything else stripped;
    numeric suffix appended on collision."""
    base = re.sub(r"[^a-z0-9_]", "", name.strip().lower().replace(" ", "_")) or "user"
    username = base
    n = 2
    while username in taken:
        username = f"{base}{n}"
        n += 1
    return username


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
        self._users: dict[str, dict] = {}
        self._users_by_identity: dict[str, str] = {}
        self._signups: list[dict] = []
        self._submissions: dict[str, dict] = {}
        self._volunteers: dict[str, dict] = {}
        self._event_rsvps: dict[str, set[str]] = {}  # volunteer_id -> {event_id}
        self._donation_events: dict[str, dict] = {}
        self._seed()

    def _seed(self) -> None:
        d1, d2, d3 = "donor-1", "donor-2", "donor-3"
        self._donors = {
            d1: {
                "id": d1,
                "name": "Priya Sharma",
                "location": "Austin, TX",
                "country": "United States",
                "story": "My grandmother never turned away a hungry neighbor. This is the least I can do to carry that forward.",
            },
            d2: {
                "id": d2,
                "name": "Marcus Webb",
                "location": "Round Rock, TX",
                "country": "United States",
                "story": "I drive for a living and pass the same shelters every week. Figured I might as well bring something.",
            },
            d3: {
                "id": d3,
                "name": "Aiko Tanaka",
                "location": "Cedar Park, TX",
                "country": "United States",
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
                },
                {
                    "id": "don-1b",
                    "date": "2026-06-01",
                    "location": "East Austin",
                    "meals": 180,
                    "caption": "Second monthly drop-off, same route.",
                },
            ],
            d2: [
                {
                    "id": "don-2a",
                    "date": "2026-05-03",
                    "location": "North Austin",
                    "meals": 150,
                    "caption": "Delivered during my regular route stop.",
                }
            ],
            d3: [
                {
                    "id": "don-3a",
                    "date": "2026-05-20",
                    "location": "Cedar Park",
                    "meals": 90,
                    "caption": "First delivery — more to come!",
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
        donors = [
            d for d in self._ranked_donors(blob) if d.get("status", "active") != "disabled"
        ]
        return ContentResponse(
            config=SiteConfig(**self._config),
            donors=[
                Donor(
                    id=d["id"],
                    name=d["name"],
                    location=d["location"],
                    country=d.get("country", ""),
                    story=d["story"],
                    total_meals=d["total_meals"],
                    donation_count=d["donation_count"],
                )
                for d in donors
            ],
            events=[EventItem(**e) for e in self._events],
            partner_charities=[
                PartnerCharity(**c)
                for c in sorted(
                    self._partner_charities,
                    key=lambda c: c.get("created_at") or "",
                    reverse=True,
                )
                if c.get("status", "active") != "disabled"
            ],
            donation_events=self._public_donation_events(),
        )

    def _public_donation_events(self) -> list[DonationEvent]:
        """list_all_donation_events(), minus any event tied to a disabled
        donor or volunteer (see
        specs/features/016-admin-membership-status/design.md) or that's
        been cancelled (see
        specs/features/017-cancel-donation-events/design.md). Used only by
        get_content(); the admin Events tab uses the unfiltered
        list_all_donation_events() directly."""
        return [
            e
            for e in self.list_all_donation_events()
            if e.status != "cancelled"
            and self._donors.get(e.donor_id, {}).get("status", "active") != "disabled"
            and (
                e.volunteer_id is None
                or self._volunteers.get(e.volunteer_id, {}).get("status", "active")
                != "disabled"
            )
        ]

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
        if not d or d.get("status", "active") == "disabled":
            return None
        blob = get_blob_store()
        donations = self._donations.get(donor_id, [])
        total = sum(x["meals"] for x in donations)
        return Donor(
            id=d["id"],
            name=d["name"],
            location=d["location"],
            country=d.get("country", ""),
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
                    photo_urls=[blob.public_url(k) for k in x["photo_keys"]]
                    if x.get("photo_keys")
                    else None,
                    cover_photo_url=blob.public_url(x["cover_photo_key"])
                    if x.get("cover_photo_key")
                    else None,
                )
                for x in sorted(donations, key=lambda x: x["date"], reverse=True)
            ],
        )

    def list_donor_donation_receipts(self, donor_id: str) -> dict[str, str]:
        blob = get_blob_store()
        return {
            x["id"]: blob.presign_get(x["receipt_key"])
            for x in self._donations.get(donor_id, [])
            if x.get("receipt_key")
        }

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
            country=v.get("country", ""),
            packets_per_trip=v.get("packets_per_trip"),
            availability=v.get("availability"),
            volunteering_history=v.get("volunteering_history"),
            references=v.get("references"),
            events=events,
        )

    def update_donor_profile(
        self, donor_id: str, location: str, country: str, story: str
    ) -> Donor:
        d = self._donors[donor_id]
        d["location"] = location
        d["country"] = country
        d["story"] = story
        donor = self.get_donor(donor_id)
        assert donor is not None
        return donor

    def update_volunteer_profile(
        self,
        volunteer_id: str,
        location: str,
        country: str,
        packets_per_trip: int,
        availability: str,
        volunteering_history: str | None,
        references: str | None,
    ) -> Volunteer:
        v = self._volunteers[volunteer_id]
        v["location"] = location
        v["country"] = country
        v["packets_per_trip"] = packets_per_trip
        v["availability"] = availability
        v["volunteering_history"] = volunteering_history
        v["references"] = references
        volunteer = self.get_volunteer(volunteer_id)
        assert volunteer is not None
        return volunteer

    def list_volunteers(self) -> list[Volunteer]:
        return [
            Volunteer(
                id=v["id"],
                name=v["name"],
                location=v.get("location", ""),
                country=v.get("country", ""),
                packets_per_trip=v.get("packets_per_trip"),
                availability=v.get("availability"),
                events=[],
            )
            for v in self._volunteers.values()
            if v.get("status", "active") != "disabled"
        ]

    def list_all_donors(self) -> list[DonorAdminView]:
        return [
            DonorAdminView(
                donor_id=d["id"],
                name=d["name"],
                location=d.get("location", ""),
                country=d.get("country", ""),
                email=d.get("email", ""),
                total_meals=sum(x["meals"] for x in self._donations.get(d["id"], [])),
                donation_count=len(self._donations.get(d["id"], [])),
                status=d.get("status", "active"),
            )
            for d in self._donors.values()
        ]

    def list_all_volunteers(self) -> list[VolunteerAdminView]:
        return [
            VolunteerAdminView(
                volunteer_id=v["id"],
                name=v["name"],
                location=v.get("location", ""),
                country=v.get("country", ""),
                email=v.get("email", ""),
                packets_per_trip=v.get("packets_per_trip"),
                availability=v.get("availability"),
                status=v.get("status", "active"),
            )
            for v in self._volunteers.values()
        ]

    def set_donor_status(self, donor_id: str, status: str) -> None:
        d = self._donors.get(donor_id)
        if d is not None:
            d["status"] = status

    def set_volunteer_status(self, volunteer_id: str, status: str) -> None:
        v = self._volunteers.get(volunteer_id)
        if v is not None:
            v["status"] = status

    def is_membership_disabled(self, user_id: str, email: str) -> bool:
        for d in self._donors.values():
            if (d.get("user_id") == user_id or (email and d.get("email") == email)) and d.get(
                "status", "active"
            ) == "disabled":
                return True
        for v in self._volunteers.values():
            if (v.get("user_id") == user_id or (email and v.get("email") == email)) and v.get(
                "status", "active"
            ) == "disabled":
                return True
        return False

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
            "status": "requested_signoff",
        }
        self._signups.append(item)
        return signup_id

    def list_signups(self, status: str) -> list[dict]:
        return [s for s in self._signups if s.get("status") == status]

    def approve_signup(self, signup_id: str) -> tuple[str, str, str]:
        signup = next(
            (s for s in self._signups if s["signup_id"] == signup_id), None
        )
        if not signup or signup.get("status") != "requested_signoff":
            raise ValueError("Signup not found or not pending")
        signup["status"] = "approved"

        name = signup.get("name") or "Anonymous"
        email = signup["email"]
        mode = signup["mode"]
        taken = {
            d["local_username"] for d in self._donors.values() if d.get("local_username")
        } | {
            v["local_username"]
            for v in self._volunteers.values()
            if v.get("local_username")
        }
        local_username = _generate_local_username(name, taken)
        if mode == "donor":
            donor_id = uuid.uuid4().hex
            self._donors[donor_id] = {
                "id": donor_id,
                "name": name,
                "location": signup.get("location", ""),
                "country": signup.get("country", ""),
                "story": signup.get("donor_story", ""),
                "email": email,
                "local_username": local_username,
                "status": "active",
            }
            self._donations[donor_id] = []
        else:
            volunteer_id = uuid.uuid4().hex
            self._volunteers[volunteer_id] = {
                "id": volunteer_id,
                "name": name,
                "location": signup.get("location", ""),
                "country": signup.get("country", ""),
                "email": email,
                "packets_per_trip": signup.get("packets_per_trip"),
                "availability": signup.get("availability"),
                "volunteering_history": signup.get("volunteering_history"),
                "references": signup.get("references"),
                "local_username": local_username,
                "status": "active",
            }
        return name, email, mode

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

    # -- donation events ---------------------------------------------------
    def _donation_event_from_row(self, e: dict) -> DonationEvent:
        return DonationEvent(
            id=e["id"],
            donor_id=e["donor_id"],
            donor_name=e["donor_name"],
            location=e["location"],
            date=e["date"],
            volunteer_id=e.get("volunteer_id"),
            volunteer_name=e.get("volunteer_name"),
            status=e["status"],
            submission_id=e.get("submission_id"),
            packet_count=e.get("packet_count"),
            delivery_role=e.get("delivery_role"),
            partner_charity=e.get("partner_charity"),
            notes=e.get("notes"),
            photo_urls=e.get("photo_urls"),
            cover_photo_url=e.get("cover_photo_url"),
            caption=e.get("caption"),
            latitude=e.get("latitude"),
            longitude=e.get("longitude"),
            start_time=e.get("start_time"),
            end_time=e.get("end_time"),
        )

    def create_donation_event(
        self,
        donor_id: str,
        donor_name: str,
        location: str,
        date: str,
        start_time: str,
        end_time: str,
        volunteer_id: str | None,
        volunteer_name: str | None,
        latitude: float | None = None,
        longitude: float | None = None,
        packet_count: int | None = None,
        delivery_role: str | None = None,
        partner_charity: str | None = None,
        notes: str | None = None,
    ) -> DonationEvent:
        event_id = uuid.uuid4().hex
        row = {
            "id": event_id,
            "donor_id": donor_id,
            "donor_name": donor_name,
            "location": location,
            "date": date,
            "start_time": start_time,
            "end_time": end_time,
            "volunteer_id": volunteer_id,
            "volunteer_name": volunteer_name,
            "status": "scheduled",
            "submission_id": None,
            "latitude": latitude,
            "longitude": longitude,
            "packet_count": packet_count,
            "delivery_role": delivery_role,
            "partner_charity": partner_charity,
            "notes": notes,
            "created_at": _now(),
        }
        self._donation_events[event_id] = row
        return self._donation_event_from_row(row)

    def list_donation_events_for_donor(self, donor_id: str) -> list[DonationEvent]:
        rows = [
            e for e in self._donation_events.values() if e["donor_id"] == donor_id
        ]
        rows.sort(key=lambda e: e["date"])
        return [self._donation_event_from_row(e) for e in rows]

    def list_donation_events_for_volunteer(
        self, volunteer_id: str
    ) -> list[DonationEvent]:
        rows = [
            e
            for e in self._donation_events.values()
            if e.get("volunteer_id") == volunteer_id
        ]
        rows.sort(key=lambda e: e["date"])
        return [self._donation_event_from_row(e) for e in rows]

    def list_all_donation_events(self) -> list[DonationEvent]:
        rows = sorted(self._donation_events.values(), key=lambda e: e["date"])
        return [self._donation_event_from_row(e) for e in rows]

    def get_donation_event(self, event_id: str) -> DonationEvent | None:
        row = self._donation_events.get(event_id)
        return self._donation_event_from_row(row) if row else None

    def assign_donation_event_volunteer(
        self,
        event_id: str,
        volunteer_id: str | None,
        volunteer_name: str | None,
    ) -> DonationEvent:
        row = self._donation_events.get(event_id)
        if row is None:
            raise ValueError("Donation event not found")
        if row["status"] in ("submitted", "completed"):
            raise ValueError("Donation event is already submitted")
        row["volunteer_id"] = volunteer_id
        row["volunteer_name"] = volunteer_name
        return self._donation_event_from_row(row)

    def cancel_donation_event(self, event_id: str) -> DonationEvent:
        row = self._donation_events.get(event_id)
        if row is None:
            raise ValueError("Donation event not found")
        if row["status"] in ("submitted", "completed", "cancelled"):
            raise ValueError("Donation event can't be cancelled")
        row["status"] = "cancelled"
        return self._donation_event_from_row(row)

    def update_donation_event(
        self,
        event_id: str,
        location: str,
        date: str,
        start_time: str,
        end_time: str,
        packet_count: int | None,
        delivery_role: str | None,
        partner_charity: str | None,
        notes: str | None,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> DonationEvent:
        row = self._donation_events.get(event_id)
        if row is None:
            raise ValueError("Donation event not found")
        if row["status"] != "scheduled":
            raise ValueError("Donation event can't be edited")
        row["location"] = location
        row["date"] = date
        row["start_time"] = start_time
        row["end_time"] = end_time
        row["latitude"] = latitude
        row["longitude"] = longitude
        row["packet_count"] = packet_count
        row["delivery_role"] = delivery_role
        row["partner_charity"] = partner_charity
        row["notes"] = notes
        return self._donation_event_from_row(row)

    # -- submissions -----------------------------------------------------
    def create_submission(
        self,
        donor_id: str,
        submitted_by_user_id: str,
        location: str,
        meals: int,
        photo_keys: list[str],
        cover_photo_key: str,
        receipt_key: str | None,
        caption: str | None,
        delivery_role: str | None,
        partner_charity: str | None,
        donation_event_id: str | None = None,
    ) -> str:
        submission_id = uuid.uuid4().hex
        self._submissions[submission_id] = {
            "submission_id": submission_id,
            "user_id": submitted_by_user_id,
            "donor_id": donor_id,
            "location": location,
            "meals": meals,
            "photo_keys": photo_keys,
            "cover_photo_key": cover_photo_key,
            "receipt_key": receipt_key,
            "caption": caption,
            "delivery_role": delivery_role,
            "partner_charity": partner_charity,
            "donation_event_id": donation_event_id,
            "status": "pending",
            "created_at": _now(),
        }
        if donation_event_id:
            event = self._donation_events.get(donation_event_id)
            if event is not None:
                event["status"] = "submitted"
                event["submission_id"] = submission_id
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

    def get_donor_local_username(self, donor_id: str) -> str | None:
        d = self._donors.get(donor_id)
        return d.get("local_username") if d else None

    def get_volunteer_local_username(self, volunteer_id: str) -> str | None:
        v = self._volunteers.get(volunteer_id)
        return v.get("local_username") if v else None

    def resolve_local_login(self, username: str) -> tuple[str, str] | None:
        for d in self._donors.values():
            if d.get("local_username") == username:
                return d["email"], d["name"]
        for v in self._volunteers.values():
            if v.get("local_username") == username:
                return v["email"], v["name"]
        return None

    def list_submissions(self, status: str) -> list[dict]:
        blob = get_blob_store()
        out = []
        for s in self._submissions.values():
            if s["status"] != status:
                continue
            out.append(
                {
                    **s,
                    "photo_urls": [blob.presign_get(k) for k in s["photo_keys"]],
                    "cover_photo_url": blob.presign_get(s["cover_photo_key"]),
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
        approved_keys = [
            blob.copy_to_approved(k, donation_id) for k in s["photo_keys"]
        ]
        cover_idx = s["photo_keys"].index(s["cover_photo_key"])
        approved_cover_key = approved_keys[cover_idx]
        donor_id = s["donor_id"]
        self._donations.setdefault(donor_id, []).append(
            {
                "id": donation_id,
                "date": s["created_at"][:10],
                "location": s["location"],
                "meals": s["meals"],
                "caption": s.get("caption") or "",
                "photo_keys": approved_keys,
                "cover_photo_key": approved_cover_key,
                "receipt_key": s.get("receipt_key"),
                "delivery_role": s.get("delivery_role"),
                "partner_charity": s.get("partner_charity"),
            }
        )
        self._config["total_meals"] += s["meals"]
        s["status"] = "approved"
        donation_event_id = s.get("donation_event_id")
        if donation_event_id:
            event = self._donation_events.get(donation_event_id)
            if event is not None:
                event["status"] = "completed"
                event["photo_urls"] = [blob.public_url(k) for k in approved_keys]
                event["cover_photo_url"] = blob.public_url(approved_cover_key)
                event["caption"] = s.get("caption") or None

    def reject_submission(self, submission_id: str) -> None:
        s = self._submissions.get(submission_id)
        if s and s["status"] == "pending":
            s["status"] = "rejected"
            donation_event_id = s.get("donation_event_id")
            if donation_event_id:
                event = self._donation_events.get(donation_event_id)
                if event is not None:
                    event["status"] = "scheduled"
                    event["submission_id"] = None

    def update_config(self, **fields) -> None:
        for k, v in fields.items():
            if v is not None:
                self._config[k] = v

    def create_partner_charity(
        self,
        name: str,
        location: str,
        description: str,
        core_services: str | None = None,
        founder_details: str | None = None,
        years_active: str | None = None,
        awards_credentials: str | None = None,
        website_url: str | None = None,
        donation_url: str | None = None,
    ) -> PartnerCharity:
        charity = {
            "id": f"charity-{uuid.uuid4().hex}",
            "name": name,
            "location": location,
            "description": description,
            "core_services": core_services,
            "founder_details": founder_details,
            "years_active": years_active,
            "awards_credentials": awards_credentials,
            "website_url": website_url,
            "donation_url": donation_url,
            "status": "active",
            "created_at": _now(),
        }
        self._partner_charities.append(charity)
        return PartnerCharity(**charity)

    def list_all_partner_charities(self) -> list[PartnerCharity]:
        return [PartnerCharity(**c) for c in self._partner_charities]

    def _find_partner_charity(self, charity_id: str) -> dict:
        for c in self._partner_charities:
            if c["id"] == charity_id:
                return c
        raise ValueError(f"Partner charity {charity_id} not found")

    def update_partner_charity(
        self,
        charity_id: str,
        name: str,
        location: str,
        description: str,
        core_services: str | None,
        founder_details: str | None,
        years_active: str | None,
        awards_credentials: str | None,
        website_url: str | None,
        donation_url: str | None,
    ) -> PartnerCharity:
        charity = self._find_partner_charity(charity_id)
        charity["name"] = name
        charity["location"] = location
        charity["description"] = description
        charity["core_services"] = core_services
        charity["founder_details"] = founder_details
        charity["years_active"] = years_active
        charity["awards_credentials"] = awards_credentials
        charity["website_url"] = website_url
        charity["donation_url"] = donation_url
        return PartnerCharity(**charity)

    def set_partner_charity_status(self, charity_id: str, status: str) -> None:
        self._find_partner_charity(charity_id)["status"] = status
