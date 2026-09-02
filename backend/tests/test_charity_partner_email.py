"""Covers specs/features/031-charity-partner-contact-email — a partner
charity's email is optional in storage, admin-settable via
POST/PATCH /admin/charities, and never reachable from any public route
(GET /api/content)."""

import json

from tests.conftest import sign_in_as

ADMIN_EMAIL = "admin@example.com"

MINIMAL_CHARITY = {
    "name": "Test Charity",
    "location": "Austin, TX",
    "description": "A charity for testing.",
    "core_services": "Food distribution",
}


def _create_charity(client, **overrides) -> dict:
    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post("/api/admin/charities", json={**MINIMAL_CHARITY, **overrides})
    assert resp.status_code == 201
    return resp.json()


def test_create_charity_with_email_stores_and_returns_it(client):
    body = _create_charity(client, email="contact@testcharity.org")
    assert body["email"] == "contact@testcharity.org"


def test_create_charity_without_email_succeeds_and_returns_null(client):
    body = _create_charity(client)
    assert body["email"] is None


def test_list_admin_charities_includes_email(client):
    created = _create_charity(client, email="contact@testcharity.org")

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.get("/api/admin/charities")
    assert resp.status_code == 200
    row = next(c for c in resp.json() if c["id"] == created["id"])
    assert row["email"] == "contact@testcharity.org"


def test_update_charity_can_set_email_on_one_that_had_none(client):
    created = _create_charity(client)
    assert created["email"] is None

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.patch(
        f"/api/admin/charities/{created['id']}",
        json={**MINIMAL_CHARITY, "email": "new@testcharity.org"},
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "new@testcharity.org"


def test_update_charity_can_change_an_existing_email(client):
    created = _create_charity(client, email="old@testcharity.org")

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.patch(
        f"/api/admin/charities/{created['id']}",
        json={**MINIMAL_CHARITY, "email": "new@testcharity.org"},
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "new@testcharity.org"


def test_public_content_never_carries_charity_email(client):
    """The one test that actually enforces the "never public" requirement
    — not just that the field is absent from the typed response, but that
    the literal string never appears anywhere in the raw public JSON for
    a charity that does have an email on file."""
    _create_charity(client, email="secret-contact@testcharity.org")

    resp = client.get("/api/content")
    assert resp.status_code == 200
    raw = json.dumps(resp.json())
    assert "secret-contact@testcharity.org" not in raw
    assert '"email"' not in raw

    charity = next(
        c
        for c in resp.json()["partnerCharities"]
        if c["name"] == MINIMAL_CHARITY["name"]
    )
    assert "email" not in charity


def test_list_admin_charities_requires_admin_session(client):
    resp = client.get("/api/admin/charities")
    assert resp.status_code in (401, 403)


def test_create_charity_requires_admin_session(client):
    resp = client.post("/api/admin/charities", json=MINIMAL_CHARITY)
    assert resp.status_code in (401, 403)
