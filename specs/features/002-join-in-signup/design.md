# Feature: Join In Signup — Design

## Frontend
`JoinInForm.tsx` — controlled component, local state for `mode`
(`'donor'|'volunteer'`), conditional field rendering per the authoritative
design. On submit, `POST /api/signups` via `lib/api.ts` with a JSON body.

Body shape:
```ts
{
  mode: 'donor' | 'volunteer',
  name?: string,              // omitted if signed in (backend uses session name)
  email?: string,              // omitted if signed in (backend uses session email); required otherwise, both modes
  location: string,
  notes?: string,
  // mode === 'donor':
  packet_count?: number,
  delivery_role?: 'self' | 'volunteer_needed',
  partner_charity?: string,    // optional, name of a PartnerCharity
  donor_story?: string,        // required in donor mode
  commit_50k_4yr?: boolean,    // required true in donor mode
  agree_publish_story?: boolean, // required true in donor mode
  // mode === 'volunteer':
  packets_per_trip?: number,
  availability?: string,
}
```

Client-side `required` attributes on the donor-story textarea and both
checkboxes mirror the design exactly (matches native HTML form validation
behavior in the original prototype).

## Backend
`POST /api/signups` (auth optional — `deps.get_current_user_optional()`
variant that returns `None` instead of 401 when signed out). Validates via
a pydantic model with a discriminated union on `mode`: donor fields
(`packet_count`, `delivery_role`, `donor_story`, `commit_50k_4yr`,
`agree_publish_story`) required only when `mode == 'donor'` —
`commit_50k_4yr` and `agree_publish_story` must additionally both be `True`
(not just present) when `mode == 'donor'`, enforced via a `model_validator`;
volunteer fields (`packets_per_trip`, `availability`) only when `mode ==
'volunteer'`. `partner_charity` is always optional. **`email` is required
for both modes** — but this can't live in the pydantic `model_validator`,
since "required unless the session already has one" depends on the auth
dependency, not just the request body; the router resolves `email =
session.email if signed in else body.email`, and 422s with a clear message
if neither is present. Writes one `Signups` item: `{ signup_id, user_id?,
mode, name, email, location, notes?, status? (donor mode only —
"requested_signoff"), ...mode_specific_fields, created_at }`. For
`mode == 'volunteer'`, also creates an unclaimed `Volunteers` row in the
same call — see
[[../008-persona-dashboards-and-roles/design]]. Returns `{ signup_id }`.

## Data
`Signups` table: PK `signup_id` (uuid4). GSI `status-index` on `status` for
the admin donor-application queue (donor entries only — see
[[../007-donor-application-approval/design]]); volunteer entries have no
`status` and aren't returned by that query — there's no admin review step
for volunteers, they're linkable immediately (see
[[../008-persona-dashboards-and-roles/design]] for the `Volunteers` table
this now also writes to).
