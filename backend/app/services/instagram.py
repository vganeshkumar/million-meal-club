"""Auto-posts to Instagram when a donation event is scheduled or
completed. Same "not provisioned yet" graceful-degradation story
Google OAuth and Geoapify already follow — see
specs/features/030-instagram-auto-posting/design.md.

Posting is always best-effort: callers wrap post() in a try/except and
never let a failure here block the scheduling/approval action it's
attached to.
"""

import os
from typing import Protocol

import requests

_GRAPH_API_VERSION = "v21.0"


class InstagramPoster(Protocol):
    def post(self, image_url: str, caption: str) -> None: ...


class NullInstagramPoster:
    def post(self, image_url: str, caption: str) -> None:
        print(f"[instagram] not configured — would post: {caption[:80]!r}")


class GraphApiInstagramPoster:
    def __init__(self, access_token: str, business_account_id: str) -> None:
        self._token = access_token
        self._account_id = business_account_id

    def post(self, image_url: str, caption: str) -> None:
        base = f"https://graph.facebook.com/{_GRAPH_API_VERSION}/{self._account_id}"
        create_resp = requests.post(
            f"{base}/media",
            data={
                "image_url": image_url,
                "caption": caption,
                "access_token": self._token,
            },
            timeout=15,
        )
        create_resp.raise_for_status()
        creation_id = create_resp.json()["id"]
        publish_resp = requests.post(
            f"{base}/media_publish",
            data={"creation_id": creation_id, "access_token": self._token},
            timeout=15,
        )
        publish_resp.raise_for_status()


_poster: InstagramPoster | None = None


def get_instagram_poster() -> InstagramPoster:
    global _poster
    if _poster is not None:
        return _poster
    token = os.environ.get("INSTAGRAM_ACCESS_TOKEN", "")
    account_id = os.environ.get("INSTAGRAM_BUSINESS_ACCOUNT_ID", "")
    _poster = (
        GraphApiInstagramPoster(token, account_id)
        if token and account_id
        else NullInstagramPoster()
    )
    return _poster
