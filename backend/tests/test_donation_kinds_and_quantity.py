"""Covers specs/features/034-donation-kinds-and-quantity — the shared,
ever-growing list of donation kinds, kind required on signup/submission,
and the public per-kind running-total breakdown."""

from tests.conftest import sign_in_as

ADMIN_EMAIL = "admin@example.com"
DONOR_EMAIL = "kinds-donor@example.com"


def _approve_donor(client, kind: str = "Food Packets") -> None:
    sign_in_as(client, DONOR_EMAIL, "Kinds Donor")
    resp = client.post(
        "/api/signups",
        json={
            "mode": "donor",
            "location": "Austin, TX",
            "country": "United States",
            "kind": kind,
            "quantity": 100,
            "delivery_role": "self",
            "donor_story": "Testing donation kinds.",
            "commit_50k_4yr": True,
            "agree_publish_story": True,
        },
    )
    assert resp.status_code == 200
    signup_id = resp.json()["signup_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/signups/{signup_id}/approve")
    assert resp.status_code == 204

    sign_in_as(client, DONOR_EMAIL, "Kinds Donor")


def test_content_starter_kinds_include_food_packets_first(client):
    resp = client.get("/api/content")
    assert resp.status_code == 200
    kinds = resp.json()["kinds"]
    assert kinds[0] == "Food Packets"
    assert "Medicine" in kinds


def test_typing_a_new_kind_at_signup_makes_it_selectable_afterward(client):
    _approve_donor(client, kind="School Lab Equipment")

    resp = client.get("/api/content")
    assert "School Lab Equipment" in resp.json()["kinds"]


def test_submission_requires_kind(client):
    _approve_donor(client)
    resp = client.post(
        "/api/uploads/presign", json={"content_type": "image/jpeg", "size": 1000}
    )
    key = resp.json()["key"]

    resp = client.post(
        "/api/submissions",
        json={"location": "East Austin", "quantity": 50, "photo_keys": [key]},
    )
    assert resp.status_code == 422
    assert "kind" in resp.text


def test_approving_a_new_kind_submission_creates_it_and_updates_breakdown(client):
    _approve_donor(client)
    resp = client.post(
        "/api/uploads/presign", json={"content_type": "image/jpeg", "size": 1000}
    )
    key = resp.json()["key"]

    resp = client.post(
        "/api/submissions",
        json={
            "location": "East Austin",
            "kind": "Medicine",
            "quantity": 200,
            "photo_keys": [key],
        },
    )
    assert resp.status_code == 200
    submission_id = resp.json()["submission_id"]

    sign_in_as(client, ADMIN_EMAIL, "Test Admin")
    resp = client.post(f"/api/admin/submissions/{submission_id}/approve")
    assert resp.status_code == 204

    resp = client.get("/api/content")
    config = resp.json()["config"]
    assert config["kindTotals"]["Medicine"] == 200

    sign_in_as(client, DONOR_EMAIL, "Kinds Donor")
    resp = client.get("/api/donors/me")
    [donation] = resp.json()["donations"]
    assert donation["kind"] == "Medicine"
    assert donation["quantity"] == 200


def test_approving_two_submissions_of_the_same_new_kind_accumulates(client):
    _approve_donor(client)

    for quantity in (150, 50):
        resp = client.post(
            "/api/uploads/presign", json={"content_type": "image/jpeg", "size": 1000}
        )
        key = resp.json()["key"]
        resp = client.post(
            "/api/submissions",
            json={
                "location": "East Austin",
                "kind": "Clothing",
                "quantity": quantity,
                "photo_keys": [key],
            },
        )
        submission_id = resp.json()["submission_id"]

        sign_in_as(client, ADMIN_EMAIL, "Test Admin")
        resp = client.post(f"/api/admin/submissions/{submission_id}/approve")
        assert resp.status_code == 204
        sign_in_as(client, DONOR_EMAIL, "Kinds Donor")

    resp = client.get("/api/content")
    assert resp.json()["config"]["kindTotals"]["Clothing"] == 200
