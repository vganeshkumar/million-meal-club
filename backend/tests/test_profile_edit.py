"""Covers specs/features/018-profile-edit and
specs/features/024-volunteer-profile-full-fields — a signed-in donor can edit
their own location/country/story via PATCH /api/donors/me, a signed-in
volunteer can edit their own location/country/packets_per_trip/availability/
volunteering_history/references via PATCH /api/volunteers/me, and neither
works for a caller with no linked donor/volunteer record."""

from tests.conftest import sign_in_as

ADMIN_EMAIL = "admin@example.com"
DONOR_EMAIL = "profile-donor@example.com"
VOLUNTEER_EMAIL = "profile-volunteer@example.com"


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
            "donor_story": "Original story.",
            "commit_50k_4yr": True,
            "agree_publish_story": True,
        },
    )
    assert resp.status_code == 200
    signup_id = resp.json()["signup_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/signups/{signup_id}/approve")
    assert resp.status_code == 204


def _approve_volunteer(client, email: str, name: str) -> None:
    sign_in_as(client, email, name)
    resp = client.post(
        "/api/signups",
        json={
            "mode": "volunteer",
            "location": "Austin, TX",
            "country": "United States",
            "packets_per_trip": 20,
            "availability": "Weekends",
            "volunteering_history": "Helped at last year's food drive.",
            "references": "Jane Donor, jane@example.com",
        },
    )
    assert resp.status_code == 200
    signup_id = resp.json()["signup_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/signups/{signup_id}/approve")
    assert resp.status_code == 204


def test_donor_can_update_their_own_profile(client):
    _approve_donor(client, DONOR_EMAIL, "Profile Donor")

    sign_in_as(client, DONOR_EMAIL, "Profile Donor")
    resp = client.patch(
        "/api/donors/me",
        json={
            "location": "Round Rock, TX",
            "country": "Canada",
            "story": "Updated story.",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["location"] == "Round Rock, TX"
    assert body["country"] == "Canada"
    assert body["story"] == "Updated story."

    resp = client.get("/api/donors/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["location"] == "Round Rock, TX"
    assert body["country"] == "Canada"
    assert body["story"] == "Updated story."


def test_volunteer_can_update_their_own_profile(client):
    _approve_volunteer(client, VOLUNTEER_EMAIL, "Profile Volunteer")

    sign_in_as(client, VOLUNTEER_EMAIL, "Profile Volunteer")
    resp = client.patch(
        "/api/volunteers/me",
        json={
            "location": "Cedar Park, TX",
            "country": "Mexico",
            "packets_per_trip": 35,
            "availability": "Weekday evenings",
            "volunteering_history": "Also helped with the spring drive.",
            "references": "John Donor, john@example.com",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["location"] == "Cedar Park, TX"
    assert body["country"] == "Mexico"
    assert body["packetsPerTrip"] == 35
    assert body["availability"] == "Weekday evenings"
    assert body["volunteeringHistory"] == "Also helped with the spring drive."
    assert body["references"] == "John Donor, john@example.com"

    resp = client.get("/api/volunteers/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["location"] == "Cedar Park, TX"
    assert body["country"] == "Mexico"
    assert body["packetsPerTrip"] == 35
    assert body["availability"] == "Weekday evenings"
    assert body["volunteeringHistory"] == "Also helped with the spring drive."
    assert body["references"] == "John Donor, john@example.com"


def test_volunteer_profile_prefills_with_signup_fields_after_approval(client):
    _approve_volunteer(client, VOLUNTEER_EMAIL, "Profile Volunteer")

    sign_in_as(client, VOLUNTEER_EMAIL, "Profile Volunteer")
    resp = client.get("/api/volunteers/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["packetsPerTrip"] == 20
    assert body["availability"] == "Weekends"
    assert body["volunteeringHistory"] == "Helped at last year's food drive."
    assert body["references"] == "Jane Donor, jane@example.com"


def test_volunteer_directory_omits_private_application_fields(client):
    _approve_volunteer(client, VOLUNTEER_EMAIL, "Profile Volunteer")
    _approve_donor(client, DONOR_EMAIL, "Profile Donor")

    sign_in_as(client, DONOR_EMAIL, "Profile Donor")
    resp = client.get("/api/volunteers")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) >= 1
    for entry in body:
        assert "volunteeringHistory" not in entry
        assert "references" not in entry


def test_update_donor_profile_requires_a_linked_donor(client):
    sign_in_as(client, "random-visitor@example.com", "Random Visitor")
    resp = client.patch(
        "/api/donors/me",
        json={"location": "Nowhere", "country": "United States", "story": "n/a"},
    )
    assert resp.status_code == 404


def test_update_volunteer_profile_requires_a_linked_volunteer(client):
    sign_in_as(client, "random-visitor@example.com", "Random Visitor")
    resp = client.patch(
        "/api/volunteers/me",
        json={
            "location": "Nowhere",
            "country": "United States",
            "packets_per_trip": 10,
            "availability": "Anytime",
        },
    )
    assert resp.status_code == 404


def test_update_donor_profile_rejects_missing_fields(client):
    _approve_donor(client, DONOR_EMAIL, "Profile Donor")

    sign_in_as(client, DONOR_EMAIL, "Profile Donor")
    resp = client.patch(
        "/api/donors/me",
        json={"location": "Round Rock, TX", "country": "Canada"},
    )
    assert resp.status_code == 422


def test_donor_profile_update_does_not_affect_another_donor(client):
    _approve_donor(client, DONOR_EMAIL, "Profile Donor")
    _approve_donor(client, "other-" + DONOR_EMAIL, "Other Profile Donor")

    sign_in_as(client, DONOR_EMAIL, "Profile Donor")
    client.patch(
        "/api/donors/me",
        json={
            "location": "Round Rock, TX",
            "country": "Canada",
            "story": "Updated story.",
        },
    )

    sign_in_as(client, "other-" + DONOR_EMAIL, "Other Profile Donor")
    resp = client.get("/api/donors/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["location"] == "Austin, TX"
    assert body["country"] == "United States"
    assert body["story"] == "Original story."
