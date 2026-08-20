import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.deps import Session, get_current_user
from app.models.domain import PresignRequest, PresignResponse
from app.services.blob import get_blob_store
from app.services.store import get_store

router = APIRouter(tags=["uploads"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
NOT_ALLOWED_TO_SUBMIT_DETAIL = (
    "You need an approved donor application, or to be a registered "
    "volunteer, before submitting proof — see the Join In section."
)


@router.post("/uploads/presign", response_model=PresignResponse)
def presign_upload(
    body: PresignRequest, session: Session = Depends(get_current_user)
) -> PresignResponse:
    # Photos are always images; a receipt may be an image or a PDF (see
    # the "Receipt (optional)" file inputs' accept="image/*,.pdf" in
    # DonorDashboard.tsx/VolunteerDashboard.tsx).
    if not (
        body.content_type.startswith("image/")
        or body.content_type == "application/pdf"
    ):
        raise HTTPException(
            status_code=400, detail="Only image or PDF uploads are allowed"
        )
    if body.size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large")
    # Reject before the (wasted) upload, not just at /submissions — same
    # gate, checked earlier. Presign doesn't know yet whether this will be
    # attributed to the submitter's own donor record or (for a volunteer)
    # someone else's, so it's a coarser check: either identity is enough to
    # proceed — the precise attribution is re-checked at /submissions. See
    # specs/features/008-persona-dashboards-and-roles/design.md.
    store = get_store()
    user_id, user = session
    is_donor = store.resolve_donor_id(user_id, user.email) is not None
    is_volunteer = store.resolve_volunteer_id(user_id, user.email) is not None
    if not is_donor and not is_volunteer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=NOT_ALLOWED_TO_SUBMIT_DETAIL,
        )
    submission_id = uuid.uuid4().hex
    return get_blob_store().presign_put(body.content_type, body.size, submission_id)


# -- local-dev-only routes backing LocalBlobStore's fake presigned URLs.
# Never reached when DATA_BACKEND=dynamodb (uploads go straight to S3).


def _local_blob_or_404():
    from app.services.local_blob import LocalBlobStore

    if os.environ.get("DATA_BACKEND", "local") != "local":
        raise HTTPException(status_code=404)
    store = get_blob_store()
    if not isinstance(store, LocalBlobStore):
        raise HTTPException(status_code=404)
    return store


@router.put("/uploads/local/{key:path}")
async def local_upload_put(key: str, request: Request) -> Response:
    store = _local_blob_or_404()
    body = await request.body()
    content_type = request.headers.get("content-type", "application/octet-stream")
    store.write(key, body, content_type)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/uploads/local/{key:path}")
def local_upload_get(key: str) -> Response:
    store = _local_blob_or_404()
    obj = store.read(key)
    if not obj:
        raise HTTPException(status_code=404)
    content, content_type = obj
    return Response(content=content, media_type=content_type)
