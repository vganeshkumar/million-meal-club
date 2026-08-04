"""Sanity check for the pytest harness itself — confirms the app boots,
the store resets between tests, and the session-minting helper works."""

from tests.conftest import sign_in_as


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_content_is_seeded(client):
    resp = client.get("/api/content")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["donors"]) == 3
    assert len(body["events"]) == 3


def test_store_resets_between_tests(client):
    """If this ever sees more than the 3 seeded donors, fresh_store isn't
    actually resetting state between tests."""
    resp = client.post(
        "/api/signups",
        json={
            "mode": "donor",
            "name": "Smoke Donor",
            "email": "smoke-donor@example.com",
            "location": "Austin, TX",
            "country": "United States",
            "packet_count": 50,
            "delivery_role": "self",
            "donor_story": "Testing.",
            "commit_50k_4yr": True,
            "agree_publish_story": True,
        },
    )
    assert resp.status_code == 200
    resp = client.get("/api/content")
    assert len(resp.json()["donors"]) == 3  # unapproved — no new Donor row yet


def test_sign_in_as_helper_resolves_admin(client):
    sign_in_as(client, "admin@example.com", "Test Admin")
    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["isAdmin"] is True
