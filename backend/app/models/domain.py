from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, model_validator
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base for response models the frontend consumes — serializes to
    camelCase JSON (matching frontend/lib/types.ts) while keeping snake_case
    field names on the Python side."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Donation(CamelModel):
    id: str
    date: str
    location: str
    meals: int
    caption: str
    # Up to 5 photos per delivery, submitter-ordered; `cover_photo_url` is
    # the one the submitter chose to represent this delivery anywhere only
    # a single fixed-size image is shown. See
    # specs/features/025-multi-photo-proof-with-cover/design.md.
    photo_urls: list[str] | None = None
    cover_photo_url: str | None = None


class DonationMe(Donation):
    """A donor's own view of one of their donations — adds the receipt,
    which the public Donor/Donation model (used by GET /donors/{id}) never
    carries. See specs/features/021-completed-event-details/design.md."""

    receipt_url: str | None = None


class Donor(CamelModel):
    id: str
    name: str
    location: str
    country: str = ""
    story: str
    total_meals: int
    donation_count: int
    donations: list[Donation] | None = None
    # When this donor was approved — absent for donors approved before this
    # field existed. Lets the frontend show "Joined <date>" in place of a
    # delivery list for a donor with no donations yet.
    created_at: str | None = None


class DonorMe(Donor):
    """GET /api/donors/me only — the public Donor model (also used by
    GET /api/donors/{id}) deliberately never carries this, so there is no
    code path where the public route could ever return it. See
    specs/features/015-local-dev-generated-credentials/design.md."""

    local_username: str | None = None
    # Overrides Donor.donations' element type to include receipt_url — see
    # DonationMe. specs/features/021-completed-event-details/design.md.
    donations: list[DonationMe] | None = None


class EventItem(CamelModel):
    id: str
    date: str
    time: str
    location: str
    packets_goal: int
    description: str


MembershipStatus = Literal["active", "disabled"]


class PartnerCharity(CamelModel):
    id: str
    name: str
    location: str
    description: str
    core_services: str | None = None
    founder_details: str | None = None
    years_active: str | None = None
    awards_credentials: str | None = None
    website_url: str | None = None
    donation_url: str | None = None
    tax_refund_eligible: bool | None = None
    status: MembershipStatus = "active"
    created_at: str | None = None


class PartnerCharityAdminView(CamelModel):
    """Admin-only view of a partner charity — see
    specs/features/031-charity-partner-contact-email/design.md. A
    genuinely separate class from the public PartnerCharity (not a
    subclass), same discipline as DonorAdminView/VolunteerAdminView being
    distinct from the public Donor/Volunteer, so there's no code path
    where GET /api/content could ever return `email`. Stays a CamelModel
    (unlike DonorAdminView/VolunteerAdminView's plain snake_case
    BaseModel) since AdminPartnerCharities.tsx already consumes every
    other charity field as camelCase."""

    id: str
    name: str
    location: str
    description: str
    core_services: str | None = None
    founder_details: str | None = None
    years_active: str | None = None
    awards_credentials: str | None = None
    website_url: str | None = None
    donation_url: str | None = None
    tax_refund_eligible: bool | None = None
    email: str | None = None
    status: MembershipStatus = "active"
    created_at: str | None = None


class Volunteer(CamelModel):
    """See specs/features/008-persona-dashboards-and-roles/design.md —
    mirrors Donor's public-safety rule: internal-only fields (email,
    user_id) never appear here."""

    id: str
    name: str
    location: str
    country: str = ""
    packets_per_trip: int | None = None
    availability: str | None = None
    volunteering_history: str | None = None
    references: str | None = None
    events: list[EventItem]


class VolunteerMe(Volunteer):
    """GET /api/volunteers/me only — same idea as DonorMe, distinct from
    the public Volunteer/VolunteerSummary models. See
    specs/features/015-local-dev-generated-credentials/design.md."""

    local_username: str | None = None


class VolunteerSummary(CamelModel):
    """Donor-facing directory entry for the donation-event assignment
    picker — same public fields as Volunteer minus `events` (irrelevant
    here, and avoids an RSVP join per volunteer just to populate a
    picker). See specs/features/009-scheduled-donation-events/design.md."""

    id: str
    name: str
    location: str
    country: str = ""
    packets_per_trip: int | None = None
    availability: str | None = None


class DonorAdminView(BaseModel):
    """Admin-only directory row — see
    specs/features/016-admin-membership-status/design.md. Plain BaseModel
    (snake_case wire format), same convention as SignupAdminView /
    SubmissionAdminView; deliberately distinct from the public Donor
    CamelModel, which must never carry `email` or `status`."""

    donor_id: str
    name: str
    location: str
    country: str = ""
    email: str
    total_meals: int
    donation_count: int
    status: MembershipStatus


class VolunteerAdminView(BaseModel):
    """Admin-only directory row — same idea as DonorAdminView, against
    Volunteers."""

    volunteer_id: str
    name: str
    location: str
    country: str = ""
    email: str
    packets_per_trip: int | None = None
    availability: str | None = None
    status: MembershipStatus


DonationEventStatus = Literal["scheduled", "submitted", "completed", "cancelled"]


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
    # Optional signup-style detail, entered at scheduling time — see
    # specs/features/019-dashboard-profile-tab-and-proof-relocation/design.md.
    # Deliberately excludes location/country/story, which live on the
    # donor's Profile tab instead (specs/features/018-profile-edit).
    packet_count: int | None = None
    delivery_role: Literal["self", "volunteer_needed"] | None = None
    partner_charity: str | None = None
    notes: str | None = None
    # Set once the linked submission is approved (status flips to
    # "completed") — the approved delivery photos/caption, public-safe (no
    # receipt — see DonationMe for the donor-only equivalent). See
    # specs/features/021-completed-event-details/design.md and
    # specs/features/025-multi-photo-proof-with-cover/design.md.
    photo_urls: list[str] | None = None
    cover_photo_url: str | None = None
    caption: str | None = None
    # `location` is now expected to be an exact address; these are
    # geocoded from it server-side (best-effort, never required — see
    # specs/features/023-event-location-time-and-sharing/design.md).
    latitude: float | None = None
    longitude: float | None = None
    start_time: str | None = None  # "HH:MM", 24h
    end_time: str | None = None  # "HH:MM", 24h


class CreateDonationEventRequest(BaseModel):
    location: str
    date: str
    start_time: str
    end_time: str
    volunteer_id: str | None = None
    packet_count: int | None = None
    delivery_role: Literal["self", "volunteer_needed"] | None = None
    partner_charity: str | None = None
    notes: str | None = None


class CreatePartnerCharityRequest(BaseModel):
    name: str
    location: str
    description: str
    core_services: str | None = None
    founder_details: str | None = None
    years_active: str | None = None
    awards_credentials: str | None = None
    website_url: str | None = None
    donation_url: str | None = None
    tax_refund_eligible: bool | None = None
    email: str | None = None


class UpdatePartnerCharityRequest(BaseModel):
    name: str
    location: str
    description: str
    core_services: str | None = None
    founder_details: str | None = None
    years_active: str | None = None
    awards_credentials: str | None = None
    website_url: str | None = None
    donation_url: str | None = None
    tax_refund_eligible: bool | None = None
    email: str | None = None


class UpdateDonationEventRequest(BaseModel):
    location: str
    date: str
    start_time: str
    end_time: str
    packet_count: int | None = None
    delivery_role: Literal["self", "volunteer_needed"] | None = None
    partner_charity: str | None = None
    notes: str | None = None


class AssignVolunteerRequest(BaseModel):
    volunteer_id: str | None = None


class SiteConfig(CamelModel):
    charity_name: str
    founder_name: str
    total_meals: int
    milestone_2027: int
    goal_2030: int
    accent_palette: tuple[str, str]


class ContentResponse(CamelModel):
    config: SiteConfig
    donors: list[Donor]
    events: list[EventItem]
    partner_charities: list[PartnerCharity]
    # Public read-only feed for the homepage Scheduled/Completed toggle —
    # see specs/features/014-homepage-scheduled-events/design.md. Every
    # DonationEvent, any donor, any status (not scoped to "mine").
    donation_events: list[DonationEvent]


class AuthUser(CamelModel):
    name: str
    email: str
    provider: Literal["google", "dummy"]
    is_admin: bool = False
    is_donor: bool = False
    is_volunteer: bool = False


class GoogleAuthRequest(BaseModel):
    id_token: str


class DummyLoginRequest(BaseModel):
    """Local-dev-only login — see specs/00-constitution.md §4 and
    specs/features/015-local-dev-generated-credentials/design.md. Only
    ever accepted when ENABLE_DUMMY_LOGIN=true, which Terraform never
    sets. `username == "dummy_user"` is reserved for the fixed admin
    shortcut; any other username is looked up as a generated Donor/
    Volunteer local_username (see `Store.resolve_local_login`)."""

    username: str
    password: str


class SignupRequest(BaseModel):
    """Join In form submission. `mode == 'donor'` is an invitation-only
    application (not an instant sign-up) — see
    specs/features/002-join-in-signup/design.md. `commit_50k_4yr` and
    `agree_publish_story` must both be true (not just present) in donor
    mode, same as the two required checkboxes in the design. Every field
    not explicitly optional in the Join In form is required — see
    specs/features/012-required-field-validation/design.md."""

    mode: Literal["donor", "volunteer"]
    name: str | None = None
    location: str
    country: str
    notes: str | None = None
    # mode == "donor"
    email: str | None = None
    packet_count: int | None = None
    delivery_role: Literal["self", "volunteer_needed"] | None = None
    partner_charity: str | None = None
    donor_story: str | None = None
    commit_50k_4yr: bool = False
    agree_publish_story: bool = False
    # mode == "volunteer"
    packets_per_trip: int | None = None
    availability: str | None = None
    volunteering_history: str | None = None
    references: str | None = None

    @model_validator(mode="after")
    def _validate_required_fields(self) -> Self:
        if self.mode == "donor":
            if self.packet_count is None:
                raise ValueError("packet_count is required when mode is 'donor'")
            if not self.delivery_role and not self.partner_charity:
                raise ValueError(
                    "either delivery_role or partner_charity is required when "
                    "mode is 'donor' — self-deliver, need a volunteer, or give "
                    "through a partner charity are the three ways to deliver"
                )
            if not self.donor_story or not self.donor_story.strip():
                raise ValueError("donor_story is required when mode is 'donor'")
            if not self.commit_50k_4yr:
                raise ValueError(
                    "commit_50k_4yr must be true when mode is 'donor'"
                )
            if not self.agree_publish_story:
                raise ValueError(
                    "agree_publish_story must be true when mode is 'donor'"
                )
        else:
            if self.packets_per_trip is None:
                raise ValueError(
                    "packets_per_trip is required when mode is 'volunteer'"
                )
            if not self.availability or not self.availability.strip():
                raise ValueError(
                    "availability is required when mode is 'volunteer'"
                )
        return self


class SignupResponse(BaseModel):
    signup_id: str


SignupStatus = Literal["requested_signoff", "approved", "rejected"]


class SignupAdminView(BaseModel):
    signup_id: str
    mode: Literal["donor", "volunteer"]
    name: str | None = None
    email: str | None = None
    location: str
    country: str = ""
    notes: str | None = None
    packet_count: int | None = None
    delivery_role: Literal["self", "volunteer_needed"] | None = None
    partner_charity: str | None = None
    donor_story: str | None = None
    packets_per_trip: int | None = None
    availability: str | None = None
    volunteering_history: str | None = None
    references: str | None = None
    status: SignupStatus
    created_at: str


class PresignRequest(BaseModel):
    content_type: str
    size: int


class PresignResponse(BaseModel):
    upload_url: str
    key: str


class SubmissionRequest(BaseModel):
    location: str
    meals: int
    # 1-5 photos, submitter-ordered. `cover_photo_key` must be one of
    # them if given, else defaults to the first. See
    # specs/features/025-multi-photo-proof-with-cover/design.md.
    photo_keys: list[str]
    cover_photo_key: str | None = None
    receipt_key: str | None = None
    caption: str | None = None
    delivery_role: Literal["self", "volunteer_needed"] | None = None
    partner_charity: str | None = None
    # Set only by a linked volunteer submitting on a donor's behalf — see
    # specs/features/008-persona-dashboards-and-roles/design.md. When
    # present, the submitter must resolve to a linked volunteer (not
    # donor), and the resulting donation is attributed to this donor_id
    # directly instead of the submitter's own linked donor.
    donor_id: str | None = None
    # Set when submitting against a pre-scheduled DonationEvent — takes
    # precedence over donor_id if both are somehow present. See
    # specs/features/009-scheduled-donation-events/design.md.
    donation_event_id: str | None = None

    @model_validator(mode="after")
    def _validate_photos(self) -> Self:
        if not (1 <= len(self.photo_keys) <= 5):
            raise ValueError("Between 1 and 5 photos are required")
        if self.cover_photo_key and self.cover_photo_key not in self.photo_keys:
            raise ValueError("cover_photo_key must be one of photo_keys")
        return self


class SubmissionResponse(BaseModel):
    submission_id: str


class SubmissionAdminView(BaseModel):
    submission_id: str
    user_id: str
    donor_id: str
    location: str
    meals: int
    photo_urls: list[str]
    cover_photo_url: str
    receipt_url: str | None = None
    caption: str | None = None
    donation_event_id: str | None = None
    status: Literal["pending", "approved", "rejected"]
    created_at: str


class UpdateDonorProfileRequest(BaseModel):
    """PATCH /api/donors/me — see
    specs/features/018-profile-edit/design.md. Every field is required
    (not a partial patch) since the frontend always submits the full
    prefilled form."""

    location: str
    country: str
    story: str


class UpdateVolunteerProfileRequest(BaseModel):
    """PATCH /api/volunteers/me — see
    specs/features/024-volunteer-profile-full-fields/design.md.
    `packets_per_trip`/`availability` are required (mirrors their being
    required at signup); `volunteering_history`/`references` stay optional,
    same as at signup."""

    location: str
    country: str
    packets_per_trip: int
    availability: str
    volunteering_history: str | None = None
    references: str | None = None


class ConfigUpdateRequest(BaseModel):
    charity_name: str | None = None
    founder_name: str | None = None
    total_meals: int | None = None
    milestone_2027: int | None = None
    goal_2030: int | None = None
    accent_palette: tuple[str, str] | None = None
