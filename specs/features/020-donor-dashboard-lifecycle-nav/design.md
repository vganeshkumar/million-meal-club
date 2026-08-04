# Feature: Donor Dashboard Lifecycle Navigation — Design

## 1. Backend: a real "completed" status

### `backend/app/models/domain.py`
```python
DonationEventStatus = Literal["scheduled", "submitted", "completed", "cancelled"]
```

### `Store.approve_submission` (`local_store.py` / `dynamo_store.py`)
After the existing "create a Donation record, bump total_meals, mark the
submission approved" logic, if the submission carries a
`donation_event_id`, that event's status is set to `"completed"` (mirrors
`reject_submission`'s existing "reset to `scheduled`" behavior).

### Guards that assumed `"submitted"` was the only non-`"scheduled"`,
non-`"cancelled"` state
Three checks pre-dated the `"completed"` status and need it added
alongside `"submitted"`, or a `"completed"` event could be reassigned,
cancelled, or re-submitted-against after the fact:
- `assign_donation_event_volunteer`: rejects reassignment when status is
  `"submitted"` **or `"completed"`**.
- `cancel_donation_event`: rejects cancellation when status is
  `"submitted"`, `"completed"`, or `"cancelled"`.
- `POST /submissions` (`app/routers/submissions.py`): rejects a second
  submission against an event whose status is `"submitted"` **or
  `"completed"`**.

## 2. Frontend: `lib/types.ts`
```ts
export type DonationEventStatus =
  | "scheduled"
  | "submitted"
  | "completed"
  | "cancelled";
```

## 3. Homepage Events tab fix

### `components/Events.tsx`
```ts
const completedDonationEvents = donationEvents.filter(
  (d) => d.status === "completed", // was "submitted"
);
```
Everything else in the component (the Scheduled/Completed toggle, card
layout, "Delivered ✓" badge) is unchanged — it was already written for a
genuine completed state, the filter just hadn't caught up.

## 4. `components/DonorDashboard.tsx` restructure

`DonorDashboard` becomes the single owner of donor-scoped fetch state —
`donor`, `events` (all of this donor's donation events, any status), and
`volunteers` (sorted by country-match, as before) — replacing the two
separate fetches that `DonationEventsSection` and `SubmitProofSection` each
did independently in 019. A `DashboardTab` union drives which subsection
renders in the right-hand content frame:

```ts
type DashboardTab =
  | "overview" | "schedule" | "scheduled" | "completed"
  | "submit-proof" | "pending-approval" | "profile";
```

Derived slices passed down as props:
```ts
const scheduledEvents = events?.filter((e) => e.status === "scheduled") ?? [];
const pendingApprovalEvents = events?.filter((e) => e.status === "submitted") ?? [];
```
`refreshEvents()` (a plain `GET /donation-events/mine` re-fetch) is passed
down as `onCreated`/`onChanged`/`onSubmitted` to whichever subsection can
mutate an event, so every tab reading from `events` picks up the change
immediately without each subcomponent re-fetching independently.

### New/renamed subcomponents
- `OverviewSection` — donor summary line, local-dev-login box,
  stat cards. Straight extraction of what was previously inline in the
  "overview" branch.
- `ScheduleDonationSection` — the create-form half of the old
  `DonationEventsSection` (same fields, same mutual-exclusivity behavior
  between delivery-role radios and partner-charity select, same
  conditional "Assign a volunteer" select). Drops the events list that used
  to render below the form. Heading text: "Schedule new donation events".
- `ScheduledEventsSection` — the list half of the old
  `DonationEventsSection` (assign-volunteer select + Cancel button per
  card), now driven by the `scheduledEvents` prop instead of its own fetch,
  and simplified since every card it renders is guaranteed
  `status === "scheduled"` (no more per-card status branching for
  "Cancelled"/"Submitted").
- `PendingApprovalSection` — new. Read-only cards (no assign/cancel — the
  event is locked in review) for `pendingApprovalEvents`, each tagged
  "Awaiting admin approval". `data-testid="pending-approval-event-card"`.
- `CompletedEventsSection` — the old inline "Delivery history" block,
  renamed, now reading `donor.donations` (unchanged data source — approved
  donations, whether or not they started as a scheduled event).
- `SubmitProofSection` — same form as before, but now takes
  `scheduledEvents`/`onSubmitted` as props instead of doing its own
  `listMyDonationEvents()` fetch, and calls `onSubmitted()` (→
  `refreshEvents`) on success so the event immediately moves out of
  Scheduled/into Pending Approval elsewhere on the page.
- `ProfileSection` — unchanged from 019.

### Nav
Seven buttons, `data-testid`s: `dashboard-nav-overview`,
`dashboard-nav-schedule`, `dashboard-nav-scheduled`,
`dashboard-nav-completed`, `dashboard-nav-submit-proof`,
`dashboard-nav-pending-approval`, `dashboard-nav-profile`. Default tab:
`"overview"`.

## Tests
- `backend/tests/`: no new test file added for this feature; existing
  `test_content_donation_events.py` / `test_cancel_donation_events.py`
  already cover the `submitted`/`scheduled` transitions this design
  doesn't change. The new `submitted → completed` transition isn't
  exercised by a backend unit test — covered end-to-end instead by the e2e
  test below.
- `frontend/e2e/homepage-scheduled-events.spec.ts`: extended to actually
  approve the submission as admin (via `POST
  /admin/submissions/{id}/approve`) before asserting the homepage's
  Completed tab shows the event — previously it asserted this right after
  submission, which only worked because "submitted" and "completed" were
  conflated.
- `frontend/e2e/cancel-donation-events.spec.ts`,
  `dashboard-profile-tab-and-proof-relocation.spec.ts`: updated for the new
  nav links (`dashboard-nav-schedule`/`dashboard-nav-scheduled`) and the
  "Schedule new donation events" heading text; the cancel test's assertion
  changed from "row shows Cancelled" to "row disappears from Scheduled
  Events".
