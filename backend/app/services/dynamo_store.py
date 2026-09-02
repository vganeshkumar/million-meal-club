"""Real DynamoDB-backed store, used in deployed environments
(DATA_BACKEND=dynamodb). Table names come from env vars set by
infra/modules/data (see specs/infra/design.md). Mirrors the table shapes in
specs/01-architecture.md."""

import os
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Attr, Key

from app.models.domain import (
    ContentResponse,
    Donation,
    DonationEvent,
    Donor,
    DonorAdminView,
    EventItem,
    PartnerCharity,
    PartnerCharityAdminView,
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


class DynamoStore:
    def __init__(self) -> None:
        resource = boto3.resource("dynamodb")
        self._users = resource.Table(os.environ["USERS_TABLE"])
        self._donors = resource.Table(os.environ["DONORS_TABLE"])
        self._donations = resource.Table(os.environ["DONATIONS_TABLE"])
        self._submissions = resource.Table(os.environ["SUBMISSIONS_TABLE"])
        self._events = resource.Table(os.environ["EVENTS_TABLE"])
        self._signups = resource.Table(os.environ["SIGNUPS_TABLE"])
        self._partner_charities = resource.Table(os.environ["PARTNER_CHARITIES_TABLE"])
        self._volunteers = resource.Table(os.environ["VOLUNTEERS_TABLE"])
        self._event_signups = resource.Table(os.environ["EVENT_SIGNUPS_TABLE"])
        self._donation_events = resource.Table(os.environ["DONATION_EVENTS_TABLE"])
        self._config = resource.Table(os.environ["CONFIG_TABLE"])

    def _get_config_item(self) -> dict:
        resp = self._config.get_item(Key={"pk": "site"})
        return resp.get("Item", {})

    def get_content(self) -> ContentResponse:
        config_item = self._get_config_item()
        donors_resp = self._donors.scan()
        donors = sorted(
            (
                d
                for d in donors_resp.get("Items", [])
                if d.get("status", "active") != "disabled"
            ),
            key=lambda d: int(d.get("total_meals", 0)),
            reverse=True,
        )
        events_resp = self._events.scan()
        charities_resp = self._partner_charities.scan()

        return ContentResponse(
            config=SiteConfig(
                charity_name=config_item.get("charity_name", "The Million Meal Club"),
                founder_name=config_item.get("founder_name", "Founder"),
                total_meals=int(config_item.get("total_meals", 0)),
                milestone_2027=int(config_item.get("milestone_2027", 100000)),
                goal_2030=int(config_item.get("goal_2030", 1000000)),
                accent_palette=tuple(
                    config_item.get(
                        "accent_palette",
                        ["oklch(38% 0.1 155)", "oklch(68% 0.15 55)"],
                    )
                ),
            ),
            donors=[
                Donor(
                    id=d["donor_id"],
                    name=d["name"],
                    location=d.get("location", ""),
                    country=d.get("country", ""),
                    story=d.get("story", ""),
                    total_meals=int(d.get("total_meals", 0)),
                    donation_count=int(d.get("donation_count", 0)),
                )
                for d in donors
            ],
            events=[
                EventItem(
                    id=e["event_id"],
                    date=e["date"],
                    time=e["time"],
                    location=e["location"],
                    packets_goal=int(e.get("packets_goal", 0)),
                    description=e.get("description", ""),
                )
                for e in events_resp.get("Items", [])
            ],
            partner_charities=[
                PartnerCharity(
                    id=c["charity_id"],
                    name=c["name"],
                    location=c.get("location", ""),
                    description=c.get("description", ""),
                    core_services=c.get("core_services"),
                    founder_details=c.get("founder_details"),
                    years_active=c.get("years_active"),
                    awards_credentials=c.get("awards_credentials"),
                    website_url=c.get("website_url"),
                    donation_url=c.get("donation_url"),
                    tax_refund_eligible=c.get("tax_refund_eligible"),
                    status=c.get("status", "active"),
                    created_at=c.get("created_at"),
                )
                for c in sorted(
                    charities_resp.get("Items", []),
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
        events = [e for e in self.list_all_donation_events() if e.status != "cancelled"]
        if not events:
            return events
        donor_ids = {e.donor_id for e in events}
        volunteer_ids = {e.volunteer_id for e in events if e.volunteer_id}
        disabled_donors = {
            d["donor_id"]
            for d in self._donors.scan().get("Items", [])
            if d["donor_id"] in donor_ids and d.get("status", "active") == "disabled"
        }
        disabled_volunteers = {
            v["volunteer_id"]
            for v in self._volunteers.scan().get("Items", [])
            if v["volunteer_id"] in volunteer_ids
            and v.get("status", "active") == "disabled"
        }
        return [
            e
            for e in events
            if e.donor_id not in disabled_donors
            and (e.volunteer_id is None or e.volunteer_id not in disabled_volunteers)
        ]

    def get_donor(self, donor_id: str) -> Donor | None:
        resp = self._donors.get_item(Key={"donor_id": donor_id})
        d = resp.get("Item")
        if not d or d.get("status", "active") == "disabled":
            return None
        blob = get_blob_store()
        donations_resp = self._donations.query(
            KeyConditionExpression=Key("donor_id").eq(donor_id)
        )
        donations = [
            item
            for item in donations_resp.get("Items", [])
            if item.get("status") == "approved"
        ]
        donations.sort(key=lambda x: x["date"], reverse=True)
        return Donor(
            id=d["donor_id"],
            name=d["name"],
            location=d.get("location", ""),
            country=d.get("country", ""),
            story=d.get("story", ""),
            total_meals=int(d.get("total_meals", 0)),
            donation_count=int(d.get("donation_count", 0)),
            created_at=d.get("created_at"),
            donations=[
                Donation(
                    id=x["donation_id"],
                    date=x["date"],
                    location=x["location"],
                    meals=int(x["meals"]),
                    caption=x.get("caption", ""),
                    photo_urls=[blob.public_url(k) for k in x["photo_keys"]]
                    if x.get("photo_keys")
                    else None,
                    cover_photo_url=blob.public_url(x["cover_photo_key"])
                    if x.get("cover_photo_key")
                    else None,
                )
                for x in donations
            ],
        )

    def list_donor_donation_receipts(self, donor_id: str) -> dict[str, str]:
        blob = get_blob_store()
        resp = self._donations.query(KeyConditionExpression=Key("donor_id").eq(donor_id))
        return {
            item["donation_id"]: blob.presign_get(item["receipt_key"])
            for item in resp.get("Items", [])
            if item.get("receipt_key")
        }

    def get_volunteer(self, volunteer_id: str) -> Volunteer | None:
        resp = self._volunteers.get_item(Key={"volunteer_id": volunteer_id})
        v = resp.get("Item")
        if not v:
            return None
        rsvps_resp = self._event_signups.query(
            KeyConditionExpression=Key("volunteer_id").eq(volunteer_id)
        )
        event_ids = {r["event_id"] for r in rsvps_resp.get("Items", [])}
        events = []
        for event_id in event_ids:
            e_resp = self._events.get_item(Key={"event_id": event_id})
            e = e_resp.get("Item")
            if e:
                events.append(
                    EventItem(
                        id=e["event_id"],
                        date=e["date"],
                        time=e["time"],
                        location=e["location"],
                        packets_goal=int(e.get("packets_goal", 0)),
                        description=e.get("description", ""),
                    )
                )
        return Volunteer(
            id=v["volunteer_id"],
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
        self._donors.update_item(
            Key={"donor_id": donor_id},
            UpdateExpression="SET #l = :l, country = :c, story = :s",
            ExpressionAttributeNames={"#l": "location"},
            ExpressionAttributeValues={":l": location, ":c": country, ":s": story},
        )
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
        self._volunteers.update_item(
            Key={"volunteer_id": volunteer_id},
            UpdateExpression=(
                "SET #l = :l, country = :c, packets_per_trip = :p, "
                "availability = :a, volunteering_history = :vh, #r = :r"
            ),
            ExpressionAttributeNames={"#l": "location", "#r": "references"},
            ExpressionAttributeValues={
                ":l": location,
                ":c": country,
                ":p": packets_per_trip,
                ":a": availability,
                ":vh": volunteering_history,
                ":r": references,
            },
        )
        volunteer = self.get_volunteer(volunteer_id)
        assert volunteer is not None
        return volunteer

    def list_volunteers(self) -> list[Volunteer]:
        resp = self._volunteers.scan()
        return [
            Volunteer(
                id=v["volunteer_id"],
                name=v["name"],
                location=v.get("location", ""),
                country=v.get("country", ""),
                packets_per_trip=v.get("packets_per_trip"),
                availability=v.get("availability"),
                events=[],
            )
            for v in resp.get("Items", [])
            if v.get("status", "active") != "disabled"
        ]

    def list_all_donors(self) -> list[DonorAdminView]:
        resp = self._donors.scan()
        return [
            DonorAdminView(
                donor_id=d["donor_id"],
                name=d["name"],
                location=d.get("location", ""),
                country=d.get("country", ""),
                email=d.get("email", ""),
                total_meals=int(d.get("total_meals", 0)),
                donation_count=int(d.get("donation_count", 0)),
                status=d.get("status", "active"),
            )
            for d in resp.get("Items", [])
        ]

    def list_all_volunteers(self) -> list[VolunteerAdminView]:
        resp = self._volunteers.scan()
        return [
            VolunteerAdminView(
                volunteer_id=v["volunteer_id"],
                name=v["name"],
                location=v.get("location", ""),
                country=v.get("country", ""),
                email=v.get("email", ""),
                packets_per_trip=v.get("packets_per_trip"),
                availability=v.get("availability"),
                status=v.get("status", "active"),
            )
            for v in resp.get("Items", [])
        ]

    def set_donor_status(self, donor_id: str, status: str) -> None:
        self._donors.update_item(
            Key={"donor_id": donor_id},
            UpdateExpression="SET #s = :status",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":status": status},
        )

    def set_volunteer_status(self, volunteer_id: str, status: str) -> None:
        self._volunteers.update_item(
            Key={"volunteer_id": volunteer_id},
            UpdateExpression="SET #s = :status",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":status": status},
        )

    def is_membership_disabled(self, user_id: str, email: str) -> bool:
        resp = self._donors.query(
            IndexName="user-index", KeyConditionExpression=Key("user_id").eq(user_id)
        )
        for d in resp.get("Items", []):
            if d.get("status", "active") == "disabled":
                return True
        if email:
            resp = self._donors.query(
                IndexName="email-index", KeyConditionExpression=Key("email").eq(email)
            )
            for d in resp.get("Items", []):
                if d.get("status", "active") == "disabled":
                    return True

        resp = self._volunteers.query(
            IndexName="user-index", KeyConditionExpression=Key("user_id").eq(user_id)
        )
        for v in resp.get("Items", []):
            if v.get("status", "active") == "disabled":
                return True
        if email:
            resp = self._volunteers.query(
                IndexName="email-index", KeyConditionExpression=Key("email").eq(email)
            )
            for v in resp.get("Items", []):
                if v.get("status", "active") == "disabled":
                    return True

        return False

    def get_or_create_user(
        self, provider: str, subject: str, email: str, name: str
    ) -> tuple[str, str]:
        identity_key = f"{provider}:{subject}"
        resp = self._users.query(
            IndexName="identity-index",
            KeyConditionExpression=Key("identity_key").eq(identity_key),
        )
        items = resp.get("Items", [])
        if items:
            user_id = items[0]["user_id"]
            self._users.update_item(
                Key={"user_id": user_id},
                UpdateExpression="SET #n = :n, email = :e",
                ExpressionAttributeNames={"#n": "name"},
                ExpressionAttributeValues={":n": name, ":e": email},
            )
            return user_id, name

        user_id = uuid.uuid4().hex
        self._users.put_item(
            Item={
                "user_id": user_id,
                "identity_key": identity_key,
                "provider": provider,
                "email": email,
                "name": name,
                "created_at": _now(),
            }
        )
        return user_id, name

    def create_signup(
        self, payload: SignupRequest, user_id: str | None, name: str, email: str
    ) -> str:
        signup_id = uuid.uuid4().hex
        item = {
            "signup_id": signup_id,
            "created_at": _now(),
            **payload.model_dump(),
            "name": name,
            "email": email,
            "status": "requested_signoff",
        }
        if user_id:
            item["user_id"] = user_id
        self._signups.put_item(Item={k: v for k, v in item.items() if v is not None})
        return signup_id

    def list_signups(self, status: str) -> list[dict]:
        resp = self._signups.query(
            IndexName="status-index", KeyConditionExpression=Key("status").eq(status)
        )
        return resp.get("Items", [])

    def approve_signup(self, signup_id: str) -> tuple[str, str, str]:
        resp = self._signups.get_item(Key={"signup_id": signup_id})
        signup = resp.get("Item")
        if not signup or signup.get("status") != "requested_signoff":
            raise ValueError("Signup not found or not pending")

        name = signup.get("name") or "Anonymous"
        email = signup["email"]
        mode = signup["mode"]
        taken = {
            d["local_username"]
            for d in self._donors.scan(
                ProjectionExpression="local_username"
            ).get("Items", [])
            if d.get("local_username")
        } | {
            v["local_username"]
            for v in self._volunteers.scan(
                ProjectionExpression="local_username"
            ).get("Items", [])
            if v.get("local_username")
        }
        local_username = _generate_local_username(name, taken)
        if mode == "donor":
            donor_id = uuid.uuid4().hex
            self._donors.put_item(
                Item={
                    "donor_id": donor_id,
                    "name": name,
                    "location": signup.get("location", ""),
                    "country": signup.get("country", ""),
                    "story": signup.get("donor_story", ""),
                    "email": email,
                    "total_meals": 0,
                    "donation_count": 0,
                    "local_username": local_username,
                    "status": "active",
                    "created_at": _now(),
                }
            )
        else:
            volunteer_id = uuid.uuid4().hex
            volunteer_item = {
                "volunteer_id": volunteer_id,
                "name": name,
                "location": signup.get("location", ""),
                "country": signup.get("country", ""),
                "email": email,
                "local_username": local_username,
                "status": "active",
            }
            if signup.get("packets_per_trip") is not None:
                volunteer_item["packets_per_trip"] = signup["packets_per_trip"]
            if signup.get("availability"):
                volunteer_item["availability"] = signup["availability"]
            if signup.get("volunteering_history"):
                volunteer_item["volunteering_history"] = signup["volunteering_history"]
            if signup.get("references"):
                volunteer_item["references"] = signup["references"]
            self._volunteers.put_item(Item=volunteer_item)
        self._signups.update_item(
            Key={"signup_id": signup_id},
            UpdateExpression="SET #s = :approved",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":approved": "approved"},
        )
        return name, email, mode

    def reject_signup(self, signup_id: str) -> None:
        self._signups.update_item(
            Key={"signup_id": signup_id},
            UpdateExpression="SET #s = :rejected",
            ConditionExpression="#s = :pending",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={
                ":rejected": "rejected",
                ":pending": "requested_signoff",
            },
        )

    # -- event RSVPs -------------------------------------------------------
    def add_event_rsvp(self, volunteer_id: str, event_id: str) -> None:
        self._event_signups.put_item(
            Item={
                "volunteer_id": volunteer_id,
                "event_id": event_id,
                "created_at": _now(),
            }
        )

    def remove_event_rsvp(self, volunteer_id: str, event_id: str) -> None:
        self._event_signups.delete_item(
            Key={"volunteer_id": volunteer_id, "event_id": event_id}
        )

    # -- donation events ---------------------------------------------------
    def _donation_event_from_item(self, e: dict) -> DonationEvent:
        latitude = e.get("latitude")
        longitude = e.get("longitude")
        return DonationEvent(
            id=e["event_id"],
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
            latitude=float(latitude) if latitude is not None else None,
            longitude=float(longitude) if longitude is not None else None,
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
        item = {
            "event_id": event_id,
            "donor_id": donor_id,
            "donor_name": donor_name,
            "location": location,
            "date": date,
            "start_time": start_time,
            "end_time": end_time,
            "status": "scheduled",
            "created_at": _now(),
        }
        if volunteer_id:
            item["volunteer_id"] = volunteer_id
            item["volunteer_name"] = volunteer_name
        if latitude is not None and longitude is not None:
            item["latitude"] = Decimal(str(latitude))
            item["longitude"] = Decimal(str(longitude))
        if packet_count is not None:
            item["packet_count"] = packet_count
        if delivery_role:
            item["delivery_role"] = delivery_role
        if partner_charity:
            item["partner_charity"] = partner_charity
        if notes:
            item["notes"] = notes
        self._donation_events.put_item(Item=item)
        return self._donation_event_from_item(item)

    def list_donation_events_for_donor(self, donor_id: str) -> list[DonationEvent]:
        resp = self._donation_events.query(
            IndexName="donor-index", KeyConditionExpression=Key("donor_id").eq(donor_id)
        )
        items = sorted(resp.get("Items", []), key=lambda e: e["date"])
        return [self._donation_event_from_item(e) for e in items]

    def list_donation_events_for_volunteer(
        self, volunteer_id: str
    ) -> list[DonationEvent]:
        resp = self._donation_events.query(
            IndexName="volunteer-index",
            KeyConditionExpression=Key("volunteer_id").eq(volunteer_id),
        )
        items = sorted(resp.get("Items", []), key=lambda e: e["date"])
        return [self._donation_event_from_item(e) for e in items]

    def get_donation_event(self, event_id: str) -> DonationEvent | None:
        resp = self._donation_events.get_item(Key={"event_id": event_id})
        item = resp.get("Item")
        return self._donation_event_from_item(item) if item else None

    def list_all_donation_events(self) -> list[DonationEvent]:
        resp = self._donation_events.scan()
        items = sorted(resp.get("Items", []), key=lambda e: e["date"])
        return [self._donation_event_from_item(e) for e in items]

    def assign_donation_event_volunteer(
        self,
        event_id: str,
        volunteer_id: str | None,
        volunteer_name: str | None,
    ) -> DonationEvent:
        resp = self._donation_events.get_item(Key={"event_id": event_id})
        item = resp.get("Item")
        if item is None:
            raise ValueError("Donation event not found")
        if item.get("status") in ("submitted", "completed"):
            raise ValueError("Donation event is already submitted")
        if volunteer_id:
            self._donation_events.update_item(
                Key={"event_id": event_id},
                UpdateExpression="SET volunteer_id = :v, volunteer_name = :n",
                ExpressionAttributeValues={":v": volunteer_id, ":n": volunteer_name},
            )
            item["volunteer_id"] = volunteer_id
            item["volunteer_name"] = volunteer_name
        else:
            self._donation_events.update_item(
                Key={"event_id": event_id},
                UpdateExpression="REMOVE volunteer_id, volunteer_name",
            )
            item.pop("volunteer_id", None)
            item.pop("volunteer_name", None)
        return self._donation_event_from_item(item)

    def cancel_donation_event(self, event_id: str) -> DonationEvent:
        resp = self._donation_events.get_item(Key={"event_id": event_id})
        item = resp.get("Item")
        if item is None:
            raise ValueError("Donation event not found")
        if item.get("status") in ("submitted", "completed", "cancelled"):
            raise ValueError("Donation event can't be cancelled")
        self._donation_events.update_item(
            Key={"event_id": event_id},
            UpdateExpression="SET #s = :cancelled",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":cancelled": "cancelled"},
        )
        item["status"] = "cancelled"
        return self._donation_event_from_item(item)

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
        resp = self._donation_events.get_item(Key={"event_id": event_id})
        item = resp.get("Item")
        if item is None:
            raise ValueError("Donation event not found")
        if item.get("status") != "scheduled":
            raise ValueError("Donation event can't be edited")

        optional_fields = {
            "packet_count": packet_count,
            "delivery_role": delivery_role,
            "partner_charity": partner_charity,
            "notes": notes,
            "latitude": latitude,
            "longitude": longitude,
        }
        set_names = {
            "#location": "location",
            "#date": "date",
            "#start_time": "start_time",
            "#end_time": "end_time",
        }
        set_values = {
            ":location": location,
            ":date": date,
            ":start_time": start_time,
            ":end_time": end_time,
        }
        set_parts = [
            "#location = :location",
            "#date = :date",
            "#start_time = :start_time",
            "#end_time = :end_time",
        ]
        remove_parts = []
        item["location"] = location
        item["date"] = date
        item["start_time"] = start_time
        item["end_time"] = end_time
        for field, value in optional_fields.items():
            if value is not None:
                set_names[f"#{field}"] = field
                set_values[f":{field}"] = (
                    Decimal(str(value)) if field in ("latitude", "longitude") else value
                )
                set_parts.append(f"#{field} = :{field}")
                item[field] = value
            else:
                remove_parts.append(field)
                item.pop(field, None)

        update_expression = "SET " + ", ".join(set_parts)
        if remove_parts:
            update_expression += " REMOVE " + ", ".join(remove_parts)
        self._donation_events.update_item(
            Key={"event_id": event_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=set_names,
            ExpressionAttributeValues=set_values,
        )
        return self._donation_event_from_item(item)

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
        item = {
            "submission_id": submission_id,
            "user_id": submitted_by_user_id,
            "donor_id": donor_id,
            "location": location,
            "meals": meals,
            "photo_keys": photo_keys,
            "cover_photo_key": cover_photo_key,
            "status": "pending",
            "created_at": _now(),
        }
        if receipt_key:
            item["receipt_key"] = receipt_key
        if caption:
            item["caption"] = caption
        if delivery_role:
            item["delivery_role"] = delivery_role
        if partner_charity:
            item["partner_charity"] = partner_charity
        if donation_event_id:
            item["donation_event_id"] = donation_event_id
        self._submissions.put_item(Item=item)
        if donation_event_id:
            self._donation_events.update_item(
                Key={"event_id": donation_event_id},
                UpdateExpression="SET #s = :submitted, submission_id = :sub",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":submitted": "submitted",
                    ":sub": submission_id,
                },
            )
        return submission_id

    def resolve_donor_id(self, user_id: str, email: str) -> str | None:
        """find-or-claim-or-None — see
        specs/features/007-donor-application-approval/design.md and
        specs/features/008-persona-dashboards-and-roles/design.md. `email`
        is the session's already-verified email, not re-derived from the
        Users table."""
        resp = self._donors.query(
            IndexName="user-index", KeyConditionExpression=Key("user_id").eq(user_id)
        )
        items = resp.get("Items", [])
        if items:
            return items[0]["donor_id"]

        if email:
            email_resp = self._donors.query(
                IndexName="email-index", KeyConditionExpression=Key("email").eq(email)
            )
            unclaimed = [
                d for d in email_resp.get("Items", []) if not d.get("user_id")
            ]
            if unclaimed:
                donor_id = unclaimed[0]["donor_id"]
                self._donors.update_item(
                    Key={"donor_id": donor_id},
                    UpdateExpression="SET user_id = :u",
                    ExpressionAttributeValues={":u": user_id},
                )
                return donor_id

        return None

    def resolve_volunteer_id(self, user_id: str, email: str) -> str | None:
        """Same find-or-claim-or-None shape as resolve_donor_id, but
        against Volunteers — no "approved" concept to deny on."""
        resp = self._volunteers.query(
            IndexName="user-index", KeyConditionExpression=Key("user_id").eq(user_id)
        )
        items = resp.get("Items", [])
        if items:
            return items[0]["volunteer_id"]

        if email:
            email_resp = self._volunteers.query(
                IndexName="email-index", KeyConditionExpression=Key("email").eq(email)
            )
            unclaimed = [
                v for v in email_resp.get("Items", []) if not v.get("user_id")
            ]
            if unclaimed:
                volunteer_id = unclaimed[0]["volunteer_id"]
                self._volunteers.update_item(
                    Key={"volunteer_id": volunteer_id},
                    UpdateExpression="SET user_id = :u",
                    ExpressionAttributeValues={":u": user_id},
                )
                return volunteer_id

        return None

    def get_donor_local_username(self, donor_id: str) -> str | None:
        resp = self._donors.get_item(Key={"donor_id": donor_id})
        item = resp.get("Item")
        return item.get("local_username") if item else None

    def get_volunteer_local_username(self, volunteer_id: str) -> str | None:
        resp = self._volunteers.get_item(Key={"volunteer_id": volunteer_id})
        item = resp.get("Item")
        return item.get("local_username") if item else None

    def resolve_local_login(self, username: str) -> tuple[str, str] | None:
        resp = self._donors.scan(FilterExpression=Attr("local_username").eq(username))
        items = resp.get("Items", [])
        if items:
            return items[0]["email"], items[0]["name"]
        resp = self._volunteers.scan(
            FilterExpression=Attr("local_username").eq(username)
        )
        items = resp.get("Items", [])
        if items:
            return items[0]["email"], items[0]["name"]
        return None

    def list_submissions(self, status: str) -> list[dict]:
        blob = get_blob_store()
        resp = self._submissions.query(
            IndexName="status-index", KeyConditionExpression=Key("status").eq(status)
        )
        out = []
        for s in resp.get("Items", []):
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
        resp = self._submissions.get_item(Key={"submission_id": submission_id})
        s = resp.get("Item")
        if not s or s.get("status") != "pending":
            return

        blob = get_blob_store()
        donation_id = uuid.uuid4().hex
        approved_keys = [
            blob.copy_to_approved(k, donation_id) for k in s["photo_keys"]
        ]
        cover_idx = list(s["photo_keys"]).index(s["cover_photo_key"])
        approved_cover_key = approved_keys[cover_idx]
        donor_id = s["donor_id"]

        donation_item = {
            "donor_id": donor_id,
            "donation_id": donation_id,
            "date": s["created_at"][:10],
            "location": s["location"],
            "meals": s["meals"],
            "caption": s.get("caption", ""),
            "photo_keys": approved_keys,
            "cover_photo_key": approved_cover_key,
            "status": "approved",
        }
        if s.get("delivery_role"):
            donation_item["delivery_role"] = s["delivery_role"]
        if s.get("partner_charity"):
            donation_item["partner_charity"] = s["partner_charity"]
        if s.get("receipt_key"):
            donation_item["receipt_key"] = s["receipt_key"]

        self._donations.put_item(Item=donation_item)
        self._donors.update_item(
            Key={"donor_id": donor_id},
            UpdateExpression="ADD total_meals :m, donation_count :one",
            ExpressionAttributeValues={":m": s["meals"], ":one": 1},
        )
        self._config.update_item(
            Key={"pk": "site"},
            UpdateExpression="ADD total_meals :m",
            ExpressionAttributeValues={":m": s["meals"]},
        )
        self._submissions.update_item(
            Key={"submission_id": submission_id},
            UpdateExpression="SET #s = :approved",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":approved": "approved"},
        )
        donation_event_id = s.get("donation_event_id")
        if donation_event_id:
            self._donation_events.update_item(
                Key={"event_id": donation_event_id},
                UpdateExpression=(
                    "SET #s = :completed, photo_urls = :photo_urls, "
                    "cover_photo_url = :cover_photo_url, caption = :caption"
                ),
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={
                    ":completed": "completed",
                    ":photo_urls": [blob.public_url(k) for k in approved_keys],
                    ":cover_photo_url": blob.public_url(approved_cover_key),
                    ":caption": s.get("caption") or "",
                },
            )

    def reject_submission(self, submission_id: str) -> None:
        resp = self._submissions.get_item(Key={"submission_id": submission_id})
        s = resp.get("Item")
        if not s or s.get("status") != "pending":
            return
        self._submissions.update_item(
            Key={"submission_id": submission_id},
            UpdateExpression="SET #s = :rejected",
            ConditionExpression="#s = :pending",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":rejected": "rejected", ":pending": "pending"},
        )
        donation_event_id = s.get("donation_event_id")
        if donation_event_id:
            self._donation_events.update_item(
                Key={"event_id": donation_event_id},
                UpdateExpression="SET #s = :scheduled REMOVE submission_id",
                ExpressionAttributeNames={"#s": "status"},
                ExpressionAttributeValues={":scheduled": "scheduled"},
            )

    def update_config(self, **fields) -> None:
        updates = {k: v for k, v in fields.items() if v is not None}
        if not updates:
            return
        expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates)
        self._config.update_item(
            Key={"pk": "site"},
            UpdateExpression=expr,
            ExpressionAttributeNames={f"#{k}": k for k in updates},
            ExpressionAttributeValues={f":{k}": v for k, v in updates.items()},
        )

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
        tax_refund_eligible: bool | None = None,
        email: str | None = None,
    ) -> PartnerCharityAdminView:
        charity_id = uuid.uuid4().hex
        created_at = _now()
        item = {
            "charity_id": charity_id,
            "name": name,
            "location": location,
            "description": description,
            "status": "active",
            "created_at": created_at,
        }
        if core_services:
            item["core_services"] = core_services
        if founder_details:
            item["founder_details"] = founder_details
        if years_active:
            item["years_active"] = years_active
        if awards_credentials:
            item["awards_credentials"] = awards_credentials
        if website_url:
            item["website_url"] = website_url
        if donation_url:
            item["donation_url"] = donation_url
        if tax_refund_eligible is not None:
            item["tax_refund_eligible"] = tax_refund_eligible
        if email:
            item["email"] = email
        self._partner_charities.put_item(Item=item)
        return PartnerCharityAdminView(
            id=charity_id,
            name=name,
            location=location,
            description=description,
            core_services=core_services,
            founder_details=founder_details,
            years_active=years_active,
            awards_credentials=awards_credentials,
            website_url=website_url,
            donation_url=donation_url,
            tax_refund_eligible=tax_refund_eligible,
            email=email,
            status="active",
            created_at=created_at,
        )

    def list_all_partner_charities(self) -> list[PartnerCharityAdminView]:
        resp = self._partner_charities.scan()
        return [
            PartnerCharityAdminView(
                id=c["charity_id"],
                name=c["name"],
                location=c.get("location", ""),
                description=c.get("description", ""),
                core_services=c.get("core_services"),
                founder_details=c.get("founder_details"),
                years_active=c.get("years_active"),
                awards_credentials=c.get("awards_credentials"),
                website_url=c.get("website_url"),
                donation_url=c.get("donation_url"),
                tax_refund_eligible=c.get("tax_refund_eligible"),
                email=c.get("email"),
                status=c.get("status", "active"),
                created_at=c.get("created_at"),
            )
            for c in resp.get("Items", [])
        ]

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
        tax_refund_eligible: bool | None,
        email: str | None = None,
    ) -> PartnerCharityAdminView:
        resp = self._partner_charities.get_item(Key={"charity_id": charity_id})
        item = resp.get("Item")
        if item is None:
            raise ValueError(f"Partner charity {charity_id} not found")
        item.update(
            {
                "name": name,
                "location": location,
                "description": description,
                "core_services": core_services,
                "founder_details": founder_details,
                "years_active": years_active,
                "awards_credentials": awards_credentials,
                "website_url": website_url,
                "donation_url": donation_url,
                "tax_refund_eligible": tax_refund_eligible,
                "email": email,
            }
        )
        # Full replace via put_item, not update_item — mirrors the "not a
        # patch-in" convention used elsewhere for edit endpoints, and lets
        # None values actually clear a previously-set optional field
        # (update_item's SET can't remove an attribute this way).
        item = {k: v for k, v in item.items() if v is not None}
        self._partner_charities.put_item(Item=item)
        return PartnerCharityAdminView(
            id=charity_id,
            name=name,
            location=location,
            description=description,
            core_services=core_services,
            founder_details=founder_details,
            years_active=years_active,
            awards_credentials=awards_credentials,
            website_url=website_url,
            donation_url=donation_url,
            tax_refund_eligible=tax_refund_eligible,
            email=email,
            status=item.get("status", "active"),
            created_at=item.get("created_at"),
        )

    def set_partner_charity_status(self, charity_id: str, status: str) -> None:
        self._partner_charities.update_item(
            Key={"charity_id": charity_id},
            UpdateExpression="SET #s = :status",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":status": status},
        )
