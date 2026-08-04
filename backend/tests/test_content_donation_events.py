"""Covers specs/features/014-homepage-scheduled-events — GET /api/content
must include every donation event (any donor), reflecting status changes
as proof is submitted/approved against them."""

from tests.conftest import sign_in_as

DONOR_EMAIL = "events-donor@example.com"
VOLUNTEER_EMAIL = "events-volunteer@example.com"


def _approve_donor_application(client) -> None:
    sign_in_as(client, DONOR_EMAIL, "Events Donor")
    resp = client.post(
        "/api/signups",
        json={
            "mode": "donor",
            "location": "Austin, TX",
            "country": "United States",
            "packet_count": 100,
            "delivery_role": "self",
            "donor_story": "Testing homepage events.",
            "commit_50k_4yr": True,
            "agree_publish_story": True,
        },
    )
    assert resp.status_code == 200
    signup_id = resp.json()["signup_id"]

    sign_in_as(client, "admin@example.com", "Test Admin")
    resp = client.post(f"/api/admin/signups/{signup_id}/approve")
    assert resp.status_code == 204

    # Claim it: sign back in as the donor so future calls resolve to the
    # newly-created Donors row.
    sign_in_as(client, DONOR_EMAIL, "Events Donor")
    resp = client.get("/api/auth/me")
    assert resp.json()["isDonor"] is True


def test_content_has_no_donation_events_by_default(client):
    resp = client.get("/api/content")
    assert resp.status_code == 200
    assert resp.json()["donationEvents"] == []


def test_scheduled_donation_event_appears_in_public_content(client):
    _approve_donor_application(client)

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
    event_id = resp.json()["id"]

    resp = client.get("/api/content")
    events = resp.json()["donationEvents"]
    assert len(events) == 1
    assert events[0]["id"] == event_id
    assert events[0]["status"] == "scheduled"
    assert events[0]["donorName"] == "Events Donor"


def test_donation_event_moves_to_submitted_after_proof(client):
    _approve_donor_application(client)

    resp = client.post(
        "/api/donation-events",
        json={
            "location": "East Austin",
            "date": "2026-09-01",
            "start_time": "09:00",
            "end_time": "11:00",
        },
    )
    event_id = resp.json()["id"]

    resp = client.post(
        "/api/submissions",
        json={
            "location": "East Austin",
            "meals": 100,
            "photo_key": "uploads/fake-key.jpg",
            "donation_event_id": event_id,
        },
    )
    assert resp.status_code == 200

    resp = client.get("/api/content")
    events = resp.json()["donationEvents"]
    assert len(events) == 1
    assert events[0]["id"] == event_id
    assert events[0]["status"] == "submitted"


def test_rejected_submission_reopens_donation_event_to_scheduled(client):
    _approve_donor_application(client)

    resp = client.post(
        "/api/donation-events",
        json={
            "location": "East Austin",
            "date": "2026-09-01",
            "start_time": "09:00",
            "end_time": "11:00",
        },
    )
    event_id = resp.json()["id"]

    resp = client.post(
        "/api/submissions",
        json={
            "location": "East Austin",
            "meals": 100,
            "photo_key": "uploads/fake-key-2.jpg",
            "donation_event_id": event_id,
        },
    )
    submission_id = resp.json()["submission_id"]

    sign_in_as(client, "admin@example.com", "Test Admin")
    resp = client.post(f"/api/admin/submissions/{submission_id}/reject")
    assert resp.status_code == 204

    resp = client.get("/api/content")
    events = resp.json()["donationEvents"]
    assert events[0]["status"] == "scheduled"
