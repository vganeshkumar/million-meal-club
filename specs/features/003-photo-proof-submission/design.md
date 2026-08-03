# Feature: Photo Proof Submission — Design

## Flow
See [[../../01-architecture]] "Storage: S3 photos bucket" for the full
pending→approved mechanics. This feature covers steps 1–3 (upload +
submission creation); [[004-admin-review-approval]] covers steps 3–5
(review/approve/reject).

1. Frontend: `POST /api/uploads/presign { content_type, size }` (auth
   required) → backend validates `content_type` starts with `image/` and
   `size` is under `MAX_UPLOAD_BYTES` (e.g. 10 MB), generates
   `submission_id = uuid4()`, returns `{ upload_url, key }` where `key =
   "pending/{submission_id}/{sanitized_filename}"`.
2. Frontend `PUT`s the raw file bytes to `upload_url` directly (S3
   presigned PUT, `Content-Type` header must match what was presigned).
3. If a receipt file is also provided, repeat steps 1–2 for it
   (`receipt_key`).
4. Frontend `POST /api/submissions { location, meals, photo_key,
   receipt_key?, caption? }` (auth required) — backend writes a
   `Submissions` item with `status: 'pending'`, `user_id` from session,
   `donor_id` looked up (or created on first submission) from the user's
   `Users`/`Donors` link.

## Frontend
`Gallery.tsx`:
- Signed-out: existing dashed-border card + "Sign In" button (opens modal).
- Signed-in: upload form calling the two-step presign→PUT→submit flow above,
  with a simple upload progress/spinner state and success/error messaging.
- Public grid: renders `content.gallery` (approved photo refs from
  `GET /api/content`) using the same striped-placeholder pattern for any
  slots not yet filled, exactly like the prototype.

## Data
`Submissions` table: PK `submission_id`, GSI `status-index` on `status`
(for the admin queue). Attributes: `user_id`, `donor_id`, `location`,
`meals`, `photo_key`, `receipt_key?`, `caption?`, `status`
(`pending|approved|rejected`), `created_at`, `reviewed_at?`.

## Edge cases
- User uploads a photo but never calls `/api/submissions` (abandons the
  form) → orphaned `pending/*` object, cleaned up by the 30-day lifecycle
  rule (see [[../../infra/design]]).
- Presigned URL expires before upload completes (default ~15 min TTL is
  generous for a single photo) → frontend should catch the S3 error and let
  the user retry (re-request a fresh presign).
