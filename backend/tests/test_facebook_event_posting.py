"""Covers specs/features/033-facebook-event-posting — a manual, admin-only
action posts an approved submission's cover photo to Facebook, guarded
against double-posting and against posting before approval."""

from tests.conftest import sign_in_as

ADMIN_EMAIL = "admin@example.com"
DONOR_EMAIL = "facebook-donor@example.com"


def _approve_donor(client) -> None:
    sign_in_as(client, DONOR_EMAIL, "Facebook Donor")
    resp = client.post(
        "/api/signups",
        json={
            "mode": "donor",
            "location": "Austin, TX",
            "country": "United States",
            "packet_count": 100,
            "delivery_role": "self",
            "donor_story": "Testing Facebook posting.",
            "commit_50k_4yr": True,
            "agree_publish_story": True,
        },
    )
    assert resp.status_code == 200
    signup_id = resp.json()["signup_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/signups/{signup_id}/approve")
    assert resp.status_code == 204

    sign_in_as(client, DONOR_EMAIL, "Facebook Donor")


def _create_submission(client) -> str:
    resp = client.post(
        "/api/uploads/presign", json={"content_type": "image/jpeg", "size": 1000}
    )
    assert resp.status_code == 200
    key = resp.json()["key"]

    resp = client.post(
        "/api/submissions",
        json={"location": "East Austin", "meals": 90, "photo_keys": [key]},
    )
    assert resp.status_code == 200
    return resp.json()["submission_id"]


class _FakeFacebookPoster:
    def __init__(self):
        self.calls = []

    def post_photo(self, image_url: str, message: str) -> str:
        self.calls.append((image_url, message))
        return "fake-page-id_fake-post-id"


def _configure_fake_facebook(monkeypatch):
    fake = _FakeFacebookPoster()
    monkeypatch.setattr("app.routers.admin.is_facebook_configured", lambda: True)
    monkeypatch.setattr("app.routers.admin.get_facebook_poster", lambda: fake)
    return fake


def test_post_to_facebook_requires_approval_first(client, monkeypatch):
    _configure_fake_facebook(monkeypatch)
    _approve_donor(client)
    submission_id = _create_submission(client)

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/submissions/{submission_id}/post-to-facebook")
    assert resp.status_code == 409


def test_post_to_facebook_not_configured_returns_400(client):
    # No monkeypatch — the test environment has no FACEBOOK_PAGE_ID /
    # FACEBOOK_PAGE_ACCESS_TOKEN set, same "not configured" situation as
    # Google OAuth / Geoapify.
    _approve_donor(client)
    submission_id = _create_submission(client)

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/submissions/{submission_id}/approve")
    assert resp.status_code == 204

    resp = client.post(f"/api/admin/submissions/{submission_id}/post-to-facebook")
    assert resp.status_code == 400


def test_post_to_facebook_succeeds_after_approval_and_is_idempotent(
    client, monkeypatch
):
    fake = _configure_fake_facebook(monkeypatch)
    _approve_donor(client)
    submission_id = _create_submission(client)

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/submissions/{submission_id}/approve")
    assert resp.status_code == 204

    resp = client.post(f"/api/admin/submissions/{submission_id}/post-to-facebook")
    assert resp.status_code == 200
    post_id = resp.json()["facebook_post_id"]
    assert post_id == "fake-page-id_fake-post-id"
    assert len(fake.calls) == 1
    image_url, message = fake.calls[0]
    assert image_url  # the approved (public) cover photo URL, not a presigned one
    assert "http" in message  # site link appended, so Facebook auto-links it

    resp = client.get("/api/admin/submissions?status=approved")
    assert resp.status_code == 200
    [approved] = resp.json()
    assert approved["facebook_post_id"] == post_id

    # Posting again on the same submission is rejected, not double-posted.
    resp = client.post(f"/api/admin/submissions/{submission_id}/post-to-facebook")
    assert resp.status_code == 409
    assert len(fake.calls) == 1


def test_post_to_facebook_404s_for_unknown_submission(client, monkeypatch):
    _configure_fake_facebook(monkeypatch)
    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post("/api/admin/submissions/does-not-exist/post-to-facebook")
    assert resp.status_code == 404
