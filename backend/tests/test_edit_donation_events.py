"""Covers specs/features/022-edit-scheduled-donation-event — the donor who
owns a scheduled donation event, or the volunteer currently assigned to it,
can edit its detail via PATCH /api/donation-events/{id} while it's still
`scheduled`; nobody else can, and it's rejected once the event is no longer
`scheduled`."""

from tests.conftest import sign_in_as

ADMIN_EMAIL = "admin@example.com"
DONOR_EMAIL = "edit-donor@example.com"
OTHER_DONOR_EMAIL = "other-edit-donor@example.com"
VOLUNTEER_EMAIL = "edit-volunteer@example.com"
OTHER_VOLUNTEER_EMAIL = "other-edit-volunteer@example.com"

EDIT_PAYLOAD = {
    "location": "West Austin",
    "date": "2026-09-15",
    "start_time": "10:00",
    "end_time": "12:00",
    "packet_count": 75,
    "delivery_role": "self",
    "notes": "Updated notes.",
}


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
            "donor_story": "Testing edit flow.",
            "commit_50k_4yr": True,
            "agree_publish_story": True,
        },
    )
    assert resp.status_code == 200
    signup_id = resp.json()["signup_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/signups/{signup_id}/approve")
    assert resp.status_code == 204


def _approve_volunteer(client, email: str, name: str) -> str:
    sign_in_as(client, email, name)
    resp = client.post(
        "/api/signups",
        json={
            "mode": "volunteer",
            "location": "Austin, TX",
            "country": "United States",
            "packets_per_trip": 20,
            "availability": "Weekends",
        },
    )
    assert resp.status_code == 200
    signup_id = resp.json()["signup_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/signups/{signup_id}/approve")
    assert resp.status_code == 204

    sign_in_as(client, email, name)
    resp = client.get("/api/volunteers/me")
    assert resp.status_code == 200
    return resp.json()["id"]


def _schedule_event(
    client, donor_email: str, donor_name: str, volunteer_id: str | None = None
) -> str:
    _approve_donor(client, donor_email, donor_name)
    sign_in_as(client, donor_email, donor_name)
    body = {
        "location": "East Austin",
        "date": "2026-09-01",
        "start_time": "09:00",
        "end_time": "11:00",
    }
    if volunteer_id:
        body["volunteer_id"] = volunteer_id
    resp = client.post("/api/donation-events", json=body)
    assert resp.status_code == 200
    return resp.json()["id"]


def test_donor_can_edit_their_own_scheduled_event(client):
    event_id = _schedule_event(client, DONOR_EMAIL, "Edit Donor")

    sign_in_as(client, DONOR_EMAIL, "Edit Donor")
    resp = client.patch(f"/api/donation-events/{event_id}", json=EDIT_PAYLOAD)
    assert resp.status_code == 200
    body = resp.json()
    assert body["location"] == "West Austin"
    assert body["date"] == "2026-09-15"
    assert body["packetCount"] == 75
    assert body["deliveryRole"] == "self"
    assert body["notes"] == "Updated notes."
    assert body["status"] == "scheduled"


def test_edit_omits_optional_fields_clears_them(client):
    event_id = _schedule_event(client, DONOR_EMAIL, "Edit Donor")

    sign_in_as(client, DONOR_EMAIL, "Edit Donor")
    resp = client.patch(f"/api/donation-events/{event_id}", json=EDIT_PAYLOAD)
    assert resp.status_code == 200

    resp = client.patch(
        f"/api/donation-events/{event_id}",
        json={
            "location": "West Austin",
            "date": "2026-09-15",
            "start_time": "10:00",
            "end_time": "12:00",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["packetCount"] is None
    assert body["deliveryRole"] is None
    assert body["notes"] is None


def test_assigned_volunteer_can_edit_the_event(client):
    volunteer_id = _approve_volunteer(client, VOLUNTEER_EMAIL, "Edit Volunteer")
    event_id = _schedule_event(client, DONOR_EMAIL, "Edit Donor", volunteer_id)

    sign_in_as(client, VOLUNTEER_EMAIL, "Edit Volunteer")
    resp = client.patch(f"/api/donation-events/{event_id}", json=EDIT_PAYLOAD)
    assert resp.status_code == 200
    assert resp.json()["location"] == "West Austin"


def test_unassigned_volunteer_cannot_edit_the_event(client):
    _approve_volunteer(client, OTHER_VOLUNTEER_EMAIL, "Other Volunteer")
    event_id = _schedule_event(client, DONOR_EMAIL, "Edit Donor")

    sign_in_as(client, OTHER_VOLUNTEER_EMAIL, "Other Volunteer")
    resp = client.patch(f"/api/donation-events/{event_id}", json=EDIT_PAYLOAD)
    assert resp.status_code == 403


def test_other_donor_cannot_edit_someone_elses_event(client):
    event_id = _schedule_event(client, DONOR_EMAIL, "Edit Donor")
    _approve_donor(client, OTHER_DONOR_EMAIL, "Other Donor")

    sign_in_as(client, OTHER_DONOR_EMAIL, "Other Donor")
    resp = client.patch(f"/api/donation-events/{event_id}", json=EDIT_PAYLOAD)
    assert resp.status_code == 403


def test_cannot_edit_an_already_submitted_event(client):
    event_id = _schedule_event(client, DONOR_EMAIL, "Edit Donor")

    sign_in_as(client, DONOR_EMAIL, "Edit Donor")
    resp = client.post(
        "/api/submissions",
        json={
            "location": "East Austin",
            "meals": 50,
            "photo_keys": ["uploads/fake-edit-key.jpg"],
            "donation_event_id": event_id,
        },
    )
    assert resp.status_code == 200

    resp = client.patch(f"/api/donation-events/{event_id}", json=EDIT_PAYLOAD)
    assert resp.status_code == 409


def test_cannot_edit_a_cancelled_event(client):
    event_id = _schedule_event(client, DONOR_EMAIL, "Edit Donor")

    sign_in_as(client, DONOR_EMAIL, "Edit Donor")
    resp = client.post(f"/api/donation-events/{event_id}/cancel")
    assert resp.status_code == 200

    resp = client.patch(f"/api/donation-events/{event_id}", json=EDIT_PAYLOAD)
    assert resp.status_code == 409


def test_edit_nonexistent_event_404s(client):
    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.patch("/api/donation-events/does-not-exist", json=EDIT_PAYLOAD)
    assert resp.status_code == 404
