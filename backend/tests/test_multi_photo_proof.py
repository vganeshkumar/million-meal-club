"""Covers specs/features/025-multi-photo-proof-with-cover — a submission
can carry 1-5 photos with a chosen cover, and that cover/full list
round-trips through approval onto both the donor's own Donation and (when
linked) the public DonationEvent."""

from tests.conftest import sign_in_as

ADMIN_EMAIL = "admin@example.com"
DONOR_EMAIL = "multi-photo-donor@example.com"


def _approve_donor(client) -> None:
    sign_in_as(client, DONOR_EMAIL, "Multi Photo Donor")
    resp = client.post(
        "/api/signups",
        json={
            "mode": "donor",
            "location": "Austin, TX",
            "country": "United States",
            "packet_count": 100,
            "delivery_role": "self",
            "donor_story": "Testing multi-photo proof.",
            "commit_50k_4yr": True,
            "agree_publish_story": True,
        },
    )
    assert resp.status_code == 200
    signup_id = resp.json()["signup_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/signups/{signup_id}/approve")
    assert resp.status_code == 204

    sign_in_as(client, DONOR_EMAIL, "Multi Photo Donor")


def _presign_n(client, n: int) -> list[str]:
    keys = []
    for _ in range(n):
        resp = client.post(
            "/api/uploads/presign",
            json={"content_type": "image/jpeg", "size": 1000},
        )
        assert resp.status_code == 200
        keys.append(resp.json()["key"])
    return keys


def test_submission_with_multiple_photos_and_chosen_cover_round_trips(client):
    _approve_donor(client)
    keys = _presign_n(client, 3)

    resp = client.post(
        "/api/submissions",
        json={
            "location": "East Austin",
            "meals": 120,
            "photo_keys": keys,
            "cover_photo_key": keys[1],
        },
    )
    assert resp.status_code == 200
    submission_id = resp.json()["submission_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.get("/api/admin/submissions?status=pending")
    assert resp.status_code == 200
    [pending] = resp.json()
    assert len(pending["photo_urls"]) == 3
    assert pending["cover_photo_url"] != pending["photo_urls"][0]

    resp = client.post(f"/api/admin/submissions/{submission_id}/approve")
    assert resp.status_code == 204

    sign_in_as(client, DONOR_EMAIL, "Multi Photo Donor")
    resp = client.get("/api/donors/me")
    assert resp.status_code == 200
    [donation] = resp.json()["donations"]
    assert len(donation["photoUrls"]) == 3
    # The approved cover is the 2nd photo's approved copy, not the 1st.
    assert donation["coverPhotoUrl"] == donation["photoUrls"][1]


def test_scheduled_event_gets_photo_urls_and_cover_on_approval(client):
    _approve_donor(client)
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

    keys = _presign_n(client, 2)
    resp = client.post(
        "/api/submissions",
        json={
            "location": "East Austin",
            "meals": 80,
            "photo_keys": keys,
            "donation_event_id": event_id,
        },
    )
    assert resp.status_code == 200
    submission_id = resp.json()["submission_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/submissions/{submission_id}/approve")
    assert resp.status_code == 204

    resp = client.get("/api/content")
    events = {e["id"]: e for e in resp.json()["donationEvents"]}
    event = events[event_id]
    assert event["status"] == "completed"
    assert len(event["photoUrls"]) == 2
    # cover_photo_key omitted -> defaults to the first photo.
    assert event["coverPhotoUrl"] == event["photoUrls"][0]


def test_submission_rejects_zero_photos(client):
    _approve_donor(client)
    resp = client.post(
        "/api/submissions",
        json={"location": "East Austin", "meals": 50, "photo_keys": []},
    )
    assert resp.status_code == 422


def test_submission_rejects_more_than_five_photos(client):
    _approve_donor(client)
    resp = client.post(
        "/api/submissions",
        json={
            "location": "East Austin",
            "meals": 50,
            "photo_keys": [f"pending/fake/{i}.jpg" for i in range(6)],
        },
    )
    assert resp.status_code == 422


def test_submission_rejects_cover_not_in_photo_keys(client):
    _approve_donor(client)
    resp = client.post(
        "/api/submissions",
        json={
            "location": "East Austin",
            "meals": 50,
            "photo_keys": ["pending/fake/a.jpg", "pending/fake/b.jpg"],
            "cover_photo_key": "pending/fake/not-in-list.jpg",
        },
    )
    assert resp.status_code == 422
