"""Covers specs/features/023-event-location-time-and-sharing — scheduling
requires a valid start/end time range, the address is geocoded
best-effort (never blocking scheduling on failure), and there's a public
GET /api/donation-events/{id}/share page with Open Graph tags."""

from tests.conftest import sign_in_as

ADMIN_EMAIL = "admin@example.com"
DONOR_EMAIL = "share-donor@example.com"


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
            "donor_story": "Testing location/time/sharing.",
            "commit_50k_4yr": True,
            "agree_publish_story": True,
        },
    )
    assert resp.status_code == 200
    signup_id = resp.json()["signup_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/signups/{signup_id}/approve")
    assert resp.status_code == 204


def _schedule_event(client, start_time="09:00", end_time="11:00") -> str:
    _approve_donor(client, DONOR_EMAIL, "Share Donor")
    sign_in_as(client, DONOR_EMAIL, "Share Donor")
    resp = client.post(
        "/api/donation-events",
        json={
            "location": "700 Congress Ave, Austin, TX",
            "date": "2026-09-01",
            "start_time": start_time,
            "end_time": end_time,
        },
    )
    assert resp.status_code == 200
    return resp.json()["id"]


def test_create_rejects_end_time_before_start_time(client):
    _approve_donor(client, DONOR_EMAIL, "Share Donor")
    sign_in_as(client, DONOR_EMAIL, "Share Donor")
    resp = client.post(
        "/api/donation-events",
        json={
            "location": "700 Congress Ave, Austin, TX",
            "date": "2026-09-01",
            "start_time": "11:00",
            "end_time": "09:00",
        },
    )
    assert resp.status_code == 400


def test_create_rejects_equal_start_and_end_time(client):
    _approve_donor(client, DONOR_EMAIL, "Share Donor")
    sign_in_as(client, DONOR_EMAIL, "Share Donor")
    resp = client.post(
        "/api/donation-events",
        json={
            "location": "700 Congress Ave, Austin, TX",
            "date": "2026-09-01",
            "start_time": "09:00",
            "end_time": "09:00",
        },
    )
    assert resp.status_code == 400


def test_edit_rejects_end_time_before_start_time(client):
    event_id = _schedule_event(client)
    sign_in_as(client, DONOR_EMAIL, "Share Donor")
    resp = client.patch(
        f"/api/donation-events/{event_id}",
        json={
            "location": "700 Congress Ave, Austin, TX",
            "date": "2026-09-01",
            "start_time": "15:00",
            "end_time": "10:00",
        },
    )
    assert resp.status_code == 400


def test_created_event_has_time_range_and_geocoded_coordinates(client):
    event_id = _schedule_event(client)
    sign_in_as(client, DONOR_EMAIL, "Share Donor")
    resp = client.get("/api/donation-events/mine")
    event = {e["id"]: e for e in resp.json()}[event_id]
    assert event["startTime"] == "09:00"
    assert event["endTime"] == "11:00"
    assert event["latitude"] == 30.2672
    assert event["longitude"] == -97.7431


def test_scheduling_succeeds_even_when_geocoding_fails(client, monkeypatch):
    monkeypatch.setattr(
        "app.routers.donation_events.geocode", lambda address: None
    )
    event_id = _schedule_event(client)
    sign_in_as(client, DONOR_EMAIL, "Share Donor")
    resp = client.get("/api/donation-events/mine")
    event = {e["id"]: e for e in resp.json()}[event_id]
    assert event["latitude"] is None
    assert event["longitude"] is None


def test_share_page_returns_og_tags_for_a_scheduled_event(client, monkeypatch):
    monkeypatch.setattr(
        "app.routers.donation_events.GEOAPIFY_API_KEY", "test-key"
    )
    event_id = _schedule_event(client)
    resp = client.get(f"/api/donation-events/{event_id}/share")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/html")
    body = resp.text
    assert 'property="og:title"' in body
    assert 'property="og:description"' in body
    assert 'property="og:image"' in body
    assert "http-equiv=\"refresh\"" in body


def test_share_page_omits_og_image_when_not_geocoded(client, monkeypatch):
    monkeypatch.setattr(
        "app.routers.donation_events.GEOAPIFY_API_KEY", "test-key"
    )
    monkeypatch.setattr(
        "app.routers.donation_events.geocode", lambda address: None
    )
    event_id = _schedule_event(client)
    resp = client.get(f"/api/donation-events/{event_id}/share")
    assert resp.status_code == 200
    assert 'property="og:image"' not in resp.text


def test_share_page_omits_og_image_when_map_not_configured(client, monkeypatch):
    monkeypatch.setattr("app.routers.donation_events.GEOAPIFY_API_KEY", "")
    event_id = _schedule_event(client)
    resp = client.get(f"/api/donation-events/{event_id}/share")
    assert resp.status_code == 200
    assert 'property="og:image"' not in resp.text


def test_share_page_404s_for_nonexistent_event(client):
    resp = client.get("/api/donation-events/does-not-exist/share")
    assert resp.status_code == 404


def test_share_page_404s_for_a_cancelled_event(client):
    event_id = _schedule_event(client)
    sign_in_as(client, DONOR_EMAIL, "Share Donor")
    resp = client.post(f"/api/donation-events/{event_id}/cancel")
    assert resp.status_code == 200

    resp = client.get(f"/api/donation-events/{event_id}/share")
    assert resp.status_code == 404


def test_share_page_is_public_no_auth_required(client):
    event_id = _schedule_event(client)
    client.cookies.clear()
    resp = client.get(f"/api/donation-events/{event_id}/share")
    assert resp.status_code == 200
