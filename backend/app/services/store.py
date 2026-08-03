import os
from typing import Protocol

from app.models.domain import (
    ContentResponse,
    DonationEvent,
    Donor,
    SignupRequest,
    Volunteer,
)


class Store(Protocol):
    """Data-access interface. See specs/01-architecture.md for the table
    shapes this mirrors, and specs/backend/design.md for the approval flow
    that mutates totals."""

    def get_content(self) -> ContentResponse: ...

    def get_donor(self, donor_id: str) -> Donor | None: ...

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
        session, which previously nothing did). For mode == 'volunteer',
        also creates an unclaimed Volunteers row immediately (no approval
        gate) — see specs/features/008-persona-dashboards-and-roles/design.md."""
        ...

    def list_signups(self, status: str) -> list[dict]: ...

    def approve_signup(self, signup_id: str) -> tuple[str, str]:
        """Marks the signup approved, creates an unclaimed Donor row from
        it, and returns (name, email) for the onboarding email."""
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

    def provision_dummy_donor(self, user_id: str, email: str, name: str) -> str:
        """Local-testing-only convenience for `POST /api/auth/dummy`
        (role="donor") — idempotent: if this user_id/email already resolves
        to a donor, returns it unchanged; otherwise creates an
        already-linked donor with one sample donation, so "My Donations" is
        previewable without running the real apply -> admin-approve loop.
        See specs/features/008-persona-dashboards-and-roles/design.md."""
        ...

    def provision_dummy_volunteer(self, user_id: str, email: str, name: str) -> str:
        """Same idea as provision_dummy_donor, for role="volunteer"."""
        ...

    def add_event_rsvp(self, volunteer_id: str, event_id: str) -> None: ...

    def remove_event_rsvp(self, volunteer_id: str, event_id: str) -> None: ...

    def list_volunteers(self) -> list[Volunteer]:
        """Donor-facing directory for the donation-event assignment picker
        — see specs/features/009-scheduled-donation-events/design.md."""
        ...

    def create_donation_event(
        self,
        donor_id: str,
        donor_name: str,
        location: str,
        date: str,
        volunteer_id: str | None,
        volunteer_name: str | None,
    ) -> DonationEvent: ...

    def list_donation_events_for_donor(self, donor_id: str) -> list[DonationEvent]: ...

    def list_donation_events_for_volunteer(
        self, volunteer_id: str
    ) -> list[DonationEvent]: ...

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

    def create_submission(
        self,
        donor_id: str,
        submitted_by_user_id: str,
        location: str,
        meals: int,
        photo_key: str,
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
