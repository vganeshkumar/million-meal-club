"""Covers specs/features/032-donor-joined-date-fallback — a donor's
approval date is recorded and returned by both GET /api/donors/{id} and
GET /api/donors/me, so the frontend can show "Joined <date>" in place of
an empty delivery list."""

from tests.conftest import sign_in_as

ADMIN_EMAIL = "admin@example.com"
DONOR_EMAIL = "joined-date-donor@example.com"


def _approve_donor(client, email: str, name: str) -> str:
    """Returns the new donor_id."""
    sign_in_as(client, email, name)
    resp = client.post(
        "/api/signups",
        json={
            "mode": "donor",
            "location": "Austin, TX",
            "country": "United States",
            "packet_count": 100,
            "delivery_role": "self",
            "donor_story": "Testing joined date.",
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


def test_approving_a_donor_sets_created_at(client):
    donor_id = _approve_donor(client, DONOR_EMAIL, "Joined Date Donor")

    resp = client.get(f"/api/donors/{donor_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["createdAt"] is not None
    assert body["donations"] in (None, [])


def test_donor_me_also_returns_created_at(client):
    email = "joined-date-donor-me@example.com"
    _approve_donor(client, email, "Joined Date Donor Me")

    sign_in_as(client, email, "Joined Date Donor Me")
    resp = client.get("/api/donors/me")
    assert resp.status_code == 200
    assert resp.json()["createdAt"] is not None


def _presign(client) -> str:
    resp = client.post(
        "/api/uploads/presign", json={"content_type": "image/jpeg", "size": 1000}
    )
    assert resp.status_code == 200
    return resp.json()["key"]


def test_created_at_still_present_once_donor_has_donations(client):
    """The field isn't donation-count conditional on the backend — the
    frontend decides when to show it."""
    email = "joined-date-donor-with-donation@example.com"
    donor_id = _approve_donor(client, email, "Joined Date Donor With Donation")

    sign_in_as(client, email, "Joined Date Donor With Donation")
    key = _presign(client)
    resp = client.post(
        "/api/submissions",
        json={
            "location": "East Austin",
            "meals": 60,
            "photo_keys": [key],
            "cover_photo_key": key,
        },
    )
    assert resp.status_code == 200
    submission_id = resp.json()["submission_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/submissions/{submission_id}/approve")
    assert resp.status_code == 204

    resp = client.get(f"/api/donors/{donor_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["createdAt"] is not None
    assert len(body["donations"]) == 1
