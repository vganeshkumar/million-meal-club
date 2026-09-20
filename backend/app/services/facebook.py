"""Posting a completed donation event's cover photo to the Million Meal
Club Facebook Page — see specs/features/033-facebook-event-posting/design.md.

Same "configured or not" split as Geoapify (geocode.py): gated on presence
of FACEBOOK_PAGE_ACCESS_TOKEN / FACEBOOK_PAGE_ID rather than DATA_BACKEND,
so local dev can point at the real Page too. Unlike geocoding, this is a
manual admin-initiated action, so failures raise instead of being
swallowed — the founder needs an honest success/fail signal.
"""

import os
from typing import Protocol

import requests

_GRAPH_API_PHOTOS_URL_TEMPLATE = "https://graph.facebook.com/v21.0/{page_id}/photos"


class FacebookPostError(Exception):
    pass


class FacebookPoster(Protocol):
    def post_photo(self, image_url: str, message: str) -> str:
        """Posts image_url as a photo on the Page's timeline with the given
        caption. Returns Facebook's post id."""
        ...


class LocalFacebookPoster:
    def post_photo(self, image_url: str, message: str) -> str:
        print(f"[facebook] would post {image_url!r} with message: {message!r}")
        return "local-fake-post-id"


class GraphApiFacebookPoster:
    def __init__(self) -> None:
        self._page_id = os.environ["FACEBOOK_PAGE_ID"]
        self._access_token = os.environ["FACEBOOK_PAGE_ACCESS_TOKEN"]

    def post_photo(self, image_url: str, message: str) -> str:
        url = _GRAPH_API_PHOTOS_URL_TEMPLATE.format(page_id=self._page_id)
        try:
            resp = requests.post(
                url,
                data={
                    "url": image_url,
                    "caption": message,
                    "access_token": self._access_token,
                },
                timeout=10,
            )
            body = resp.json()
        except (requests.RequestException, ValueError) as exc:
            raise FacebookPostError(f"Couldn't reach Facebook: {exc}") from exc

        if not resp.ok or "id" not in body:
            detail = body.get("error", {}).get("message", resp.text)
            raise FacebookPostError(f"Facebook rejected the post: {detail}")

        return body["id"]


_facebook_poster: FacebookPoster | None = None


def get_facebook_poster() -> FacebookPoster:
    global _facebook_poster
    if _facebook_poster is not None:
        return _facebook_poster

    configured = bool(
        os.environ.get("FACEBOOK_PAGE_ID") and os.environ.get("FACEBOOK_PAGE_ACCESS_TOKEN")
    )
    _facebook_poster = GraphApiFacebookPoster() if configured else LocalFacebookPoster()
    return _facebook_poster


def is_facebook_configured() -> bool:
    return isinstance(get_facebook_poster(), GraphApiFacebookPoster)
