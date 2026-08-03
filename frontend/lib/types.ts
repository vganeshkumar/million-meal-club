export type Donation = {
  id: string;
  date: string;
  location: string;
  meals: number;
  caption: string;
  photoUrl?: string;
};

export type Donor = {
  id: string;
  name: string;
  location: string;
  country: string;
  story: string;
  totalMeals: number;
  donationCount: number;
  donations?: Donation[];
};

export type EventItem = {
  id: string;
  date: string;
  time: string;
  location: string;
  packetsGoal: number;
  description: string;
};

export type GalleryPhoto = {
  id: string;
  photoUrl: string;
  caption?: string;
};

export type PartnerCharity = {
  id: string;
  name: string;
  location: string;
  description: string;
};

export type SiteConfig = {
  charityName: string;
  founderName: string;
  totalMeals: number;
  milestone2027: number;
  goal2030: number;
  accentPalette: [string, string];
};

export type ContentResponse = {
  config: SiteConfig;
  donors: Donor[];
  events: EventItem[];
  partnerCharities: PartnerCharity[];
  gallery: GalleryPhoto[];
};

export type AuthUser = {
  name: string;
  email: string;
  provider: "google" | "facebook" | "dummy";
  isAdmin: boolean;
  isDonor: boolean;
  isVolunteer: boolean;
};

export type Volunteer = {
  id: string;
  name: string;
  location: string;
  country: string;
  packetsPerTrip?: number;
  availability?: string;
  events: EventItem[];
};

export type VolunteerSummary = {
  id: string;
  name: string;
  location: string;
  country: string;
  packetsPerTrip?: number;
  availability?: string;
};

export type DonationEventStatus = "scheduled" | "submitted";

export type DonationEvent = {
  id: string;
  donorId: string;
  donorName: string;
  location: string;
  date: string;
  volunteerId?: string;
  volunteerName?: string;
  status: DonationEventStatus;
  submissionId?: string;
};

export type JoinMode = "donor" | "volunteer";

export type SignupPayload = {
  mode: JoinMode;
  name?: string;
  location: string;
  country: string;
  notes?: string;
  // mode === "donor" (invitation-only application)
  email?: string;
  packet_count?: number;
  delivery_role?: "self" | "volunteer_needed";
  partner_charity?: string;
  donor_story?: string;
  commit_50k_4yr?: boolean;
  agree_publish_story?: boolean;
  // mode === "volunteer"
  packets_per_trip?: number;
  availability?: string;
};

export type SubmissionPayload = {
  location: string;
  meals: number;
  photo_key: string;
  receipt_key?: string;
  caption?: string;
  delivery_role?: "self" | "volunteer_needed";
  partner_charity?: string;
  // Set only when a linked volunteer is submitting on a donor's behalf —
  // see specs/features/008-persona-dashboards-and-roles/design.md.
  donor_id?: string;
  // Set when submitting against a pre-scheduled DonationEvent — takes
  // precedence over donor_id if both are present. See
  // specs/features/009-scheduled-donation-events/design.md.
  donation_event_id?: string;
};

// Snake_case on the wire (unlike ContentResponse etc.) — SignupAdminView is
// a plain pydantic BaseModel on the backend, not the CamelModel used for
// public-facing responses. See backend/app/models/domain.py.
export type SignupAdminView = {
  signup_id: string;
  mode: JoinMode;
  name?: string;
  email?: string;
  location: string;
  country?: string;
  notes?: string;
  packet_count?: number;
  delivery_role?: "self" | "volunteer_needed";
  partner_charity?: string;
  donor_story?: string;
  status: "requested_signoff" | "approved" | "rejected";
  created_at: string;
};

// Also snake_case on the wire — SubmissionAdminView is a plain pydantic
// BaseModel, same as SignupAdminView.
export type SubmissionAdminView = {
  submission_id: string;
  user_id: string;
  donor_id: string;
  location: string;
  meals: number;
  photo_url: string;
  receipt_url?: string;
  caption?: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};
