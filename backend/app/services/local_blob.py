"""In-memory blob storage for local development only. Mimics just enough of
S3's presigned PUT/GET + copy-on-approve semantics (see specs/01-architecture.md)
to exercise the full upload -> submit -> approve flow without AWS. Never used
when DATA_BACKEND=dynamodb (see app/services/blob.py)."""

import os
import uuid

from app.models.domain import PresignResponse

API_PUBLIC_BASE_URL = os.environ.get(
    "API_PUBLIC_BASE_URL", "http://localhost:8000/api"
)


class LocalBlobStore:
    def __init__(self) -> None:
        self._objects: dict[str, tuple[bytes, str]] = {}

    def presign_put(
        self, content_type: str, size: int, submission_id: str
    ) -> PresignResponse:
        key = f"pending/{submission_id}/{uuid.uuid4().hex}"
        return PresignResponse(
            upload_url=f"{API_PUBLIC_BASE_URL}/uploads/local/{key}",
            key=key,
        )

    def presign_get(self, key: str, ttl_seconds: int = 600) -> str:
        return f"{API_PUBLIC_BASE_URL}/uploads/local/{key}"

    def copy_to_approved(self, pending_key: str, donation_id: str) -> str:
        approved_key = f"approved/{donation_id}/{pending_key.split('/')[-1]}"
        if pending_key in self._objects:
            self._objects[approved_key] = self._objects[pending_key]
        return approved_key

    def public_url(self, key: str) -> str:
        return f"{API_PUBLIC_BASE_URL}/uploads/local/{key}"

    # Local-only helpers used by the /uploads/local/{key} route in
    # app/routers/uploads.py — not part of the BlobStore protocol.
    def write(self, key: str, content: bytes, content_type: str) -> None:
        self._objects[key] = (content, content_type)

    def read(self, key: str) -> tuple[bytes, str] | None:
        return self._objects.get(key)
