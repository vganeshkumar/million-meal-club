"""Backend-issued session token (HttpOnly cookie), replacing the design
prototype's localStorage-only simulated session. See
specs/features/001-oauth-login/design.md."""

import os
import time

import jwt

SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-only-insecure-secret-change-me")
SESSION_COOKIE_NAME = "mmc_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days


def issue_session_token(user_id: str, name: str, email: str, provider: str) -> str:
    payload = {
        "user_id": user_id,
        "name": name,
        "email": email,
        "provider": provider,
        "exp": int(time.time()) + SESSION_TTL_SECONDS,
    }
    return jwt.encode(payload, SESSION_SECRET, algorithm="HS256")


def verify_session_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SESSION_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
