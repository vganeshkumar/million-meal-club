# Feature: Dashboard Profile Tab, Proof-of-Delivery Relocation, Full Event Scheduling — Design

## 1. Profile as a left-nav tab

### `components/DonorDashboard.tsx` / `components/VolunteerDashboard.tsx`
Both components gain a small local `tab` state (`"overview" | "profile"`,
default `"overview"`) and a two-column wrapper:

```tsx
<div className="mx-auto flex max-w-[960px] gap-10 px-[clamp(20px,5vw,56px)] py-[clamp(40px,6vw,72px)]">
  <nav className="w-40 shrink-0 flex flex-col gap-1">
    <button onClick={() => setTab("overview")} data-active={tab === "overview"}>
      My Donations {/* "My Volunteering" in VolunteerDashboard */}
    </button>
    <button onClick={() => setTab("profile")} data-active={tab === "profile"}>
      Profile
    </button>
  </nav>
  <div className="min-w-0 flex-1">
    {tab === "overview" ? <>{/* existing content */}</> : (
      <ProfileSection donor={donor} onSaved={setDonor} />
    )}
  </div>
</div>
```

No new URL hash route — the outer `#my-donations`/`#my-volunteering` view
in `app/page.tsx` is unchanged; this is purely local UI state, since nothing
outside the component needs to observe which inner tab is active (a direct
link always lands on "My Donations"/"overview" and the founder didn't ask
for deep-linking into Profile). `ProfileSection` itself (added in
[[../018-profile-edit/design]]) is unchanged other than moving where it's
rendered — same props (`donor`/`onSaved` or `volunteer`/`onSaved`).

Nav buttons get `data-testid="dashboard-nav-profile"` /
`data-testid="dashboard-nav-overview"` for e2e targeting (avoids relying on
label text, which is ambiguous — "My Donations" also appears as the page's
`<h1>`).

## 2. Gallery retires from the homepage; proof submission moves to My Donations

### `app/page.tsx`
Removes the `<Gallery ... />` block and its import entirely from the
`view === "home"` branch. `content.gallery` (the `ContentResponse` field)
and the backend gallery plumbing are left as-is — untouched, just unused by
any page — reviving a public gallery later is a separate decision, not this
feature's concern.

### `components/Header.tsx`
`NAV_LINKS` drops the `{ href: "#gallery", label: "Gallery" }` entry — the
anchor no longer exists.

### `components/Gallery.tsx`
Deleted. Its only caller was `app/page.tsx`; once that's gone it's dead
code (per project convention: delete rather than leave unused).

### `components/DonorDashboard.tsx` — new `SubmitProofSection`
A new subcomponent under the "overview" tab, directly below
`DonationEventsSection`, replacing the old "Head to the Proof of Delivery
section..." pointer paragraph. Functionally a straight port of
`Gallery.tsx`'s submission form onto this page:
- Fetches the donor's own scheduled events the same way
  `DonationEventsSection` already does (`api.listMyDonationEvents()`,
  filtered to `status === "scheduled"`) — a second, independent fetch
  (kept separate from `DonationEventsSection`'s own state; simpler than
  threading shared state between sibling components for a page this size).
- Same fields as the old Gallery form: optional "Which scheduled donation
  is this for?" picker (autofills + locks location, shows assigned
  volunteer), Location, Meals Delivered, Photo Proof (required), Receipt
  (optional), delivery-role radios, partner-charity select, Caption.
- No "Submitting as {name}" banner or sign-in gate — the donor is already
  known and signed in to be on this page at all (unlike the old homepage
  Gallery, reachable while signed out).
- Calls `api.submitProof(...)` exactly as `Gallery.tsx` did.
- Needs `partnerCharities: PartnerCharity[]` — a new prop threaded onto
  `DonorDashboard`, sourced the same place `JoinInForm` already gets it:
  `<DonorDashboard partnerCharities={content?.partnerCharities ?? []} />`
  in `app/page.tsx` (empty array before `content` resolves — the section
  degrades gracefully, same as every other content-dependent section on
  this component already does implicitly via optional chaining).

## 3. Scheduling a donation event asks for full signup-style detail

### `backend/app/models/domain.py`
```python
class DonationEvent(CamelModel):
    id: str
    donor_id: str
    donor_name: str
    location: str
    date: str
    volunteer_id: str | None = None
    volunteer_name: str | None = None
    status: DonationEventStatus = "scheduled"
    submission_id: str | None = None
    packet_count: int | None = None
    delivery_role: Literal["self", "volunteer_needed"] | None = None
    partner_charity: str | None = None
    notes: str | None = None


class CreateDonationEventRequest(BaseModel):
    location: str
    date: str
    volunteer_id: str | None = None
    packet_count: int | None = None
    delivery_role: Literal["self", "volunteer_needed"] | None = None
    partner_charity: str | None = None
    notes: str | None = None
```

### `Store.create_donation_event` / `LocalStore` / `DynamoStore`
Signature gains the four new optional params, stored alongside the
existing row fields and threaded through `_donation_event_from_row`/
`_donation_event_from_item`. No validation beyond typing — these are all
optional, unlike the signup form's required-OR-group between
`delivery_role`/`partner_charity` (out of scope, see requirements.md).

### `app/routers/donation_events.py`
`create_donation_event` passes the four new fields from `body` straight
through to `store.create_donation_event(...)`.

### Frontend
`lib/types.ts`'s `DonationEvent` gains `packetCount?`, `deliveryRole?`,
`partnerCharity?`, `notes?`. `api.createDonationEvent`'s payload type gains
the matching snake_case fields.

`DonorDashboard.tsx`'s `DonationEventsSection` create form gains, below the
existing Location/Date/Assign-a-volunteer fields:
- "Number of Food Packets" (`packet_count`, optional number input)
- Delivery role radios — "I'll deliver it myself" / "I need a volunteer to
  collect & deliver" (`delivery_role`) — mutually exclusive with the
  partner-charity select below, matching the home page's Join In form;
  picking "need a volunteer" reveals the volunteer-assignment `<select>`
  conditionally, rather than showing it unconditionally as first designed
  here (superseded — see
  [[../020-donor-dashboard-lifecycle-nav/design]])
- "Delivered through a partner charity instead" (`partner_charity`,
  optional select, same `partnerCharities` prop as `SubmitProofSection`)
- "Notes" (optional textarea)

The event card (both the donor's own list and, for free, the admin
directory once it re-fetches) doesn't need new display copy for this
feature — packet count/partner charity are stored for the founder's future
reference, not surfaced as new UI chrome here (see requirements.md's "Out
of scope").

## Tests
- `backend/tests/test_donation_event_fields.py`: creating a donation event
  with the new optional fields round-trips them through
  `GET /donation-events/mine`; omitting them still works (all `None`).
- `frontend/e2e/profile-edit.spec.ts`: updated to reach the Profile tab via
  the new left-nav link instead of assuming it's inline.
- `frontend/e2e/cancel-donation-events.spec.ts` /
  `homepage-scheduled-events.spec.ts`: updated for the new two-column
  layout (`dashboard-nav-overview`/`schedule-donation-form` scoping already
  in place from 018 still applies) and, for
  `homepage-scheduled-events.spec.ts`, submitting proof from My Donations
  instead of the retired homepage Gallery form.
- `frontend/e2e/admin-application-filter.spec.ts` /
  `volunteer-application-approval.spec.ts`: their "signed-out Gallery
  section has its own Sign In button" comments/scoping assumptions no
  longer apply once Gallery is gone — verified they don't actually depend
  on Gallery's presence (the header-scoped Sign In button they use exists
  independent of Gallery).
