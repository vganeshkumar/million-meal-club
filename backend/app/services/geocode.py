"""Best-effort address geocoding via Geoapify's Geocoding API — the same
GEOAPIFY_API_KEY already used for the static map image (see
specs/features/023-event-location-time-and-sharing/design.md). Not
provisioned yet -> geocode() is a no-op, same "not configured" story the
map image and OAuth already follow.

Originally used OpenStreetMap Nominatim (free, keyless), but Nominatim's
structured-query parser turned out to fail on real-world addresses with
more than two comma-separated components or landmark-relative phrasing
(e.g. "opposite Hotel Kohinoor") — common in Indian addressing
conventions — even when the place is well-known and present in OSM's own
data under a simpler query. Geoapify's geocoder (tested against the same
addresses) resolves them correctly, so geocoding moved to it rather than
keeping two providers.

Geocoding is enrichment, never a scheduling blocker — any failure (address
not found, Geoapify unreachable, timeout) returns None rather than
raising, and callers just store no coordinates for that event.
"""

import os

import requests

_GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search"
_GEOAPIFY_API_KEY = os.environ.get("GEOAPIFY_API_KEY", "")


def geocode(address: str) -> tuple[float, float] | None:
    if not address.strip() or not _GEOAPIFY_API_KEY:
        return None
    try:
        resp = requests.get(
            _GEOCODE_URL,
            params={"text": address, "limit": 1, "apiKey": _GEOAPIFY_API_KEY},
            timeout=5,
        )
        resp.raise_for_status()
        features = resp.json().get("features", [])
    except (requests.RequestException, ValueError):
        return None

    if not features:
        return None
    try:
        props = features[0]["properties"]
        return float(props["lat"]), float(props["lon"])
    except (KeyError, TypeError, ValueError):
        return None
