"""Provider token verification for Google / Facebook sign-in. See
specs/features/001-oauth-login/design.md."""

import os

import httpx
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
FACEBOOK_APP_ID = os.environ.get("FACEBOOK_APP_ID", "")
FACEBOOK_APP_SECRET = os.environ.get("FACEBOOK_APP_SECRET", "")


class OAuthVerificationError(Exception):
    pass


def verify_google_token(token: str) -> tuple[str, str, str]:
    """Returns (subject, email, name)."""
    if not GOOGLE_CLIENT_ID:
        raise OAuthVerificationError(
            "GOOGLE_CLIENT_ID is not configured on the backend"
        )
    try:
        info = google_id_token.verify_oauth2_token(
            token, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError as e:
        raise OAuthVerificationError(str(e)) from e
    return info["sub"], info.get("email", ""), info.get("name", "")


def verify_facebook_token(access_token: str) -> tuple[str, str, str]:
    """Returns (subject, email, name)."""
    if not FACEBOOK_APP_ID or not FACEBOOK_APP_SECRET:
        raise OAuthVerificationError(
            "FACEBOOK_APP_ID/FACEBOOK_APP_SECRET are not configured on the backend"
        )
    app_token = f"{FACEBOOK_APP_ID}|{FACEBOOK_APP_SECRET}"
    with httpx.Client(timeout=10) as client:
        debug_resp = client.get(
            "https://graph.facebook.com/debug_token",
            params={"input_token": access_token, "access_token": app_token},
        )
        debug_resp.raise_for_status()
        debug_data = debug_resp.json().get("data", {})
        if not debug_data.get("is_valid") or debug_data.get("app_id") != FACEBOOK_APP_ID:
            raise OAuthVerificationError("Invalid Facebook access token")

        profile_resp = client.get(
            "https://graph.facebook.com/me",
            params={"fields": "id,name,email", "access_token": access_token},
        )
        profile_resp.raise_for_status()
        profile = profile_resp.json()
    return profile["id"], profile.get("email", ""), profile.get("name", "")
