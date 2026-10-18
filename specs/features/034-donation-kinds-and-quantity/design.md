# Feature: Donation Kinds and Quantity — Design

## Naming approach: rename, don't shim
`meals` / `total_meals` / `packet_count` are renamed to `kind` + `quantity`
everywhere (storage, API wire format, frontend) rather than kept as a
permanent "meals" alias with a generic field bolted on next to it. Two
reasons:

1. There's no DynamoDB GSI keyed on `total_meals` or `meals` ( donor
   ranking is an in-memory Python sort after a table scan — see
   `local_store.py`'s `sort(key=lambda d: d["total_meals"], ...)` and
   `dynamo_store.py`'s equivalent), so renaming the attribute carries no
   infra risk.
2. The founder explicitly chose the backfill-migration path (not
   read-time defaulting) for existing data, signaling willingness to
   touch every stored item once rather than carry "meals" as permanent
   internal naming debt for a feature whose whole point is leaving
   meals-only behind.

`commit_50k_4yr` (the donor-commitment checkbox's internal field name,
already stale from a prior 50k/4yr → 10k/5yr copy change) is **not**
touched by this spec — unrelated pre-existing debt, out of scope here per
"don't refactor beyond what the task requires."

## Backend — models (`backend/app/models/domain.py`)
- `Donation`: `meals: int` → `quantity: int`; add `kind: str`.
- `DonationMe`: inherits, no own change.
- `Donor` / `DonorMe`: `total_meals: int` → `total_quantity: int`.
- `DonorAdminView`: same rename.
- `DonationEvent`: `packet_count: int | None` → `quantity: int | None`;
  add `kind: str | None` (mirrors `quantity`'s optionality — both unset
  until the donor fills in the scheduling-detail fields, same as today).
- `CreateDonationEventRequest` / `UpdateDonationEventRequest`: same
  `packet_count` → `quantity` rename, add `kind: str | None`.
- `SignupRequest`: `packet_count: int | None` → `quantity: int | None`,
  add `kind: str | None`; `_validate_required_fields` now requires both
  `quantity` and `kind` (not just `quantity`) when `mode == "donor"`.
- `SignupAdminView`: same rename + new field, read-only display.
- `SubmissionRequest`: `meals: int` → `quantity: int`, add `kind: str`.
  Required on every submission, including spontaneous ones with no
  linked donation event (unlike `donation_event_id`, which stays
  optional) — someone must say what kind of help this was.
- `SubmissionAdminView`: same rename + new field.
- `SiteConfig`: `total_meals: int` → `total_quantity: int`; add
  `kind_totals: dict[str, int]` — the public per-kind breakdown (see
  "New section" below). Serializes to `kindTotals` on the wire
  (`CamelModel`'s existing alias behavior).
- `ConfigUpdateRequest`: `total_meals: int | None` → `total_quantity: int
  | None` (admin-editable override, same as today).
- New: `DonationKind` (`CamelModel`): `name: str`. Trivial wrapper so
  `GET /api/content` can return `kinds: list[DonationKind]` with room to
  grow (e.g. a future `usage_count`) without a breaking change later.
- `ContentResponse`: add `kinds: list[str]` (just names — no need for the
  wrapper on this read path; keep it simple) sourced from the new
  `donation_kinds` table, seeded + grown as described below.

## Kind taxonomy — storage and growth
### New table: `donation_kinds`
Tiny table, mirrors `config`'s simplicity (`infra/modules/data/main.tf`):
hash key `kind` (string, the display name itself — case-sensitive, no
normalization in this spec), no GSI, `PAY_PER_REQUEST`. Seeded once at
first deploy (see "Seeding" below) with:
```
Food Packets
Education Supplies
Clothing
Medicine
Ambulance / Transport
```
(Five to start; the founder can describe a sixth kind in the Join In form
tomorrow and it's immediately in the shared list for the next donor —
no code change needed to add a kind.)

### Growth
`Store` protocol gains:
```python
def ensure_donation_kind_exists(self, kind: str) -> None:
    """Idempotent upsert — no-ops if `kind` is already a known kind."""
```
Called server-side (not client-side) whenever a `kind` string arrives on
signup, donation-event create/update, or submission-create — so a typed
kind is persisted the moment it's used, regardless of which form
introduced it, and duplicate calls for an already-known kind are cheap
no-ops (`PutItem` is naturally idempotent here — overwriting
`{"kind": "Medicine"}` with itself is harmless, no conditional check
needed).
- `LocalStore`: a `set[str]` seeded with the starter list.
- `DynamoStore`: `PutItem` into `donation_kinds` (unconditional — intentionally
  not `put_item(..., ConditionExpression=...)`, since "already exists" isn't
  an error case here, just a no-op).

### Reading the list
`Store.get_content()` (existing method, both impls) adds `kinds` to its
returned `ContentResponse` — a straight `Scan` (or, for `LocalStore`, the
seeded set) of `donation_kinds`, sorted alphabetically except "Food
Packets" always pinned first (it's overwhelmingly the common case and
the only one with historical volume).

### No admin curation UI
Per requirements' "Out of scope" — if "Medicine" and "medicine" both end
up in the list from inconsistent typing, that's a founder-fixes-it-by-hand
problem (direct table edit), not something this spec builds tooling for.

## Backend — endpoints (`backend/app/routers/*.py`)
No new endpoints needed beyond the `kinds` addition to the existing
`GET /api/content` response — kind growth happens as a side effect inside
the existing signup/donation-event/submission create-and-update handlers,
each of which now calls `store.ensure_donation_kind_exists(payload.kind)`
after its normal validation, before persisting.

- `admin.py`'s submission-approval path (`approve_submission`, both store
  impls) changes its config-increment from
  `total_meals += s["meals"]` / `ADD total_meals :m` to
  `total_quantity += s["quantity"]` / `ADD total_quantity :q`, **and**
  additionally increments `kind_totals[s["kind"]]`:
  - `LocalStore`: `self._config["kind_totals"][s["kind"]] =
    self._config["kind_totals"].get(s["kind"], 0) + s["quantity"]`.
  - `DynamoStore`: `UpdateExpression="SET kind_totals.#k =
    if_not_exists(kind_totals.#k, :zero) + :q, total_quantity =
    total_quantity + :q"` with `ExpressionAttributeNames={"#k": kind}` —
    DynamoDB's `ADD` doesn't support creating a new key inside a map, so
    this needs the `SET ... if_not_exists(...)` form instead of a plain
    `ADD`, the one real wrinkle in this migration.
  - The resulting `Donation` record written on approval carries both
    `kind` and `quantity` (renamed from `meals`), exactly as today's
    `meals` is carried.

## Frontend
- `lib/types.ts`: rename `meals`/`packetCount`/`totalMeals` fields to
  `quantity`/`totalQuantity` across `Donation`, `DonationMe`, `Donor`,
  `DonorMe`, `DonorAdminView`, `DonationEvent`, `SubmissionAdminView`,
  `SiteConfig`; add `kind`/`kindTotals` alongside. Add `kinds: string[]`
  to the content-response type.
- `lib/api.ts`: payload shapes for signup/create-donation-event/
  update-donation-event/create-submission follow the same rename.
- New small shared component `KindAndQuantityFields.tsx` (combo-box +
  number input pair) used in three places instead of duplicating the
  "pick from list or type a new one" combo-box logic:
  - **native `<input list="...">` + `<datalist>`** backed by
    `content.kinds` — the simplest way to get "pick from a list or type
    your own" without adding a new UI dependency, consistent with this
    app's preference for plain HTML form elements (see `JoinInForm.tsx`'s
    existing plain `<select>`/`<input>` usage throughout).
  - Used by: `JoinInForm.tsx` (donor mode, replacing the packet-count
    field), `DonorDashboard.tsx`'s create/update-donation-event form
    (replacing `packet_count`), and the proof-submission form (Gallery +
    volunteer "submit for a donor" form), replacing their `meals` field.
  - Defaulting: the donation-event form pre-fills Kind with the donor's
    most-recently-created event's kind (fall back to their signup kind
    for their very first event) — a small `localStorage`-free convenience
    read from `listDonationEventsForDonor` data already fetched by that
    view, not a new API call.
- `Progress.tsx`: `totalMeals` prop → `totalQuantity`; copy "meals
  delivered so far" → "lives impacted so far" (see Copy below);
  `{goal2030.toLocaleString()} meals by 2035` → `{goal2030.toLocaleString()}
  lives by 2035`.
- New `components/DonationKindBreakdown.tsx` — the new public section
  (see "New section" below).
- `AdminSignoff.tsx`: submission review card's `{s.meals} meals
  delivered` → `` `${s.quantity} ${s.kind} delivered` ``.
- `FeaturedDonors.tsx`, `DonorDetail.tsx`, `AdminDirectory.tsx`: rename
  `totalMeals`/`total_meals` display fields to `totalQuantity`; the raw
  number display itself (`d.totalQuantity.toLocaleString()`) is otherwise
  unchanged — these views don't currently say the word "meals" in copy,
  just a bare number, so no copy change needed beyond the field rename.
- `Faq.tsx`: "...a commitment to deliver at least 10,000 meals within 5
  years..." → "...a commitment to deliver at least 10,000 [kind]-equivalent
  units within 5 years..." — see Copy below for final wording.
- `JoinInForm.tsx`: the commitment checkbox label ("I commit to
  delivering at least 10,000 meals within 5 years of joining") becomes
  dynamic, interpolating whichever kind the donor just picked in the Kind
  field above it (e.g. "...at least 10,000 Medicine within 5 years...").
  Falls back to a kind-agnostic phrasing ("...at least 10,000 units of
  help...") only if the Kind field is still empty when rendered (can't
  interpolate nothing) — matches required-field validation already
  forcing Kind to be filled before submit anyway, so this fallback is a
  brief pre-fill state, not a real end state.

### New section: kind breakdown (`DonationKindBreakdown.tsx`)
Rendered on the homepage directly below `Progress` (`app/page.tsx`, same
gating on `content` being loaded as every other home-view section). Pulls
straight from `content.config.kindTotals` (already fetched as part of the
normal `GET /api/content` call every page load already makes — no new
request). Renders as a simple horizontal stat row (reuses the card/stat
shell already used by `FeaturedDonors`' summary strip, not a new visual
language): one tile per kind present in `kindTotals`, "`{quantity}
{kind}`", sorted descending by quantity. Kinds with `0` or absent from
`kindTotals` (no completed donations yet) are simply not in the map, so
nothing to filter — the breakdown only ever shows kinds that have at
least one completed donation, automatically.

## Copy
Exact text changes, called out because they're easy to get subtly wrong:
- `Progress.tsx` eyebrow "Every Meal Counts" → kept as-is; it's the
  section's visual eyebrow label tied to the Hero's origin story tone,
  not a literal data claim, and the founder's framing decision was about
  the *counter number's* label, not this tagline. (Flagging the
  distinction here in case the founder wants it changed too — not
  changing it preemptively.)
- `Progress.tsx` body copy: "meals delivered so far — verified by photo
  proof from our volunteers, on the way to touching a million lives" →
  "lives impacted so far — verified by photo proof from our volunteers,
  on the way to touching a million lives" (the back half already said
  "lives" — this just makes the headline number match the sentence it
  sits in, rather than contradict it).
- `Progress.tsx`: "{goal2030} meals by 2035" → "{goal2030} lives by 2035".
- `Hero.tsx`: **unchanged** per the founder's framing decision — the
  origin story and "No One Should Starve For A Meal" headline stay; it
  already reads as "we started here, more is coming" (see requirements).
- `Faq.tsx` donor-application answer: "...including your story and a
  commitment to deliver at least 10,000 meals within 5 years..." →
  "...including your story and a commitment to deliver at least 10,000
  [chosen kind] within 5 years..." — since the FAQ is static, kind-free
  copy (not tied to any specific donor's form state), this becomes
  "...a commitment to deliver at least 10,000 units of help (food,
  medicine, supplies, and more) within 5 years...".
- `JoinInForm.tsx` commitment checkbox + helper text: dynamic per above.

## Data / migration
### Backfill script
New one-off script (this repo has no prior migration-script precedent —
first one): `backend/scripts/backfill_donation_kind.py`. Plain boto3,
not wired into the app or CI, run manually once per environment by the
founder after deploying this feature's code (so the new `kind`/`quantity`
fields exist in the model before old items need to satisfy them):
- Scans `donations`, `submissions` (approved + rejected + pending —
  all of them, since even pending/rejected ones predate the kind concept
  and `kind` is otherwise required on every `SubmissionAdminView`), and
  `donation_events` (every status) for items missing a `kind` attribute.
- For each: `UpdateItem` setting `kind = "Food Packets"` and renaming
  `meals`/`packet_count` → `quantity` (copy value to new attribute name,
  then remove the old one in the same `UpdateExpression` via `SET
  quantity = meals REMOVE meals`, one write per item).
- Also updates the single `config` item: `total_meals` → `total_quantity`
  (rename-copy, same pattern) and seeds `kind_totals = {"Food Packets":
  <current total_quantity>}` — the whole existing total is attributed to
  Food Packets, which matches reality (every donation prior to this
  feature was food).
- Also updates every `donors` item: `total_meals` → `total_quantity`
  rename-copy (donor-level totals don't need a per-kind breakdown, only
  the site-wide `config` does, per requirements — donor profile pages
  just show one number).
- Idempotent (skips items that already have `quantity`/`total_quantity`
  set, so it's safe to re-run if interrupted partway).
- Run once against dev, verify via the admin dashboard and homepage, then
  once against prod — same "verify in dev first" discipline as any other
  prod-facing manual step in this repo.

### Terraform
`infra/modules/data/main.tf`: new `aws_dynamodb_table.donation_kinds`
resource (hash key `kind`, `PAY_PER_REQUEST`, no GSI). `outputs.tf`:
add to both `table_names` and `table_arns` (the existing wildcard IAM
statement in `infra/modules/api/main.tf`'s `DynamoDbAccess` picks this up
automatically via `var.table_arns` — no new IAM statement to write, same
as every prior new table in this repo).
`infra/modules/api/main.tf`: add `DONATION_KINDS_TABLE =
var.table_names["donation_kinds"]` to the Lambda's environment block,
alongside the existing `*_TABLE` vars.

### Seeding
The starter five kinds are inserted the same way `ensure_donation_kind_exists`
works for any new kind — either a tiny one-time `PutItem` loop added to
the backfill script (simplest: one more step in the same script that
already runs once per environment), or lazily the first time any of them
is actually used. Script approach is more predictable (the combo-box
isn't empty on day one for a donor who hasn't thought of a kind yet), so
the backfill script seeds all five explicitly before migrating existing
records.

## Testing
- Backend: new/updated tests for `ensure_donation_kind_exists`
  (idempotency), signup/donation-event/submission validation now
  requiring `kind`, `approve_submission`'s `kind_totals` increment
  (including the "first donation of a brand-new kind" no-existing-key
  case for `DynamoStore`'s `if_not_exists`), and `GET /api/content`
  returning `kinds`.
- Frontend: existing e2e specs touching `packet_count`/meals-labeled
  fields (`frontend/e2e/*`) updated for the renamed fields and the new
  Kind input; one new e2e covering "type a brand-new kind at signup, see
  it selectable in the datalist on a second form load."
- Manual: run the backfill against local `DATA_BACKEND=dynamo` (or
  inspect `LocalStore`'s in-memory seed) and confirm the homepage
  breakdown section renders correctly before touching real prod data.
