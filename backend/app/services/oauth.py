"""Provider token verification for Google sign-in. See
specs/features/001-oauth-login/design.md."""

import os

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")


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
