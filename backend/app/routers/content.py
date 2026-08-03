from fastapi import APIRouter

from app.models.domain import ContentResponse
from app.services.store import get_store

router = APIRouter(tags=["content"])


@router.get("/content", response_model=ContentResponse)
def get_content() -> ContentResponse:
    return get_store().get_content()
