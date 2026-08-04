"""Backend test harness. Runs against the real FastAPI app + the real
in-memory LocalStore (DATA_BACKEND=local) — no mocking of the store or
routers. Every test gets a fresh store (LocalStore is re-seeded per test,
matching what a fresh local dev server looks like) so tests can't leak
state into each other."""

import os

os.environ["ENV"] = "dev"
os.environ["DATA_BACKEND"] = "local"
os.environ["ENABLE_DUMMY_LOGIN"] = "true"
os.environ["ADMIN_EMAILS"] = "admin@example.com"
os.environ["API_PUBLIC_BASE_URL"] = "http://localhost:8001/api"
os.environ.setdefault("SESSION_SECRET", "test-only-session-secret-at-least-32-bytes-long")

import time

import jwt
import pytest
from fastapi.testclient import TestClient

import app.services.store as store_module
from app.main import app
from app.services.jwt_session import SESSION_COOKIE_NAME, SESSION_SECRET


@pytest.fixture(autouse=True)
def fresh_store():
    """Forces app.services.store.get_store() to build a brand-new
    LocalStore (re-seeded) for every test — the module-level singleton
    would otherwise carry signups/donors/volunteers over between tests."""
    store_module._store = None
    yield
    store_module._store = None


@pytest.fixture(autouse=True)
def stub_geocode(monkeypatch):
    """Donation-event scheduling/editing calls out to Nominatim to geocode
    the address — tests never hit that real network service (flaky, slow,
    and against its automated-use policy). Stubbed to a fixed coordinate
    so behavior stays deterministic; tests that care about the
    can't-geocode fallback override this per-test. See
    specs/features/023-event-location-time-and-sharing/design.md."""
    monkeypatch.setattr(
        "app.routers.donation_events.geocode", lambda address: (30.2672, -97.7431)
    )


@pytest.fixture
def client():
    return TestClient(app)


def make_session_cookie(
    email: str, name: str = "Test User", provider: str = "google", user_id: str | None = None
) -> str:
    """Mints a session token the same way app/services/jwt_session.py does
    for a real OAuth sign-in — lets tests act as an arbitrary already-
    verified email without needing real Google/Facebook credentials."""
    payload = {
        "user_id": user_id or f"user-{email}",
        "name": name,
        "email": email,
        "provider": provider,
        "exp": int(time.time()) + 3600,
    }
    return jwt.encode(payload, SESSION_SECRET, algorithm="HS256")


def attach_session_cookie_from_response(client: TestClient, resp) -> None:
    """After a real login call (e.g. POST /api/auth/dummy) returns a
    Set-Cookie, re-attach it the same reliable way sign_in_as does
    instead of trusting httpx's automatic jar merge — TestClient's bare
    "testserver" host plus the cookie's Secure flag makes http.cookiejar
    append an implicit ".local" suffix when *storing* the cookie, which
    doesn't reliably match on the *next* outgoing request in this
    httpx/starlette version combo (a harness quirk; real browsers, and
    this app in one, don't have this problem — see
    specs/features/015-local-dev-generated-credentials/design.md's tests
    section)."""
    client.cookies.set(SESSION_COOKIE_NAME, resp.cookies[SESSION_COOKIE_NAME])


def sign_in_as(client: TestClient, email: str, name: str = "Test User") -> None:
    """Attaches a session cookie to `client` for the given email, as if
    that user had just signed in via OAuth. Clears the jar first — a
    cookie set manually here and one previously issued by a real
    Set-Cookie response are distinct jar entries with the same name,
    which httpx refuses to disambiguate (CookieConflict) on the next
    request otherwise. If a test calls a real login endpoint (e.g.
    POST /api/auth/dummy) directly after using this helper, clear
    `client.cookies` again first — the same conflict applies in reverse
    (manual entry left over vs. the endpoint's own Set-Cookie)."""
    client.cookies.clear()
    token = make_session_cookie(email, name)
    client.cookies.set(SESSION_COOKIE_NAME, token)
