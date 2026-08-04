"""Covers specs/features/019-dashboard-profile-tab-and-proof-relocation —
scheduling a donation event accepts the same signup-style detail (packet
count, delivery role, partner charity, notes) minus whatever now lives on
the donor's Profile tab (location/country/story), and those fields
round-trip through GET /api/donation-events/mine. All of them stay
optional — a donor can still schedule with just the required fields
(location, date, start_time, end_time — see
specs/features/023-event-location-time-and-sharing/requirements.md)."""

from tests.conftest import sign_in_as

ADMIN_EMAIL = "admin@example.com"
DONOR_EMAIL = "event-fields-donor@example.com"


def _approve_donor(client, email: str, name: str) -> None:
    sign_in_as(client, email, name)
    resp = client.post(
        "/api/signups",
        json={
            "mode": "donor",
            "location": "Austin, TX",
            "country": "United States",
            "packet_count": 100,
            "delivery_role": "self",
            "donor_story": "Testing donation event fields.",
            "commit_50k_4yr": True,
            "agree_publish_story": True,
        },
    )
    assert resp.status_code == 200
    signup_id = resp.json()["signup_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/signups/{signup_id}/approve")
    assert resp.status_code == 204


def test_donation_event_accepts_and_returns_new_optional_fields(client):
    _approve_donor(client, DONOR_EMAIL, "Event Fields Donor")

    sign_in_as(client, DONOR_EMAIL, "Event Fields Donor")
    resp = client.post(
        "/api/donation-events",
        json={
            "location": "East Austin",
            "date": "2026-09-01",
            "start_time": "09:00",
            "end_time": "11:00",
            "packet_count": 75,
            "delivery_role": "volunteer_needed",
            "partner_charity": "Central Texas Food Bank",
            "notes": "Leave packets at the front desk.",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["packetCount"] == 75
    assert body["deliveryRole"] == "volunteer_needed"
    assert body["partnerCharity"] == "Central Texas Food Bank"
    assert body["notes"] == "Leave packets at the front desk."

    resp = client.get("/api/donation-events/mine")
    assert resp.status_code == 200
    events = {e["id"]: e for e in resp.json()}
    event = events[body["id"]]
    assert event["packetCount"] == 75
    assert event["deliveryRole"] == "volunteer_needed"
    assert event["partnerCharity"] == "Central Texas Food Bank"
    assert event["notes"] == "Leave packets at the front desk."


def test_donation_event_still_works_with_only_required_fields(client):
    _approve_donor(client, DONOR_EMAIL, "Event Fields Donor")

    sign_in_as(client, DONOR_EMAIL, "Event Fields Donor")
    resp = client.post(
        "/api/donation-events",
        json={
            "location": "East Austin",
            "date": "2026-09-01",
            "start_time": "09:00",
            "end_time": "11:00",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["packetCount"] is None
    assert body["deliveryRole"] is None
    assert body["partnerCharity"] is None
    assert body["notes"] is None
