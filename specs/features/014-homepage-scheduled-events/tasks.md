# Feature: Homepage Scheduled/Completed Events — Tasks

- [ ] Backend: `ContentResponse.donation_events`; `Store.list_all_donation_events`
      in `local_store.py`/`dynamo_store.py`; wired into `get_content()`.
- [ ] Frontend: `lib/types.ts` — `ContentResponse.donationEvents`.
- [ ] Frontend: `app/page.tsx` — split the mount-only effect so content
      refetches on every `view === "home"` transition.
- [ ] Frontend: `Events.tsx` — Scheduled/Completed toggle, donation-event
      cards, disabled-when-empty toggle behavior.
- [ ] Backend test (`backend/tests/test_content_donation_events.py`):
      scheduled → appears as scheduled; after submission → appears as
      submitted.
- [ ] Frontend test (`frontend/e2e/homepage-scheduled-events.spec.ts`):
      schedule → shows under Scheduled on homepage; submit proof → moves
      to Completed.
