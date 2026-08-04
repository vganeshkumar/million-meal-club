"""Covers specs/features/015-local-dev-generated-credentials — generated
Donor/Volunteer local usernames, collision handling, and the
POST /api/auth/dummy sign-in path built on top of them."""

from tests.conftest import attach_session_cookie_from_response, sign_in_as


def _approve_donor(client, name: str, email: str) -> None:
    sign_in_as(client, email, name)
    resp = client.post(
        "/api/signups",
        json={
            "mode": "donor",
            "location": "Austin, TX",
            "country": "United States",
            "packet_count": 100,
            "delivery_role": "self",
            "donor_story": "Testing generated credentials.",
            "commit_50k_4yr": True,
            "agree_publish_story": True,
        },
    )
    assert resp.status_code == 200
    signup_id = resp.json()["signup_id"]

    sign_in_as(client, "admin@example.com", "Test Admin")
    resp = client.post(f"/api/admin/signups/{signup_id}/approve")
    assert resp.status_code == 204


def _approve_volunteer(client, name: str, email: str) -> None:
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

    sign_in_as(client, "admin@example.com", "Test Admin")
    resp = client.post(f"/api/admin/signups/{signup_id}/approve")
    assert resp.status_code == 204


def test_approving_donor_generates_local_username(client):
    _approve_donor(client, "Jane Sharma", "jane@example.com")

    sign_in_as(client, "jane@example.com", "Jane Sharma")
    resp = client.get("/api/donors/me")
    assert resp.status_code == 200
    assert resp.json()["localUsername"] == "jane_sharma"


def test_approving_volunteer_generates_local_username(client):
    _approve_volunteer(client, "Val Rivera", "val@example.com")

    sign_in_as(client, "val@example.com", "Val Rivera")
    resp = client.get("/api/volunteers/me")
    assert resp.status_code == 200
    assert resp.json()["localUsername"] == "val_rivera"


def test_duplicate_names_get_distinct_suffixed_usernames(client):
    _approve_donor(client, "Sam Lee", "sam1@example.com")
    _approve_donor(client, "Sam Lee", "sam2@example.com")

    sign_in_as(client, "sam1@example.com", "Sam Lee")
    first = client.get("/api/donors/me").json()["localUsername"]
    sign_in_as(client, "sam2@example.com", "Sam Lee")
    second = client.get("/api/donors/me").json()["localUsername"]

    assert first == "sam_lee"
    assert second == "sam_lee2"


def test_public_donor_view_never_exposes_local_username(client):
    _approve_donor(client, "Public Donor", "public-donor@example.com")

    sign_in_as(client, "public-donor@example.com", "Public Donor")
    donor_id = client.get("/api/donors/me").json()["id"]

    resp = client.get(f"/api/donors/{donor_id}")
    assert resp.status_code == 200
    assert "localUsername" not in resp.json()


def test_dummy_login_with_generated_username_signs_in_as_that_donor(client):
    _approve_donor(client, "Login Donor", "login-donor@example.com")
    client.cookies.clear()  # drop the admin session left over from approving

    resp = client.post(
        "/api/auth/dummy",
        json={"username": "login_donor", "password": "dummy_password"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "login-donor@example.com"
    assert body["isDonor"] is True
    attach_session_cookie_from_response(client, resp)

    resp = client.get("/api/donors/me")
    assert resp.status_code == 200
    assert resp.json()["localUsername"] == "login_donor"


def test_dummy_login_with_generated_username_signs_in_as_that_volunteer(client):
    _approve_volunteer(client, "Login Volunteer", "login-volunteer@example.com")
    client.cookies.clear()  # drop the admin session left over from approving

    resp = client.post(
        "/api/auth/dummy",
        json={"username": "login_volunteer", "password": "dummy_password"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["isVolunteer"] is True
    attach_session_cookie_from_response(client, resp)

    resp = client.get("/api/volunteers/me")
    assert resp.status_code == 200
    assert resp.json()["localUsername"] == "login_volunteer"


def test_dummy_login_admin_shortcut_is_unaffected(client):
    resp = client.post(
        "/api/auth/dummy",
        json={"username": "dummy_user", "password": "dummy_password"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["isAdmin"] is True
    assert body["email"] == "admin@example.com"


def test_dummy_login_rejects_unknown_username(client):
    resp = client.post(
        "/api/auth/dummy",
        json={"username": "nobody_here", "password": "dummy_password"},
    )
    assert resp.status_code == 401


def test_dummy_login_rejects_wrong_password(client):
    _approve_donor(client, "Wrong Password", "wrong-password@example.com")
    resp = client.post(
        "/api/auth/dummy",
        json={"username": "wrong_password", "password": "not_the_password"},
    )
    assert resp.status_code == 401


def test_dummy_login_disabled_outside_local_dev(client, monkeypatch):
    monkeypatch.delenv("ENABLE_DUMMY_LOGIN", raising=False)
    resp = client.post(
        "/api/auth/dummy",
        json={"username": "dummy_user", "password": "dummy_password"},
    )
    assert resp.status_code == 404
