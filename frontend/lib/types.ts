export type Donation = {
  id: string;
  date: string;
  location: string;
  meals: number;
  caption: string;
  // Up to 5 photos, submitter-ordered; coverPhotoUrl is the one chosen to
  // represent this delivery anywhere only a single fixed-size image is
  // shown. See specs/features/025-multi-photo-proof-with-cover/design.md.
  photoUrls?: string[];
  coverPhotoUrl?: string;
  // Only ever present on GET /api/donors/me — the public Donor model
  // (also used by GET /api/donors/{id}) never carries a receipt. See
  // specs/features/021-completed-event-details/design.md.
  receiptUrl?: string;
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
  // Only ever present on GET /api/donors/me — the public Donor model
  // (also used by GET /api/donors/{id}) never carries this. See
  // specs/features/015-local-dev-generated-credentials/design.md.
  localUsername?: string;
};

export type EventItem = {
  id: string;
  date: string;
  time: string;
  location: string;
  packetsGoal: number;
  description: string;
};

export type PartnerCharity = {
  id: string;
  name: string;
  location: string;
  description: string;
  coreServices?: string;
  founderDetails?: string;
  yearsActive?: string;
  awardsCredentials?: string;
  websiteUrl?: string;
  donationUrl?: string;
  taxRefundEligible?: boolean;
  status: MembershipStatus;
  createdAt?: string;
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
  donationEvents: DonationEvent[];
};

export type AuthUser = {
  name: string;
  email: string;
  provider: "google" | "dummy";
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
  volunteeringHistory?: string;
  references?: string;
  events: EventItem[];
  // Only ever present on GET /api/volunteers/me. See
  // specs/features/015-local-dev-generated-credentials/design.md.
  localUsername?: string;
};

export type VolunteerSummary = {
  id: string;
  name: string;
  location: string;
  country: string;
  packetsPerTrip?: number;
  availability?: string;
};

export type DonationEventStatus =
  | "scheduled"
  | "submitted"
  | "completed"
  | "cancelled";

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
  // Optional signup-style detail entered at scheduling time — see
  // specs/features/019-dashboard-profile-tab-and-proof-relocation.
  packetCount?: number;
  deliveryRole?: "self" | "volunteer_needed";
  partnerCharity?: string;
  notes?: string;
  // Set once status flips to "completed" — the approved delivery photos/
  // caption, public-safe (no receipt). See
  // specs/features/021-completed-event-details/design.md and
  // specs/features/025-multi-photo-proof-with-cover/design.md.
  photoUrls?: string[];
  coverPhotoUrl?: string;
  caption?: string;
  // `location` is an exact address going forward — these are geocoded
  // from it server-side, best-effort (may be absent). See
  // specs/features/023-event-location-time-and-sharing/design.md.
  latitude?: number;
  longitude?: number;
  startTime?: string; // "HH:MM", 24h
  endTime?: string; // "HH:MM", 24h
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
  volunteering_history?: string;
  references?: string;
};

export type SubmissionPayload = {
  location: string;
  meals: number;
  // 1-5 photos, submitter-ordered. cover_photo_key must be one of them
  // if given, else defaults to the first. See
  // specs/features/025-multi-photo-proof-with-cover/design.md.
  photo_keys: string[];
  cover_photo_key?: string;
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
  packets_per_trip?: number;
  availability?: string;
  volunteering_history?: string;
  references?: string;
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
  photo_urls: string[];
  cover_photo_url: string;
  receipt_url?: string;
  caption?: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type MembershipStatus = "active" | "disabled";

// Also snake_case on the wire — DonorAdminView/VolunteerAdminView are
// plain pydantic BaseModels, same convention as SignupAdminView/
// SubmissionAdminView above. See
// specs/features/016-admin-membership-status/design.md — deliberately
// distinct from the public Donor/Volunteer types, which never carry
// `email` or `status`.
export type DonorAdminView = {
  donor_id: string;
  name: string;
  location: string;
  country: string;
  email: string;
  total_meals: number;
  donation_count: number;
  status: MembershipStatus;
};

export type VolunteerAdminView = {
  volunteer_id: string;
  name: string;
  location: string;
  country: string;
  email: string;
  packets_per_trip?: number;
  availability?: string;
  status: MembershipStatus;
};
