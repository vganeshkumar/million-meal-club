"""Real DynamoDB-backed store, used in deployed environments
(DATA_BACKEND=dynamodb). Table names come from env vars set by
infra/modules/data (see specs/infra/design.md). Mirrors the table shapes in
specs/01-architecture.md."""

import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key

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
        self._config = resource.Table(os.environ["CONFIG_TABLE"])

    def _get_config_item(self) -> dict:
        resp = self._config.get_item(Key={"pk": "site"})
        return resp.get("Item", {})

    def get_content(self) -> ContentResponse:
        blob = get_blob_store()
        config_item = self._get_config_item()
        donors_resp = self._donors.scan()
        donors = sorted(
            donors_resp.get("Items", []),
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
                )
                for c in charities_resp.get("Items", [])
            ],
            gallery=[],
        )

    def get_donor(self, donor_id: str) -> Donor | None:
        resp = self._donors.get_item(Key={"donor_id": donor_id})
        d = resp.get("Item")
        if not d:
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
            story=d.get("story", ""),
            total_meals=int(d.get("total_meals", 0)),
            donation_count=int(d.get("donation_count", 0)),
            donations=[
                Donation(
                    id=x["donation_id"],
                    date=x["date"],
                    location=x["location"],
                    meals=int(x["meals"]),
                    caption=x.get("caption", ""),
                    photo_url=blob.public_url(x["photo_key"]) if x.get("photo_key") else None,
                )
                for x in donations
            ],
        )

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
            packets_per_trip=v.get("packets_per_trip"),
            availability=v.get("availability"),
            events=events,
        )

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
        }
        if user_id:
            item["user_id"] = user_id
        if payload.mode == "donor":
            item["status"] = "requested_signoff"
        else:
            # Volunteers have no approval gate — linkable immediately. See
            # specs/features/008-persona-dashboards-and-roles/design.md.
            volunteer_id = uuid.uuid4().hex
            volunteer_item = {
                "volunteer_id": volunteer_id,
                "name": name,
                "location": payload.location,
                "email": email,
            }
            if payload.packets_per_trip is not None:
                volunteer_item["packets_per_trip"] = payload.packets_per_trip
            if payload.availability:
                volunteer_item["availability"] = payload.availability
            self._volunteers.put_item(Item=volunteer_item)
        self._signups.put_item(Item={k: v for k, v in item.items() if v is not None})
        return signup_id

    def list_signups(self, status: str) -> list[dict]:
        resp = self._signups.query(
            IndexName="status-index", KeyConditionExpression=Key("status").eq(status)
        )
        return resp.get("Items", [])

    def approve_signup(self, signup_id: str) -> tuple[str, str]:
        resp = self._signups.get_item(Key={"signup_id": signup_id})
        signup = resp.get("Item")
        if not signup or signup.get("status") != "requested_signoff":
            raise ValueError("Signup not found or not pending")

        name = signup.get("name") or "Anonymous"
        email = signup["email"]
        donor_id = uuid.uuid4().hex
        self._donors.put_item(
            Item={
                "donor_id": donor_id,
                "name": name,
                "location": signup.get("location", ""),
                "story": signup.get("donor_story", ""),
                "email": email,
                "total_meals": 0,
                "donation_count": 0,
            }
        )
        self._signups.update_item(
            Key={"signup_id": signup_id},
            UpdateExpression="SET #s = :approved",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":approved": "approved"},
        )
        return name, email

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
        item = {
            "submission_id": submission_id,
            "user_id": submitted_by_user_id,
            "donor_id": donor_id,
            "location": location,
            "meals": meals,
            "photo_key": photo_key,
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
        self._submissions.put_item(Item=item)
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

    def provision_dummy_donor(self, user_id: str, email: str, name: str) -> str:
        existing = self.resolve_donor_id(user_id, email)
        if existing:
            return existing
        donor_id = uuid.uuid4().hex
        self._donors.put_item(
            Item={
                "donor_id": donor_id,
                "name": name,
                "location": "Austin, TX",
                "story": "Testing the donor dashboard locally.",
                "email": email,
                "user_id": user_id,
                "total_meals": 50,
                "donation_count": 1,
            }
        )
        self._donations.put_item(
            Item={
                "donor_id": donor_id,
                "donation_id": uuid.uuid4().hex,
                "date": _now()[:10],
                "location": "Austin, TX",
                "meals": 50,
                "caption": "Sample delivery for local testing.",
                "status": "approved",
            }
        )
        return donor_id

    def provision_dummy_volunteer(self, user_id: str, email: str, name: str) -> str:
        existing = self.resolve_volunteer_id(user_id, email)
        if existing:
            return existing
        volunteer_id = uuid.uuid4().hex
        self._volunteers.put_item(
            Item={
                "volunteer_id": volunteer_id,
                "name": name,
                "location": "Austin, TX",
                "email": email,
                "user_id": user_id,
                "packets_per_trip": 20,
                "availability": "Weekends",
            }
        )
        return volunteer_id

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
                    "photo_url": blob.presign_get(s["photo_key"]),
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
        approved_key = blob.copy_to_approved(s["photo_key"], donation_id)
        donor_id = s["donor_id"]

        donation_item = {
            "donor_id": donor_id,
            "donation_id": donation_id,
            "date": s["created_at"][:10],
            "location": s["location"],
            "meals": s["meals"],
            "caption": s.get("caption", ""),
            "photo_key": approved_key,
            "status": "approved",
        }
        if s.get("delivery_role"):
            donation_item["delivery_role"] = s["delivery_role"]
        if s.get("partner_charity"):
            donation_item["partner_charity"] = s["partner_charity"]

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

    def reject_submission(self, submission_id: str) -> None:
        self._submissions.update_item(
            Key={"submission_id": submission_id},
            UpdateExpression="SET #s = :rejected",
            ConditionExpression="#s = :pending",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":rejected": "rejected", ":pending": "pending"},
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
