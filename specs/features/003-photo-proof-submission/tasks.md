# Feature: Photo Proof Submission — Tasks

- [x] Backend: `app/services/{s3_blob,local_blob}.py` `presign_put()`.
- [x] Backend: `app/routers/uploads.py` — `POST /api/uploads/presign`.
- [x] Backend: `app/routers/submissions.py` — `POST /api/submissions`.
- [x] Backend: `Submissions` table + `status-index` GSI in `data` module and `dynamo_store.py`.
- [ ] Infra: photos bucket lifecycle rule on `pending/*` (30 days). (Terraform written; unapplied.)
- [x] Frontend: `Gallery.tsx` upload form (presign → PUT → submit flow).
- [x] Frontend: public gallery grid wired to `content.gallery`.
- [x] Manual test: signed in (via minted session), uploaded fake bytes to the
      presigned local-dev URL, confirmed it landed under `pending/{submission_id}/`
      and a `Submissions` item existed with `status: 'pending'` in the admin queue.
