"""Covers specs/features/016-admin-membership-status — the admin
donors/volunteers/events directory, the disable/reactivate toggle, its
effect on public-facing data (GET /api/content, GET /api/donors/{id}), and
login gating for a disabled donor/volunteer."""

from tests.conftest import attach_session_cookie_from_response, sign_in_as

ADMIN_EMAIL = "admin@example.com"


def _approve_donor(client, name: str, email: str) -> str:
    """Returns the new donor_id. Deliberately doesn't sign in as the donor
    afterward (that would claim the row for the sign_in_as-issued fake
    user_id via resolve_donor_id's find-or-claim-by-email path, which would
    then block a *real* later claim — e.g. a dummy-login test — under a
    different user_id). Looks the id up via the admin directory instead,
    which doesn't claim anything."""
    sign_in_as(client, email, name)
    resp = client.post(
        "/api/signups",
        json={
            "mode": "donor",
            "location": "Austin, TX",
            "country": "United States",
            "packet_count": 100,
            "delivery_role": "self",
            "donor_story": "Testing membership status.",
            "commit_50k_4yr": True,
            "agree_publish_story": True,
        },
    )
    assert resp.status_code == 200
    signup_id = resp.json()["signup_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/signups/{signup_id}/approve")
    assert resp.status_code == 204

    resp = client.get("/api/admin/donors")
    return next(r["donor_id"] for r in resp.json() if r["email"] == email)


def _approve_volunteer(client, name: str, email: str) -> str:
    """Returns the new volunteer_id. Same claim-avoidance rationale as
    _approve_donor."""
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

    resp = client.get("/api/admin/volunteers")
    return next(r["volunteer_id"] for r in resp.json() if r["email"] == email)


def test_approved_donor_appears_active_in_admin_directory(client):
    donor_id = _approve_donor(client, "Dana Donor", "dana@example.com")

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.get("/api/admin/donors")
    assert resp.status_code == 200
    rows = {r["donor_id"]: r for r in resp.json()}
    assert rows[donor_id]["status"] == "active"
    assert rows[donor_id]["email"] == "dana@example.com"


def test_approved_volunteer_appears_active_in_admin_directory(client):
    volunteer_id = _approve_volunteer(client, "Val Volunteer", "val@example.com")

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.get("/api/admin/volunteers")
    assert resp.status_code == 200
    rows = {r["volunteer_id"]: r for r in resp.json()}
    assert rows[volunteer_id]["status"] == "active"
    assert rows[volunteer_id]["email"] == "val@example.com"


def test_disabling_donor_removes_from_public_content_and_detail(client):
    donor_id = _approve_donor(client, "Removable Donor", "removable@example.com")

    resp = client.get("/api/content")
    assert donor_id in [d["id"] for d in resp.json()["donors"]]
    assert client.get(f"/api/donors/{donor_id}").status_code == 200

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/donors/{donor_id}/disable")
    assert resp.status_code == 204

    resp = client.get("/api/content")
    assert donor_id not in [d["id"] for d in resp.json()["donors"]]
    assert client.get(f"/api/donors/{donor_id}").status_code == 404

    # Still visible (as disabled) to the admin.
    resp = client.get("/api/admin/donors")
    rows = {r["donor_id"]: r for r in resp.json()}
    assert rows[donor_id]["status"] == "disabled"


def test_reactivating_donor_restores_public_visibility(client):
    donor_id = _approve_donor(client, "Restorable Donor", "restorable@example.com")

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    client.post(f"/api/admin/donors/{donor_id}/disable")
    resp = client.post(f"/api/admin/donors/{donor_id}/reactivate")
    assert resp.status_code == 204

    resp = client.get("/api/content")
    assert donor_id in [d["id"] for d in resp.json()["donors"]]
    assert client.get(f"/api/donors/{donor_id}").status_code == 200


def test_disabling_donor_excludes_their_donation_events_from_public_content(client):
    donor_id = _approve_donor(client, "Events Donor", "events-donor2@example.com")
    sign_in_as(client, "events-donor2@example.com", "Events Donor")
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
    assert event_id in [e["id"] for e in resp.json()["donationEvents"]]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    client.post(f"/api/admin/donors/{donor_id}/disable")

    resp = client.get("/api/content")
    assert event_id not in [e["id"] for e in resp.json()["donationEvents"]]

    # Admin's own events view is unfiltered — the event is still visible
    # there so the admin retains full context while the donor is disabled.
    resp = client.get("/api/admin/donation-events")
    assert resp.status_code == 200
    assert event_id in [e["id"] for e in resp.json()]


def test_disabling_volunteer_excludes_donor_event_from_public_content(client):
    donor_id = _approve_donor(client, "Paired Donor", "paired-donor@example.com")
    volunteer_id = _approve_volunteer(
        client, "Paired Volunteer", "paired-volunteer@example.com"
    )

    sign_in_as(client, "paired-donor@example.com", "Paired Donor")
    resp = client.post(
        "/api/donation-events",
        json={
            "location": "East Austin",
            "date": "2026-09-01",
            "start_time": "09:00",
            "end_time": "11:00",
            "volunteer_id": volunteer_id,
        },
    )
    assert resp.status_code == 200
    event_id = resp.json()["id"]

    resp = client.get("/api/content")
    assert event_id in [e["id"] for e in resp.json()["donationEvents"]]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    client.post(f"/api/admin/volunteers/{volunteer_id}/disable")

    resp = client.get("/api/content")
    assert event_id not in [e["id"] for e in resp.json()["donationEvents"]]
    assert donor_id in [d["id"] for d in resp.json()["donors"]]


def test_disabled_donor_cannot_sign_in_via_dummy_login(client):
    donor_id = _approve_donor(client, "Locked Out Donor", "locked-out@example.com")
    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    client.post(f"/api/admin/donors/{donor_id}/disable")
    client.cookies.clear()

    resp = client.post(
        "/api/auth/dummy",
        json={"username": "locked_out_donor", "password": "dummy_password"},
    )
    assert resp.status_code == 403
    assert "set-cookie" not in resp.headers


def test_reactivated_donor_can_sign_in_again(client):
    donor_id = _approve_donor(client, "Back Again Donor", "back-again@example.com")
    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    client.post(f"/api/admin/donors/{donor_id}/disable")
    client.post(f"/api/admin/donors/{donor_id}/reactivate")
    client.cookies.clear()

    resp = client.post(
        "/api/auth/dummy",
        json={"username": "back_again_donor", "password": "dummy_password"},
    )
    assert resp.status_code == 200
    attach_session_cookie_from_response(client, resp)
    assert client.get("/api/donors/me").status_code == 200


def test_disabled_volunteer_cannot_sign_in_via_dummy_login(client):
    volunteer_id = _approve_volunteer(
        client, "Locked Out Volunteer", "locked-out-vol@example.com"
    )
    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    client.post(f"/api/admin/volunteers/{volunteer_id}/disable")
    client.cookies.clear()

    resp = client.post(
        "/api/auth/dummy",
        json={"username": "locked_out_volunteer", "password": "dummy_password"},
    )
    assert resp.status_code == 403


def test_dummy_admin_shortcut_unaffected_by_membership_checks(client):
    resp = client.post(
        "/api/auth/dummy",
        json={"username": "dummy_user", "password": "dummy_password"},
    )
    assert resp.status_code == 200
    assert resp.json()["isAdmin"] is True


def test_non_admin_cannot_access_admin_membership_endpoints(client):
    sign_in_as(client, "regular-user@example.com", "Regular User")
    assert client.get("/api/admin/donors").status_code == 403
    assert client.get("/api/admin/volunteers").status_code == 403
    assert client.get("/api/admin/donation-events").status_code == 403
    assert client.post("/api/admin/donors/some-id/disable").status_code == 403
    assert client.post("/api/admin/volunteers/some-id/reactivate").status_code == 403
