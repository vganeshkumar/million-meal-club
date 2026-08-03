# Feature: Photo Proof Submission

## Why
The core trust mechanism of the site: donors/volunteers prove a delivery
happened with a photo, which the founder manually verifies before the
public meal count increases. See [[00-constitution]] §5 and design README
§"Proof Of Delivery / Gallery".

## Requirements
- Gated by sign-in: signed-out visitors see the existing dashed-border
  "Sign In to submit proof" card; signed-in visitors see the real upload
  form (Location, Meals Delivered, Photo Proof [required], Receipt
  [optional], Caption [optional]).
- The public gallery grid below the form is **not** gated — it always shows
  approved photos (or placeholders if none yet), same as the prototype.
- Photo upload goes directly from the browser to S3 via a presigned URL —
  never proxied through the Lambda (avoids payload size limits and Lambda
  invocation cost for large files).
- A submission is `pending` until a founder approval action changes it —
  no auto-increment on upload, ever.
- Only image content types are accepted; a reasonable max file size is
  enforced (both client-side hinting and server-side presign validation).

## Out of scope
- Client-side image compression/resizing (nice-to-have; not required for MVP).
- Multiple-photo-per-submission (the prototype supports one photo + one
  optional receipt; keep that scope).
