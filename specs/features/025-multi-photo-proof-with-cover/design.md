# Feature: Multi-Photo Proof With a Chosen Cover — Design

## 1. Upload flow needs no backend change

`POST /uploads/presign` (`backend/app/routers/uploads.py`) already mints
a fresh random `submission_id` on *every* call, used only to namespace
the S3 key (`pending/{submission_id}/{uuid}`) — it was never the actual
`Submissions` table primary key, and nothing about approval depends on a
submission's photos sharing one prefix (`BlobStore.copy_to_approved`
only uses the pending key's basename + the target `donation_id`). So the
frontend simply calls presign→PUT once per photo, up to 5 times — no
change to `uploads.py`, `blob.py`, `s3_blob.py`, or `local_blob.py`.

## 2. `backend/app/models/domain.py`

```python
class SubmissionRequest(BaseModel):
    location: str
    meals: int
    photo_keys: list[str]
    cover_photo_key: str | None = None
    receipt_key: str | None = None
    ...

    @model_validator(mode="after")
    def _validate_photos(self) -> Self:
        if not (1 <= len(self.photo_keys) <= 5):
            raise ValueError("Between 1 and 5 photos are required")
        if self.cover_photo_key and self.cover_photo_key not in self.photo_keys:
            raise ValueError("cover_photo_key must be one of photo_keys")
        return self
```

`SubmissionAdminView.photo_url: str` → `photo_urls: list[str]`, adds
`cover_photo_url: str`. `Donation.photo_url: str | None` → `photo_urls:
list[str] | None = None`, adds `cover_photo_url: str | None = None`.
`DonationEvent.photo_url` → `cover_photo_url`, adds `photo_urls: list[str]
| None = None`. `DonationMe` is untouched (only ever added `receipt_url`
on top of `Donation`).

## 3. Store layer (`store.py` Protocol, `local_store.py`, `dynamo_store.py`)

`create_submission(..., photo_key: str, ...)` becomes `create_submission(...,
photo_keys: list[str], cover_photo_key: str, ...)`.

Both `local_store.py` and `dynamo_store.py` currently derive the
submission's own id from the photo key itself —
`photo_key.split("/")[1] if "/" in photo_key else uuid.uuid4().hex`. With
N independently-presigned keys there's no single id to derive, so this
becomes an unconditional `submission_id = uuid.uuid4().hex`, matching how
`donation_id` is already minted in `approve_submission`.

`list_submissions(status)` builds `photo_urls = [blob.presign_get(k) for
k in s["photo_keys"]]` and `cover_photo_url =
blob.presign_get(s["cover_photo_key"])` instead of the single
`photo_url`.

`approve_submission(submission_id)`:
```python
approved_keys = [blob.copy_to_approved(k, donation_id) for k in s["photo_keys"]]
cover_idx = s["photo_keys"].index(s["cover_photo_key"])
approved_cover_key = approved_keys[cover_idx]
```
The `Donation` row stores `photo_keys`/`cover_photo_key` (the *approved*
keys) — same convention as today of persisting keys and resolving to
presigned/public URLs at read time. The linked `DonationEvent` (when
present) gets `photo_urls`/`cover_photo_url` set from `approved_keys`
(dynamo: both added to the existing `UpdateExpression` alongside
`caption`) instead of the old single `photo_url`.

`get_donor(donor_id)` builds each `Donation`'s `photo_urls`/
`cover_photo_url` from the stored `photo_keys`/`cover_photo_key` instead
of the old single `photo_url=`. `_donation_event_from_row`/
`_donation_event_from_item` read `photo_urls`/`cover_photo_url` instead
of `photo_url`.

`local_store.py`'s seed data (`_seed`'s hardcoded demo donations) drops
its now-orphaned `"photo_key": None` entries — absence is already handled
by `.get(...)` defaults, no replacement field needed.

## 4. `backend/app/routers/submissions.py`

```python
submission_id = store.create_submission(
    ...,
    photo_keys=body.photo_keys,
    cover_photo_key=body.cover_photo_key or body.photo_keys[0],
    ...,
)
```

`admin.py` needs no changes — `list_submissions`/`approve_submission`/
`reject_submission` are thin passthroughs to the store, and
`SubmissionAdminView`'s field rename is entirely model-level.

## 5. Frontend types (`frontend/lib/types.ts`)

`Donation`/`DonationEvent`: `photoUrl?: string` → `photoUrls?: string[]`,
`coverPhotoUrl?: string`. `SubmissionPayload`: `photo_key: string` →
`photo_keys: string[]`, adds `cover_photo_key?: string`.
`SubmissionAdminView`: `photo_url: string` → `photo_urls: string[]`,
adds `cover_photo_url: string`.

## 6. `frontend/components/PhotoProofPicker.tsx` (new, shared)

The donor's own submission form (`DonorDashboard.tsx`'s
`SubmitProofSection`) and the volunteer's submit-on-behalf-of-donor form
(`VolunteerDashboard.tsx`'s `SubmitForDonorForm`) already duplicate their
upload logic byte-for-byte. Multi-file state + thumbnail previews + cover
selection is substantial enough new logic that it goes in one shared,
controlled component rather than duplicating it a third time:

```tsx
function PhotoProofPicker({
  files, onFilesChange, coverIndex, onCoverIndexChange,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  coverIndex: number;
  onCoverIndexChange: (i: number) => void;
})
```

- `<input type="file" accept="image/*" multiple>` whose `onChange`
  appends newly chosen files onto `files` (capped at 5 total — extras
  beyond the cap are dropped with an inline note; each file checked
  against the existing 10MB `MAX_UPLOAD_BYTES`), then clears
  `e.target.value` so the same input can add more photos incrementally.
- Renders each file as a fixed-size thumbnail (`h-20 w-20 rounded-xl
  border overflow-hidden`, `object-cover`) via
  `URL.createObjectURL(file)` (revoked on change/unmount to avoid leaking
  object URLs), each with a remove ("×") control and a "set as cover"
  control; the current cover gets a highlighted border + small badge.
- The visible label stays "Photo Proof" — the same text
  `frontend/e2e/homepage-scheduled-events.spec.ts`'s
  `getByLabel("Photo Proof")` already targets, so that existing e2e spec
  needs no change (`setInputFiles` with one file still satisfies a
  multi-file input).

`frontend/lib/api.ts` gains `uploadPhotos(files: File[]): Promise<string[]>`
— loops `presignUpload` → `uploadToPresignedUrl` per file in order,
returning the resulting keys. Both forms' `handleSubmit` swap their old
single presign-then-upload call for this helper, add local
`photoFiles`/`coverIndex` state (reset alongside their existing
per-submission state resets), and pass `photo_keys` / `cover_photo_key:
keys[coverIndex]` to `api.submitProof`.

## 7. Display — cover only, fixed size (unchanged sizing)

- `DonorDashboard.tsx`'s `CompletedEventsSection` list-row thumbnail:
  `d.photoUrl` → `d.coverPhotoUrl`, same `h-16 w-16` box.
- `Events.tsx`'s `CompletedDonationEventCard`: `event.photoUrl` →
  `event.coverPhotoUrl`, same `h-40` full-bleed card banner.

## 8. Display — all photos in detail modals

- `DonorDashboard.tsx`'s `CompletedDonationModal`: cover stays the lead,
  full-width image (`donation.coverPhotoUrl`); when
  `donation.photoUrls.length > 1`, a small fixed-size grid renders below
  it (`grid grid-cols-4 gap-2`, each tile `aspect-square rounded-lg
  overflow-hidden border`, `object-cover`, wrapped in `<a
  target="_blank">` for full-size viewing — the same click-to-enlarge
  pattern the admin queue already uses).
- `Events.tsx`'s `CompletedEventModal`: identical treatment with
  `event.coverPhotoUrl`/`event.photoUrls`.

## 9. `AdminSignoff.tsx`'s `PendingSubmissions`

The single photo tile becomes a `.map` over `s.photo_urls`, reusing the
existing `aspect-[4/3] object-cover` tile and the surrounding
`grid-cols-[repeat(auto-fit,minmax(160px,1fr))]` grid (which already
wraps naturally — it was built for "photo tile + optional receipt tile"
and now just gets up to 5 photo tiles + the receipt tile). The tile whose
url equals `s.cover_photo_url` gets a small "Cover" badge overlay.

## Manual verification
Exercised end-to-end against the running dev servers: submitted proof
with 3 photos and a non-first cover choice as a donor, confirmed the
homepage/dashboard cards show only the fixed-size cover, confirmed the
detail modal shows all 3 (cover first), approved as admin (confirming
the admin queue showed all 3 with the cover badged), then repeated once
for the volunteer submit-on-behalf-of-donor path.
