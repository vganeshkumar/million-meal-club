# Feature: Donation Kinds and Quantity — Tasks

## Infra
- [ ] `infra/modules/data/main.tf`: new `donation_kinds` table (hash key
      `kind`, `PAY_PER_REQUEST`, no GSI).
- [ ] `infra/modules/data/outputs.tf`: add to `table_names` and
      `table_arns`.
- [ ] `infra/modules/api/main.tf`: `DONATION_KINDS_TABLE` env var.
- [ ] `terraform fmt`/`validate`/`plan` for both `dev` and `prod` (no
      `apply` without the founder explicitly asking).

## Backend — models
- [ ] `domain.py`: rename `meals`→`quantity`, `packet_count`→`quantity`,
      `total_meals`→`total_quantity` across `Donation`, `DonationMe`,
      `Donor`, `DonorMe`, `DonorAdminView`, `DonationEvent`,
      `CreateDonationEventRequest`, `UpdateDonationEventRequest`,
      `SignupRequest`, `SignupAdminView`, `SubmissionRequest`,
      `SubmissionAdminView`, `SiteConfig`, `ConfigUpdateRequest`. Add
      `kind` fields alongside each. Add `SiteConfig.kind_totals`.
- [ ] `SignupRequest._validate_required_fields`: require `kind` (not
      just `quantity`) in donor mode.
- [ ] `ContentResponse`: add `kinds: list[str]`.

## Backend — store
- [ ] `Store` protocol: add `ensure_donation_kind_exists(kind: str) ->
      None`.
- [ ] `LocalStore`: seeded `set[str]` of starter kinds;
      `ensure_donation_kind_exists` implementation; rename every
      `meals`/`packet_count`/`total_meals` reference; `approve_submission`
      increments `kind_totals` alongside `total_quantity`.
- [ ] `DynamoStore`: `donation_kinds` table client; same rename across
      every read/write site; `approve_submission`'s config update uses
      `SET kind_totals.#k = if_not_exists(kind_totals.#k, :zero) + :q,
      total_quantity = total_quantity + :q`.
- [ ] Both stores' `get_content()` returns `kinds` (alphabetical, "Food
      Packets" pinned first).

## Backend — endpoints
- [ ] Signup, create/update-donation-event, create-submission handlers
      each call `ensure_donation_kind_exists` after validating, before
      persisting.
- [ ] `admin.py` submission-approval path updated for the rename + new
      `kind_totals` increment.

## Backend — migration
- [ ] `backend/scripts/backfill_donation_kind.py`: seeds the five
      starter kinds; renames `meals`→`quantity`/`packet_count`→`quantity`
      and sets `kind="Food Packets"` on every pre-existing `donations`,
      `submissions`, `donation_events`, `donors`, and the `config` item;
      seeds `kind_totals = {"Food Packets": <existing total>}`;
      idempotent/safely re-runnable.

## Frontend
- [ ] `lib/types.ts` / `lib/api.ts`: rename fields, add `kind`/`kinds`/
      `kindTotals`.
- [ ] New `components/KindAndQuantityFields.tsx` (datalist-backed combo
      box + number input).
- [ ] `JoinInForm.tsx`: donor-mode quantity field → Kind + Quantity;
      commitment checkbox copy interpolates the chosen kind.
- [ ] `DonorDashboard.tsx` create/update-donation-event form: same
      field swap, defaulted from the donor's most recent event (or
      signup kind for their first).
- [ ] Proof-submission forms (Gallery submit + volunteer submit-for-donor):
      same field swap, pre-filled/read-only when tied to a scheduled
      donation event.
- [ ] `Progress.tsx`: prop rename + copy changes ("lives impacted so
      far", "{goal} lives by 2035").
- [ ] New `components/DonationKindBreakdown.tsx`, rendered in
      `app/page.tsx` below `Progress`.
- [ ] `AdminSignoff.tsx` review card: `{quantity} {kind} delivered`.
- [ ] `FeaturedDonors.tsx`, `DonorDetail.tsx`, `AdminDirectory.tsx`:
      `totalMeals`→`totalQuantity` field rename.
- [ ] `Faq.tsx` donor-application answer copy update.
- [ ] Public homepage Scheduled/Completed donation-event feed: show
      kind alongside quantity.

## Tests
- [ ] Backend: `ensure_donation_kind_exists` idempotency;
      kind-required validation on signup/event/submission;
      `approve_submission`'s `kind_totals` increment incl. first-use
      case; `GET /api/content` returns `kinds`.
- [ ] Frontend: update existing e2e specs touching the renamed fields;
      new e2e for "type a new kind, see it selectable afterward."

## Manual verification (before touching prod)
- [ ] Full signup → schedule event → submit proof → approve flow in
      local dev, confirming: Kind/Quantity round-trip correctly, a
      brand-new typed kind shows up in the datalist on a later form
      load, `kind_totals` increments correctly, and the homepage
      breakdown section renders.
- [ ] Run the backfill script against dev data, verify homepage/admin
      views look correct, before ever running it against prod.
