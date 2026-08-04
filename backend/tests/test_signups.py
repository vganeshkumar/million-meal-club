"""Covers specs/features/012-required-field-validation — every Join In
field not explicitly optional must be rejected with a 422 when missing,
for both donor and volunteer mode."""

import pytest

VALID_DONOR = {
    "mode": "donor",
    "name": "Dana Donor",
    "email": "dana@example.com",
    "location": "Austin, TX",
    "country": "United States",
    "packet_count": 100,
    "delivery_role": "self",
    "donor_story": "Why I'm joining.",
    "commit_50k_4yr": True,
    "agree_publish_story": True,
}

VALID_VOLUNTEER = {
    "mode": "volunteer",
    "name": "Val Volunteer",
    "email": "val@example.com",
    "location": "Austin, TX",
    "country": "United States",
    "packets_per_trip": 20,
    "availability": "Weekends",
}


def test_valid_donor_signup_succeeds(client):
    resp = client.post("/api/signups", json=VALID_DONOR)
    assert resp.status_code == 200
    assert "signup_id" in resp.json()


def test_valid_volunteer_signup_succeeds(client):
    resp = client.post("/api/signups", json=VALID_VOLUNTEER)
    assert resp.status_code == 200
    assert "signup_id" in resp.json()


def test_donor_signup_optional_fields_can_be_omitted(client):
    payload = {**VALID_DONOR, "notes": None, "partner_charity": None}
    resp = client.post("/api/signups", json=payload)
    assert resp.status_code == 200


def test_volunteer_signup_optional_fields_can_be_omitted(client):
    payload = {
        **VALID_VOLUNTEER,
        "notes": None,
        "volunteering_history": None,
        "references": None,
    }
    resp = client.post("/api/signups", json=payload)
    assert resp.status_code == 200


# Falsy-but-present values (empty string / False / 0) must be rejected the
# same as an absent field — "required" means "present and non-empty," not
# just "the key exists in the JSON body." delivery_role is deliberately
# excluded here — it's not independently required, see the
# delivery_role/partner_charity OR-group tests below.
REQUIRED_DONOR_FIELDS = {
    "packet_count": None,
    "donor_story": "",
    "commit_50k_4yr": False,
    "agree_publish_story": False,
}


@pytest.mark.parametrize("field", REQUIRED_DONOR_FIELDS.keys())
def test_donor_signup_rejects_missing_required_field(client, field):
    payload = {**VALID_DONOR, field: REQUIRED_DONOR_FIELDS[field]}
    resp = client.post("/api/signups", json=payload)
    assert resp.status_code == 422
    assert field in resp.text


# delivery_role and partner_charity are an OR-group, not two independent
# required fields — self-deliver, need-a-volunteer, and via-a-partner-
# charity are three mutually exclusive ways to describe delivery, and at
# least one of the three must be picked.
def test_donor_signup_valid_with_partner_charity_and_no_delivery_role(client):
    payload = {**VALID_DONOR, "delivery_role": None, "partner_charity": "Central Texas Food Bank"}
    resp = client.post("/api/signups", json=payload)
    assert resp.status_code == 200


def test_donor_signup_valid_with_delivery_role_and_no_partner_charity(client):
    payload = {**VALID_DONOR, "partner_charity": None}
    assert payload["delivery_role"] == "self"
    resp = client.post("/api/signups", json=payload)
    assert resp.status_code == 200


def test_donor_signup_rejects_missing_both_delivery_role_and_partner_charity(client):
    payload = {**VALID_DONOR, "delivery_role": None, "partner_charity": None}
    resp = client.post("/api/signups", json=payload)
    assert resp.status_code == 422
    assert "delivery_role" in resp.text
    assert "partner_charity" in resp.text


REQUIRED_VOLUNTEER_FIELDS = {
    "packets_per_trip": None,
    "availability": "",
}


@pytest.mark.parametrize("field", REQUIRED_VOLUNTEER_FIELDS.keys())
def test_volunteer_signup_rejects_missing_required_field(client, field):
    payload = {**VALID_VOLUNTEER, field: REQUIRED_VOLUNTEER_FIELDS[field]}
    resp = client.post("/api/signups", json=payload)
    assert resp.status_code == 422
    assert field in resp.text


def test_donor_signup_rejects_whitespace_only_story(client):
    payload = {**VALID_DONOR, "donor_story": "   "}
    resp = client.post("/api/signups", json=payload)
    assert resp.status_code == 422


def test_volunteer_signup_rejects_whitespace_only_availability(client):
    payload = {**VALID_VOLUNTEER, "availability": "   "}
    resp = client.post("/api/signups", json=payload)
    assert resp.status_code == 422


def test_signup_rejects_missing_location(client):
    payload = {k: v for k, v in VALID_DONOR.items() if k != "location"}
    resp = client.post("/api/signups", json=payload)
    assert resp.status_code == 422


def test_signup_without_session_requires_name_and_email(client):
    payload = {k: v for k, v in VALID_DONOR.items() if k not in ("name", "email")}
    resp = client.post("/api/signups", json=payload)
    assert resp.status_code == 422
