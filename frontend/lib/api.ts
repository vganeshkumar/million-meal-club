import type {
  AuthUser,
  ContentResponse,
  DonationEvent,
  Donor,
  SignupAdminView,
  SignupPayload,
  SubmissionAdminView,
  SubmissionPayload,
  Volunteer,
  VolunteerSummary,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

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
  signInWithFacebook: (accessToken: string) =>
    request<AuthUser>("/auth/facebook", {
      method: "POST",
      body: JSON.stringify({ access_token: accessToken }),
    }),
  signInDummy: (
    username: string,
    password: string,
    role: "admin" | "donor" | "volunteer",
  ) =>
    request<AuthUser>("/auth/dummy", {
      method: "POST",
      body: JSON.stringify({ username, password, role }),
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
  getMyVolunteer: () => request<Volunteer>("/volunteers/me"),
  rsvpToEvent: (eventId: string) =>
    request<void>(`/events/${eventId}/rsvp`, { method: "POST" }),
  cancelRsvp: (eventId: string) =>
    request<void>(`/events/${eventId}/rsvp`, { method: "DELETE" }),

  listVolunteers: () => request<VolunteerSummary[]>("/volunteers"),
  listMyDonationEvents: () => request<DonationEvent[]>("/donation-events/mine"),
  createDonationEvent: (payload: {
    location: string;
    date: string;
    volunteer_id?: string;
  }) =>
    request<DonationEvent>("/donation-events", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  assignDonationEventVolunteer: (eventId: string, volunteerId: string | null) =>
    request<DonationEvent>(`/donation-events/${eventId}/volunteer`, {
      method: "PATCH",
      body: JSON.stringify({ volunteer_id: volunteerId }),
    }),
  listVolunteerAssignedEvents: () =>
    request<DonationEvent[]>("/donation-events/volunteer-assigned"),
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
