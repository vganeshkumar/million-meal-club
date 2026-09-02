import os
from typing import Protocol

from app.models.domain import (
    ContentResponse,
    DonationEvent,
    Donor,
    DonorAdminView,
    PartnerCharityAdminView,
    SignupRequest,
    Volunteer,
    VolunteerAdminView,
)


class Store(Protocol):
    """Data-access interface. See specs/01-architecture.md for the table
    shapes this mirrors, and specs/backend/design.md for the approval flow
    that mutates totals."""

    def get_content(self) -> ContentResponse: ...

    def get_donor(self, donor_id: str) -> Donor | None: ...

    def list_donor_donation_receipts(self, donor_id: str) -> dict[str, str]:
        """donation_id -> a fresh presigned receipt URL, for whichever of
        this donor's approved donations have a receipt on file. Kept
        separate from get_donor() so the public Donor/Donation model never
        has a code path to a receipt — see
        specs/features/021-completed-event-details/design.md."""
        ...

    def get_volunteer(self, volunteer_id: str) -> Volunteer | None: ...

    def get_or_create_user(
        self, provider: str, subject: str, email: str, name: str
    ) -> tuple[str, str]:
        """Returns (user_id, name)."""
        ...

    def create_signup(
        self, payload: SignupRequest, user_id: str | None, name: str, email: str
    ) -> str:
        """`name`/`email` are already resolved by the router (session
        values when signed in, otherwise the form's) — fixes a bug where a
        signed-in applicant's `name` was never captured (the frontend omits
        it when signed in, expecting the backend to fill it from the
        session, which previously nothing did). Always stores
        `status: "requested_signoff"`, for both modes — neither donor nor
        volunteer applications create their real record here; that happens
        in `approve_signup`. See
        specs/features/011-volunteer-application-approval/design.md."""
        ...

    def list_signups(self, status: str) -> list[dict]: ...

    def approve_signup(self, signup_id: str) -> tuple[str, str, str]:
        """Marks the signup approved, creates an unclaimed Donor or
        Volunteers row from it (branching on the signup's `mode`), and
        returns (name, email, mode) — the router uses `mode` to pick the
        matching onboarding email. See
        specs/features/011-volunteer-application-approval/design.md."""
        ...

    def reject_signup(self, signup_id: str) -> None: ...

    def resolve_donor_id(self, user_id: str, email: str) -> str | None:
        """find-or-claim-or-None. `email` is the session's already-verified
        email (from the caller's AuthUser), not re-derived from storage —
        keeps this independent of whether a Users row happens to exist for
        user_id. Returns None (does not raise) if this user isn't linked to
        (or claimable as) an approved donor — see
        specs/features/007-donor-application-approval/design.md and
        specs/features/008-persona-dashboards-and-roles/design.md (this used
        to raise DonorNotApprovedError; callers now check for None so
        GET /api/donors/me can reuse it for its 404 case)."""
        ...

    def resolve_volunteer_id(self, user_id: str, email: str) -> str | None:
        """Same find-or-claim-or-None shape as resolve_donor_id, against
        Volunteers instead of Donors — but there's no "approved" concept to
        deny on, since volunteers are linkable as soon as they sign up."""
        ...

    def update_donor_profile(
        self, donor_id: str, location: str, country: str, story: str
    ) -> Donor:
        """Updates the donor's own editable fields — see
        specs/features/018-profile-edit/design.md. Caller (the router) has
        already resolved `donor_id` for the signed-in user."""
        ...

    def update_volunteer_profile(
        self,
        volunteer_id: str,
        location: str,
        country: str,
        packets_per_trip: int,
        availability: str,
        volunteering_history: str | None,
        references: str | None,
    ) -> Volunteer:
        """Same idea as update_donor_profile, against Volunteers — see
        specs/features/024-volunteer-profile-full-fields/design.md."""
        ...

    def get_donor_local_username(self, donor_id: str) -> str | None:
        """The generated local-dev username on this Donor (set at
        approval time), if any. See
        specs/features/015-local-dev-generated-credentials/design.md."""
        ...

    def get_volunteer_local_username(self, volunteer_id: str) -> str | None:
        """Same idea as get_donor_local_username, for Volunteers."""
        ...

    def resolve_local_login(self, username: str) -> tuple[str, str] | None:
        """(email, name) for whichever Donor or Volunteer has this
        generated local_username, else None. The router signs the match
        in through the normal get_or_create_user +
        resolve_donor_id/resolve_volunteer_id claim-by-email path — same
        mechanism a real OAuth sign-in uses, so is_donor/is_volunteer
        resolve correctly with no special-casing. See
        specs/features/015-local-dev-generated-credentials/design.md."""
        ...

    def add_event_rsvp(self, volunteer_id: str, event_id: str) -> None: ...

    def remove_event_rsvp(self, volunteer_id: str, event_id: str) -> None: ...

    def list_volunteers(self) -> list[Volunteer]:
        """Donor-facing directory for the donation-event assignment picker
        — see specs/features/009-scheduled-donation-events/design.md.
        Excludes disabled volunteers — see
        specs/features/016-admin-membership-status/design.md."""
        ...

    def list_all_donors(self) -> list[DonorAdminView]:
        """Every donor, any status — admin directory. See
        specs/features/016-admin-membership-status/design.md."""
        ...

    def list_all_volunteers(self) -> list[VolunteerAdminView]:
        """Every volunteer, any status — admin directory. See
        specs/features/016-admin-membership-status/design.md."""
        ...

    def set_donor_status(self, donor_id: str, status: str) -> None: ...

    def set_volunteer_status(self, volunteer_id: str, status: str) -> None: ...

    def is_membership_disabled(self, user_id: str, email: str) -> bool:
        """True if any Donor or Volunteer row matching this identity
        (linked user_id, or email — same find-by-either shape as
        resolve_donor_id/resolve_volunteer_id) has status == 'disabled'.
        Checked at sign-in time, before a session is issued — see
        specs/features/016-admin-membership-status/design.md."""
        ...

    def create_donation_event(
        self,
        donor_id: str,
        donor_name: str,
        location: str,
        date: str,
        start_time: str,
        end_time: str,
        volunteer_id: str | None,
        volunteer_name: str | None,
        latitude: float | None = None,
        longitude: float | None = None,
        packet_count: int | None = None,
        delivery_role: str | None = None,
        partner_charity: str | None = None,
        notes: str | None = None,
    ) -> DonationEvent: ...

    def list_donation_events_for_donor(self, donor_id: str) -> list[DonationEvent]: ...

    def list_donation_events_for_volunteer(
        self, volunteer_id: str
    ) -> list[DonationEvent]: ...

    def list_all_donation_events(self) -> list[DonationEvent]:
        """Every DonationEvent, any donor, any status — powers the public
        #events Scheduled/Completed feed on GET /api/content. See
        specs/features/014-homepage-scheduled-events/design.md."""
        ...

    def get_donation_event(self, event_id: str) -> DonationEvent | None: ...

    def assign_donation_event_volunteer(
        self,
        event_id: str,
        volunteer_id: str | None,
        volunteer_name: str | None,
    ) -> DonationEvent:
        """Raises ValueError if the event is already `submitted` —
        reassignment is locked once proof has been submitted against it."""
        ...

    def cancel_donation_event(self, event_id: str) -> DonationEvent:
        """Raises ValueError if the event doesn't exist or is already
        `submitted`/`cancelled` — same "locked once final" rule as
        assign_donation_event_volunteer. See
        specs/features/017-cancel-donation-events/design.md."""
        ...

    def update_donation_event(
        self,
        event_id: str,
        location: str,
        date: str,
        start_time: str,
        end_time: str,
        packet_count: int | None,
        delivery_role: str | None,
        partner_charity: str | None,
        notes: str | None,
        latitude: float | None = None,
        longitude: float | None = None,
    ) -> DonationEvent:
        """Raises ValueError if the event doesn't exist or isn't
        `scheduled` (submitted/completed/cancelled are all locked) — same
        "locked once final" rule as cancel_donation_event. This is a full
        replace of these fields, not a patch-in: omitted optional fields
        are cleared, not left as-is. See
        specs/features/022-edit-scheduled-donation-event/design.md."""
        ...

    def create_submission(
        self,
        donor_id: str,
        submitted_by_user_id: str,
        location: str,
        meals: int,
        photo_keys: list[str],
        cover_photo_key: str,
        receipt_key: str | None,
        caption: str | None,
        delivery_role: str | None,
        partner_charity: str | None,
        donation_event_id: str | None = None,
    ) -> str:
        """`donor_id` is already resolved by the caller (the router) —
        either the submitter's own linked donor, or (when a linked
        volunteer is submitting on someone's behalf) the chosen donor. See
        specs/features/008-persona-dashboards-and-roles/design.md. When
        `donation_event_id` is set, this also atomically flips that
        DonationEvent to `submitted` (storing this submission's id on it)
        — see specs/features/009-scheduled-donation-events/design.md."""
        ...

    def list_submissions(self, status: str) -> list[dict]: ...

    def approve_submission(self, submission_id: str) -> None: ...

    def reject_submission(self, submission_id: str) -> None:
        """If this submission referenced a DonationEvent, reopens it back
        to `scheduled` (a rejected submission means "this didn't count,"
        not "this delivery didn't happen") — see
        specs/features/009-scheduled-donation-events/design.md."""
        ...

    def update_config(self, **fields) -> None: ...

    def create_partner_charity(
        self,
        name: str,
        location: str,
        description: str,
        core_services: str | None = None,
        founder_details: str | None = None,
        years_active: str | None = None,
        awards_credentials: str | None = None,
        website_url: str | None = None,
        donation_url: str | None = None,
        tax_refund_eligible: bool | None = None,
        email: str | None = None,
    ) -> PartnerCharityAdminView:
        """Admin-only — see
        specs/features/026-charity-partner-admin-and-homepage/design.md.
        `email` is admin-only contact info, never public — see
        specs/features/031-charity-partner-contact-email/design.md."""
        ...

    def list_all_partner_charities(self) -> list[PartnerCharityAdminView]:
        """Every partner charity, any status — admin directory (unlike
        get_content(), which only returns active ones). See
        specs/features/027-charity-partner-edit-and-deactivate/design.md."""
        ...

    def update_partner_charity(
        self,
        charity_id: str,
        name: str,
        location: str,
        description: str,
        core_services: str | None,
        founder_details: str | None,
        years_active: str | None,
        awards_credentials: str | None,
        website_url: str | None,
        donation_url: str | None,
        tax_refund_eligible: bool | None,
        email: str | None = None,
    ) -> PartnerCharityAdminView:
        """Full replace of these fields, same "not a patch-in" convention as
        update_donation_event. Raises ValueError if the charity doesn't
        exist."""
        ...

    def set_partner_charity_status(self, charity_id: str, status: str) -> None:
        """Raises ValueError if the charity doesn't exist. Disabling doesn't
        touch any DonationEvent/Submission that already recorded this
        charity's name — those are point-in-time snapshots, not live
        references. See
        specs/features/027-charity-partner-edit-and-deactivate/design.md."""
        ...


_store: Store | None = None


def get_store() -> Store:
    global _store
    if _store is not None:
        return _store

    backend = os.environ.get("DATA_BACKEND", "local")
    if backend == "dynamodb":
        from app.services.dynamo_store import DynamoStore

        _store = DynamoStore()
    else:
        from app.services.local_store import LocalStore

        _store = LocalStore()
    return _store
