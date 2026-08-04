"""Covers specs/features/017-cancel-donation-events — a donor can cancel
their own scheduled donation event, an admin can cancel anyone's, a
cancelled event drops out of the public GET /api/content feed but stays
visible (marked cancelled) elsewhere, and cancelling is blocked once proof
has already been submitted."""

from tests.conftest import sign_in_as

ADMIN_EMAIL = "admin@example.com"
DONOR_EMAIL = "cancel-donor@example.com"
OTHER_DONOR_EMAIL = "other-cancel-donor@example.com"


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
            "donor_story": "Testing cancel flow.",
            "commit_50k_4yr": True,
            "agree_publish_story": True,
        },
    )
    assert resp.status_code == 200
    signup_id = resp.json()["signup_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/signups/{signup_id}/approve")
    assert resp.status_code == 204


def _schedule_event(client, donor_email: str, donor_name: str) -> str:
    _approve_donor(client, donor_email, donor_name)
    sign_in_as(client, donor_email, donor_name)
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
    return resp.json()["id"]


def test_donor_can_cancel_their_own_scheduled_event(client):
    event_id = _schedule_event(client, DONOR_EMAIL, "Cancel Donor")

    sign_in_as(client, DONOR_EMAIL, "Cancel Donor")
    resp = client.post(f"/api/donation-events/{event_id}/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


def test_cancelled_event_excluded_from_public_content(client):
    event_id = _schedule_event(client, DONOR_EMAIL, "Cancel Donor")

    resp = client.get("/api/content")
    assert event_id in [e["id"] for e in resp.json()["donationEvents"]]

    sign_in_as(client, DONOR_EMAIL, "Cancel Donor")
    resp = client.post(f"/api/donation-events/{event_id}/cancel")
    assert resp.status_code == 200

    resp = client.get("/api/content")
    assert event_id not in [e["id"] for e in resp.json()["donationEvents"]]


def test_cancelled_event_still_visible_on_donors_own_dashboard(client):
    event_id = _schedule_event(client, DONOR_EMAIL, "Cancel Donor")

    sign_in_as(client, DONOR_EMAIL, "Cancel Donor")
    client.post(f"/api/donation-events/{event_id}/cancel")

    resp = client.get("/api/donation-events/mine")
    assert resp.status_code == 200
    events = {e["id"]: e for e in resp.json()}
    assert events[event_id]["status"] == "cancelled"


def test_admin_can_cancel_any_donors_event(client):
    event_id = _schedule_event(client, DONOR_EMAIL, "Cancel Donor")

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/donation-events/{event_id}/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"


def test_other_donor_cannot_cancel_someone_elses_event(client):
    event_id = _schedule_event(client, DONOR_EMAIL, "Cancel Donor")
    _approve_donor(client, OTHER_DONOR_EMAIL, "Other Donor")

    sign_in_as(client, OTHER_DONOR_EMAIL, "Other Donor")
    resp = client.post(f"/api/donation-events/{event_id}/cancel")
    assert resp.status_code == 403


def test_non_donor_cannot_cancel_an_event(client):
    event_id = _schedule_event(client, DONOR_EMAIL, "Cancel Donor")

    sign_in_as(client, "random-visitor@example.com", "Random Visitor")
    resp = client.post(f"/api/donation-events/{event_id}/cancel")
    assert resp.status_code == 403


def test_cannot_cancel_an_already_submitted_event(client):
    event_id = _schedule_event(client, DONOR_EMAIL, "Cancel Donor")

    sign_in_as(client, DONOR_EMAIL, "Cancel Donor")
    resp = client.post(
        "/api/submissions",
        json={
            "location": "East Austin",
            "meals": 50,
            "photo_key": "uploads/fake-cancel-key.jpg",
            "donation_event_id": event_id,
        },
    )
    assert resp.status_code == 200

    resp = client.post(f"/api/donation-events/{event_id}/cancel")
    assert resp.status_code == 409


def test_cannot_cancel_an_already_cancelled_event(client):
    event_id = _schedule_event(client, DONOR_EMAIL, "Cancel Donor")

    sign_in_as(client, DONOR_EMAIL, "Cancel Donor")
    resp = client.post(f"/api/donation-events/{event_id}/cancel")
    assert resp.status_code == 200

    resp = client.post(f"/api/donation-events/{event_id}/cancel")
    assert resp.status_code == 409


def test_cancel_nonexistent_event_404s(client):
    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post("/api/donation-events/does-not-exist/cancel")
    assert resp.status_code == 404
