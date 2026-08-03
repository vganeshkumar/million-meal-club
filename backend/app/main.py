import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.routers import (
    admin,
    auth,
    content,
    donors,
    signups,
    submissions,
    uploads,
    volunteers,
)

app = FastAPI(title="Million Meal Club API")

# CloudFront routes /api/* to this Lambda in production, making the frontend
# and API same-origin — CORS is only needed for local dev (Next dev server
# on :3000, uvicorn on :8000). See specs/01-architecture.md.
if os.environ.get("ENV", "dev") == "dev":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(content.router, prefix="/api")
app.include_router(donors.router, prefix="/api")
app.include_router(volunteers.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(signups.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")
app.include_router(submissions.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


handler = Mangum(app)
