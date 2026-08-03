"""Real S3-backed blob storage, used in deployed environments
(DATA_BACKEND=dynamodb). See specs/01-architecture.md 'Storage: S3 photos
bucket' for the pending/approved prefix + bucket-policy scheme this assumes
is already provisioned by infra/modules/photos."""

import os
import uuid

import boto3

from app.models.domain import PresignResponse

BUCKET_NAME = os.environ.get("PHOTOS_BUCKET_NAME", "")
PHOTOS_PUBLIC_BASE_URL = os.environ.get("PHOTOS_PUBLIC_BASE_URL", "")
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


class S3BlobStore:
    def __init__(self) -> None:
        self._client = boto3.client("s3")

    def presign_put(
        self, content_type: str, size: int, submission_id: str
    ) -> PresignResponse:
        if not content_type.startswith("image/"):
            raise ValueError("Only image uploads are allowed")
        if size > MAX_UPLOAD_BYTES:
            raise ValueError("File too large")

        key = f"pending/{submission_id}/{uuid.uuid4().hex}"
        url = self._client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": BUCKET_NAME,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=900,
        )
        return PresignResponse(upload_url=url, key=key)

    def presign_get(self, key: str, ttl_seconds: int = 600) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": BUCKET_NAME, "Key": key},
            ExpiresIn=ttl_seconds,
        )

    def copy_to_approved(self, pending_key: str, donation_id: str) -> str:
        approved_key = f"approved/{donation_id}/{pending_key.split('/')[-1]}"
        self._client.copy_object(
            Bucket=BUCKET_NAME,
            CopySource={"Bucket": BUCKET_NAME, "Key": pending_key},
            Key=approved_key,
        )
        return approved_key

    def public_url(self, key: str) -> str:
        return f"{PHOTOS_PUBLIC_BASE_URL}/{key}"
