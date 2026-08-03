import os
from typing import Protocol

from app.models.domain import PresignResponse


class BlobStore(Protocol):
    """File storage interface for proof-of-delivery photos. See
    specs/01-architecture.md 'Storage: S3 photos bucket' for the
    pending/approved prefix scheme this mirrors."""

    def presign_put(self, content_type: str, size: int, submission_id: str) -> PresignResponse: ...

    def presign_get(self, key: str, ttl_seconds: int = 600) -> str: ...

    def copy_to_approved(self, pending_key: str, donation_id: str) -> str:
        """Copies an object from pending/* to approved/* and returns the new key."""
        ...

    def public_url(self, key: str) -> str:
        """URL the frontend can render an <img> from, for objects already under approved/*."""
        ...


_blob: BlobStore | None = None


def get_blob_store() -> BlobStore:
    global _blob
    if _blob is not None:
        return _blob

    backend = os.environ.get("DATA_BACKEND", "local")
    if backend == "dynamodb":
        from app.services.s3_blob import S3BlobStore

        _blob = S3BlobStore()
    else:
        from app.services.local_blob import LocalBlobStore

        _blob = LocalBlobStore()
    return _blob
