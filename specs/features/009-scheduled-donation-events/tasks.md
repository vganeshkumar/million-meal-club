# Feature: Scheduled Donation Events — Tasks

- [ ] Backend: `DonationEvent`, `CreateDonationEventRequest`,
      `AssignVolunteerRequest`, `VolunteerSummary` models;
      `SubmissionRequest`/`SubmissionAdminView` gain `donation_event_id`.
- [ ] Backend: `Store` protocol — `list_volunteers`, `create_donation_event`,
      `list_donation_events_for_donor`, `list_donation_events_for_volunteer`,
      `get_donation_event`, `assign_donation_event_volunteer`;
      `create_submission` gains `donation_event_id` and closes the event
      atomically; `reject_submission` reopens a linked event.
- [ ] Backend: implement all of the above in both `local_store.py` and
      `dynamo_store.py`.
- [ ] Backend: new `app/routers/donation_events.py` — create, list mine
      (donor), assign volunteer, list assigned (volunteer); register in
      `main.py`.
- [ ] Backend: `GET /api/volunteers` in `app/routers/volunteers.py`
      (donor-only directory for the assignment picker).
- [ ] Backend: `submissions.py` — `donation_event_id` branch (404/409/403
      cases), falls through to existing `donor_id`/self paths unchanged.
- [ ] Infra: `DonationEvents` table (`donor-index`, `volunteer-index` GSIs)
      in `modules/data`; `DONATION_EVENTS_TABLE` env var in `modules/api`;
      `terraform fmt`/`validate` in both envs.
- [ ] Frontend: `lib/types.ts` (`DonationEvent`, `VolunteerSummary`,
      `SubmissionPayload.donation_event_id`), `lib/api.ts` (new calls).
- [ ] Frontend: `DonorDashboard.tsx` — schedule-a-donation form, event list,
      volunteer (re)assignment control.
- [ ] Frontend: `Gallery.tsx` — optional donation-event picker with
      location auto-fill and read-only assigned-volunteer name.
- [ ] Frontend: `VolunteerDashboard.tsx`'s `SubmitForDonorForm` — donation-
      event picker (replaces the always-visible donor-ID field with a
      picker that falls back to manual entry), read-only donor name.
- [ ] Specs: `01-architecture.md` gets the new table + a short "Donor
      approval & claiming" cross-reference note.
- [ ] Manual/curl test: donor creates an event with no volunteer → shows up
      in `GET /api/donation-events/mine` as `scheduled`, unassigned.
- [ ] Manual/curl test: donor assigns a volunteer → event shows up in that
      volunteer's `GET /api/donation-events/volunteer-assigned`.
- [ ] Manual/curl test: volunteer submits proof with `donation_event_id` →
      submission lands on the event's `donor_id`; event flips to
      `submitted`; a second submission attempt (by either party) against
      the same event → `409`.
- [ ] Manual/curl test: admin rejects that submission → event reopens to
      `scheduled`; a retry submission against it now succeeds.
- [ ] Manual/curl test: a user who is neither the event's donor nor its
      assigned volunteer attempts to submit against it → `403`.
- [ ] Manual/curl test: donor tries to reassign the volunteer on an already-
      `submitted` event → `409`.
- [ ] Manual test (frontend): schedule a donation event as the dummy donor,
      assign the dummy volunteer, submit proof as the dummy volunteer via
      the event picker (confirm donor name auto-populates), confirm it
      disappears from both pickers afterward, confirm the freeform
      donor-ID fallback still works for an unrelated donor.
- [ ] `npm run build` / `npm run lint` clean; backend still imports
      (`uv run python -c "from app.main import app"`).
