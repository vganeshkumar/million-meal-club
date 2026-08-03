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
    photo_url: str | None = None


class Donor(CamelModel):
    id: str
    name: str
    location: str
    country: str = ""
    story: str
    total_meals: int
    donation_count: int
    donations: list[Donation] | None = None


class EventItem(CamelModel):
    id: str
    date: str
    time: str
    location: str
    packets_goal: int
    description: str


class GalleryPhoto(CamelModel):
    id: str
    photo_url: str
    caption: str | None = None


class PartnerCharity(CamelModel):
    id: str
    name: str
    location: str
    description: str


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
    events: list[EventItem]


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


DonationEventStatus = Literal["scheduled", "submitted"]


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


class CreateDonationEventRequest(BaseModel):
    location: str
    date: str
    volunteer_id: str | None = None


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
    gallery: list[GalleryPhoto]


class AuthUser(CamelModel):
    name: str
    email: str
    provider: Literal["google", "facebook", "dummy"]
    is_admin: bool = False
    is_donor: bool = False
    is_volunteer: bool = False


class GoogleAuthRequest(BaseModel):
    id_token: str


class FacebookAuthRequest(BaseModel):
    access_token: str


class DummyLoginRequest(BaseModel):
    """Local-dev-only login — see specs/00-constitution.md §4 and
    specs/features/008-persona-dashboards-and-roles/design.md. Only ever
    accepted when ENABLE_DUMMY_LOGIN=true, which Terraform never sets."""

    username: str
    password: str
    role: Literal["admin", "donor", "volunteer"]


class SignupRequest(BaseModel):
    """Join In form submission. `mode == 'donor'` is an invitation-only
    application (not an instant sign-up) — see
    specs/features/002-join-in-signup/design.md. `commit_50k_4yr` and
    `agree_publish_story` must both be true (not just present) in donor
    mode, same as the two required checkboxes in the design."""

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

    @model_validator(mode="after")
    def _validate_donor_fields(self) -> Self:
        if self.mode == "donor":
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
    photo_key: str
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


class SubmissionResponse(BaseModel):
    submission_id: str


class SubmissionAdminView(BaseModel):
    submission_id: str
    user_id: str
    donor_id: str
    location: str
    meals: int
    photo_url: str
    receipt_url: str | None = None
    caption: str | None = None
    donation_event_id: str | None = None
    status: Literal["pending", "approved", "rejected"]
    created_at: str


class ConfigUpdateRequest(BaseModel):
    charity_name: str | None = None
    founder_name: str | None = None
    total_meals: int | None = None
    milestone_2027: int | None = None
    goal_2030: int | None = None
    accent_palette: tuple[str, str] | None = None
