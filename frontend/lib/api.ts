import type {
  AuthUser,
  ContentResponse,
  DonationEvent,
  Donor,
  DonorAdminView,
  PartnerCharity,
  SignupAdminView,
  SignupPayload,
  SubmissionAdminView,
  SubmissionPayload,
  Volunteer,
  VolunteerAdminView,
  VolunteerSummary,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export { ApiError };

export const api = {
  getContent: () => request<ContentResponse>("/content"),
  getDonor: (id: string) => request<Donor>(`/donors/${id}`),

  me: () => request<AuthUser>("/auth/me"),
  signInWithGoogle: (idToken: string) =>
    request<AuthUser>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ id_token: idToken }),
    }),
  signInDummy: (username: string, password: string) =>
    request<AuthUser>("/auth/dummy", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),

  submitSignup: (payload: SignupPayload) =>
    request<{ signup_id: string }>("/signups", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listPendingSignups: () =>
    request<SignupAdminView[]>("/admin/signups?status=requested_signoff"),
  approveSignup: (id: string) =>
    request<void>(`/admin/signups/${id}/approve`, { method: "POST" }),
  rejectSignup: (id: string) =>
    request<void>(`/admin/signups/${id}/reject`, { method: "POST" }),

  listPendingSubmissions: () =>
    request<SubmissionAdminView[]>("/admin/submissions?status=pending"),
  approveSubmission: (id: string) =>
    request<void>(`/admin/submissions/${id}/approve`, { method: "POST" }),
  rejectSubmission: (id: string) =>
    request<void>(`/admin/submissions/${id}/reject`, { method: "POST" }),

  presignUpload: (payload: { content_type: string; size: number }) =>
    request<{ upload_url: string; key: string }>("/uploads/presign", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  submitProof: (payload: SubmissionPayload) =>
    request<{ submission_id: string }>("/submissions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getMyDonor: () => request<Donor>("/donors/me"),
  updateMyDonor: (payload: { location: string; country: string; story: string }) =>
    request<Donor>("/donors/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getMyVolunteer: () => request<Volunteer>("/volunteers/me"),
  updateMyVolunteer: (payload: {
    location: string;
    country: string;
    packets_per_trip: number;
    availability: string;
    volunteering_history?: string;
    references?: string;
  }) =>
    request<Volunteer>("/volunteers/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  rsvpToEvent: (eventId: string) =>
    request<void>(`/events/${eventId}/rsvp`, { method: "POST" }),
  cancelRsvp: (eventId: string) =>
    request<void>(`/events/${eventId}/rsvp`, { method: "DELETE" }),

  listVolunteers: () => request<VolunteerSummary[]>("/volunteers"),
  listMyDonationEvents: () => request<DonationEvent[]>("/donation-events/mine"),
  createDonationEvent: (payload: {
    location: string;
    date: string;
    start_time: string;
    end_time: string;
    volunteer_id?: string;
    packet_count?: number;
    delivery_role?: "self" | "volunteer_needed";
    partner_charity?: string;
    notes?: string;
  }) =>
    request<DonationEvent>("/donation-events", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateDonationEvent: (
    eventId: string,
    payload: {
      location: string;
      date: string;
      start_time: string;
      end_time: string;
      packet_count?: number;
      delivery_role?: "self" | "volunteer_needed";
      partner_charity?: string;
      notes?: string;
    },
  ) =>
    request<DonationEvent>(`/donation-events/${eventId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  assignDonationEventVolunteer: (eventId: string, volunteerId: string | null) =>
    request<DonationEvent>(`/donation-events/${eventId}/volunteer`, {
      method: "PATCH",
      body: JSON.stringify({ volunteer_id: volunteerId }),
    }),
  cancelDonationEvent: (eventId: string) =>
    request<DonationEvent>(`/donation-events/${eventId}/cancel`, {
      method: "POST",
    }),
  listVolunteerAssignedEvents: () =>
    request<DonationEvent[]>("/donation-events/volunteer-assigned"),

  listAllDonors: () => request<DonorAdminView[]>("/admin/donors"),
  disableDonor: (id: string) =>
    request<void>(`/admin/donors/${id}/disable`, { method: "POST" }),
  reactivateDonor: (id: string) =>
    request<void>(`/admin/donors/${id}/reactivate`, { method: "POST" }),

  listAllVolunteers: () => request<VolunteerAdminView[]>("/admin/volunteers"),
  disableVolunteer: (id: string) =>
    request<void>(`/admin/volunteers/${id}/disable`, { method: "POST" }),
  reactivateVolunteer: (id: string) =>
    request<void>(`/admin/volunteers/${id}/reactivate`, { method: "POST" }),

  listUpcomingDonationEvents: () =>
    request<DonationEvent[]>("/admin/donation-events?status=scheduled"),

  listAllPartnerCharities: () =>
    request<PartnerCharity[]>("/admin/charities"),
  createPartnerCharity: (payload: {
    name: string;
    location: string;
    description: string;
    core_services?: string;
    founder_details?: string;
    years_active?: string;
    awards_credentials?: string;
    website_url?: string;
    donation_url?: string;
  }) =>
    request<PartnerCharity>("/admin/charities", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePartnerCharity: (
    id: string,
    payload: {
      name: string;
      location: string;
      description: string;
      core_services?: string;
      founder_details?: string;
      years_active?: string;
      awards_credentials?: string;
      website_url?: string;
      donation_url?: string;
    },
  ) =>
    request<PartnerCharity>(`/admin/charities/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  disablePartnerCharity: (id: string) =>
    request<void>(`/admin/charities/${id}/disable`, { method: "POST" }),
  reactivatePartnerCharity: (id: string) =>
    request<void>(`/admin/charities/${id}/reactivate`, { method: "POST" }),
};

export async function uploadToPresignedUrl(
  uploadUrl: string,
  file: File,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status}`);
  }
}

// Presigns + uploads each photo in order, returning the resulting keys.
// See specs/features/025-multi-photo-proof-with-cover/design.md.
export async function uploadPhotos(files: File[]): Promise<string[]> {
  const keys: string[] = [];
  for (const file of files) {
    const presign = await api.presignUpload({
      content_type: file.type,
      size: file.size,
    });
    await uploadToPresignedUrl(presign.upload_url, file);
    keys.push(presign.key);
  }
  return keys;
}
