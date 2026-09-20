"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { oauthConfigured } from "@/lib/auth";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import type { AuthUser, SignupAdminView, SubmissionAdminView } from "@/lib/types";
import { AdminDonors, AdminEvents, AdminVolunteers } from "@/components/AdminDirectory";
import { AdminPartnerCharities } from "@/components/AdminPartnerCharities";

type AdminSignoffProps = {
  user: AuthUser | null;
  onUserChange: (user: AuthUser) => void;
};

export function AdminSignoff({ user, onUserChange }: AdminSignoffProps) {
  if (!user) {
    return <SignInGate onUserChange={onUserChange} />;
  }
  if (!user.isAdmin) {
    return (
      <div className="mx-auto max-w-[640px] px-[clamp(20px,5vw,56px)] py-[clamp(40px,6vw,72px)] text-center text-muted">
        You don&apos;t have admin access.
      </div>
    );
  }
  return <AdminTabs />;
}

function SignInGate({
  onUserChange,
}: {
  onUserChange: (user: AuthUser) => void;
}) {
  const [error, setError] = useState("");

  return (
    <div className="mx-auto max-w-[420px] px-[clamp(20px,5vw,56px)] py-[clamp(40px,6vw,72px)]">
      <h1 className="mt-0 mb-4 font-display text-2xl font-extrabold">
        Admin Sign In
      </h1>
      <p className="m-0 mb-4 text-sm text-muted-2">
        Use the Sign In button in the header — pick &quot;Admin&quot; there
        if you&apos;re testing locally.
      </p>
      {error && <p className="m-0 mb-3 text-sm text-red-700">{error}</p>}
      {oauthConfigured.google && (
        <div className="flex flex-col gap-2.5">
          <GoogleSignInButton onSignedIn={onUserChange} onError={setError} />
        </div>
      )}
      {!oauthConfigured.google && (
        <p className="mt-4 mb-0 text-xs text-muted-3 italic">
          OAuth isn&apos;t fully configured in this environment — see
          specs/features/001-oauth-login/requirements.md.
        </p>
      )}
    </div>
  );
}

const ADMIN_TABS = [
  { id: "applications", label: "Applications" },
  { id: "submissions", label: "Submissions" },
  { id: "donors", label: "Donors" },
  { id: "volunteers", label: "Volunteers" },
  { id: "events", label: "Events" },
  { id: "charities", label: "Charity Partners" },
] as const;

type AdminTab = (typeof ADMIN_TABS)[number]["id"];

function AdminTabs() {
  const [tab, setTab] = useState<AdminTab>("applications");

  return (
    <div className="mx-auto max-w-[900px] px-[clamp(20px,5vw,56px)] py-[clamp(40px,6vw,72px)]">
      <div className="mb-6 flex flex-wrap gap-2">
        {ADMIN_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`cursor-pointer rounded-full border px-5 py-2.5 text-sm font-bold ${
              tab === id
                ? "border-[var(--accent-green)] bg-[var(--accent-green)] text-ink-fg"
                : "border-border-strong bg-transparent text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "applications" && <PendingApplications />}
      {tab === "submissions" && <PendingSubmissions />}
      {tab === "donors" && <AdminDonors />}
      {tab === "volunteers" && <AdminVolunteers />}
      {tab === "events" && <AdminEvents />}
      {tab === "charities" && <AdminPartnerCharities />}
    </div>
  );
}

function PendingApplications() {
  const [applications, setApplications] = useState<SignupAdminView[] | null>(
    null,
  );
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "donor" | "volunteer">("all");

  function refresh() {
    api
      .listPendingSignups()
      .then(setApplications)
      .catch(() => setError("Couldn't load pending applications."));
  }

  useEffect(refresh, []);

  async function handleApprove(id: string) {
    await api.approveSignup(id);
    setApplications((prev) => prev?.filter((a) => a.signup_id !== id) ?? null);
  }

  async function handleReject(id: string) {
    await api.rejectSignup(id);
    setApplications((prev) => prev?.filter((a) => a.signup_id !== id) ?? null);
  }

  const visible = applications?.filter(
    (a) => filter === "all" || a.mode === filter,
  );

  return (
    <div>
      <h1 className="mt-0 mb-4 font-display text-2xl font-extrabold">
        Pending Applications
      </h1>
      <div className="mb-6 flex gap-2">
        {(["all", "donor", "volunteer"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-bold capitalize ${
              filter === f
                ? "border-[var(--accent-green)] bg-[var(--accent-green)] text-ink-fg"
                : "border-border-strong bg-transparent text-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {applications === null && !error && (
        <p className="text-sm text-muted">Loading…</p>
      )}
      {visible?.length === 0 && (
        <p className="text-sm text-muted">Nothing pending review.</p>
      )}
      <div className="flex flex-col gap-4">
        {visible?.map((a) => (
          <div
            key={a.signup_id}
            data-testid="signup-card"
            className="rounded-[20px] border border-border bg-card p-6"
          >
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="m-0 text-base font-bold">{a.name}</p>
                  <span className="rounded-full border border-border-strong px-2 py-0.5 text-[11px] font-bold uppercase text-muted-2">
                    {a.mode === "donor" ? "Donor" : "Volunteer"}
                  </span>
                </div>
                <p className="m-0 text-sm text-muted-2">{a.email}</p>
              </div>
              <p className="m-0 text-xs text-muted-3">{a.created_at}</p>
            </div>
            <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 text-sm">
              <div>
                <dt className="font-bold text-muted-2">Location</dt>
                <dd className="m-0">{a.location}</dd>
              </div>
              {a.country && (
                <div>
                  <dt className="font-bold text-muted-2">Country</dt>
                  <dd className="m-0">{a.country}</dd>
                </div>
              )}
              {a.mode === "donor" ? (
                <>
                  {a.packet_count != null && (
                    <div>
                      <dt className="font-bold text-muted-2">Packets</dt>
                      <dd className="m-0">{a.packet_count}</dd>
                    </div>
                  )}
                  {a.delivery_role && (
                    <div>
                      <dt className="font-bold text-muted-2">
                        Delivery role
                      </dt>
                      <dd className="m-0">
                        {a.delivery_role === "self"
                          ? "Self-delivers"
                          : "Needs a volunteer"}
                      </dd>
                    </div>
                  )}
                  {a.partner_charity && (
                    <div>
                      <dt className="font-bold text-muted-2">
                        Partner charity
                      </dt>
                      <dd className="m-0">{a.partner_charity}</dd>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {a.packets_per_trip != null && (
                    <div>
                      <dt className="font-bold text-muted-2">
                        Packets per trip
                      </dt>
                      <dd className="m-0">{a.packets_per_trip}</dd>
                    </div>
                  )}
                  {a.availability && (
                    <div>
                      <dt className="font-bold text-muted-2">
                        Availability
                      </dt>
                      <dd className="m-0">{a.availability}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
            {a.donor_story && (
              <p className="mt-3 mb-0 text-sm leading-[1.6] text-muted">
                {a.donor_story}
              </p>
            )}
            {a.volunteering_history && (
              <div className="mt-3">
                <p className="m-0 text-xs font-bold text-muted-2">
                  Prior volunteering experience
                </p>
                <p className="m-0 text-sm leading-[1.6] text-muted">
                  {a.volunteering_history}
                </p>
              </div>
            )}
            {a.references && (
              <div className="mt-3">
                <p className="m-0 text-xs font-bold text-muted-2">
                  Donor references
                </p>
                <p className="m-0 text-sm leading-[1.6] text-muted">
                  {a.references}
                </p>
              </div>
            )}
            {a.notes && (
              <p className="mt-2 mb-0 text-sm text-muted-2 italic">
                {a.notes}
              </p>
            )}
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => handleApprove(a.signup_id)}
                className="cursor-pointer rounded-full border-none bg-[var(--accent-green)] px-5 py-2.5 text-sm font-bold text-ink-fg"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleReject(a.signup_id)}
                className="cursor-pointer rounded-full border border-border-strong bg-transparent px-5 py-2.5 text-sm font-bold text-ink"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingSubmissions() {
  const [submissions, setSubmissions] = useState<
    SubmissionAdminView[] | null
  >(null);
  const [error, setError] = useState("");
  const [facebookErrors, setFacebookErrors] = useState<
    Record<string, string>
  >({});
  const [postingIds, setPostingIds] = useState<Set<string>>(new Set());

  function refresh() {
    api
      .listPendingSubmissions()
      .then(setSubmissions)
      .catch(() => setError("Couldn't load pending submissions."));
  }

  useEffect(refresh, []);

  async function handleApprove(id: string) {
    await api.approveSubmission(id);
    setSubmissions(
      (prev) =>
        prev?.map((s) =>
          s.submission_id === id ? { ...s, status: "approved" } : s,
        ) ?? null,
    );
  }

  async function handleReject(id: string) {
    await api.rejectSubmission(id);
    setSubmissions(
      (prev) => prev?.filter((s) => s.submission_id !== id) ?? null,
    );
  }

  function handleDismiss(id: string) {
    setSubmissions(
      (prev) => prev?.filter((s) => s.submission_id !== id) ?? null,
    );
  }

  async function handlePostToFacebook(id: string) {
    setFacebookErrors((prev) => ({ ...prev, [id]: "" }));
    setPostingIds((prev) => new Set(prev).add(id));
    try {
      const { facebook_post_id } = await api.postSubmissionToFacebook(id);
      setSubmissions(
        (prev) =>
          prev?.map((s) =>
            s.submission_id === id ? { ...s, facebook_post_id } : s,
          ) ?? null,
      );
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 400
          ? "Facebook posting isn't configured yet."
          : err instanceof ApiError && err.status === 409
            ? "This submission was already posted to Facebook."
            : "Couldn't post to Facebook. Please try again.";
      setFacebookErrors((prev) => ({ ...prev, [id]: message }));
    } finally {
      setPostingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div>
      <h1 className="mt-0 mb-6 font-display text-2xl font-extrabold">
        Pending Submissions
      </h1>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {submissions === null && !error && (
        <p className="text-sm text-muted">Loading…</p>
      )}
      {submissions?.length === 0 && (
        <p className="text-sm text-muted">Nothing pending review.</p>
      )}
      <div className="flex flex-col gap-4">
        {submissions?.map((s) => (
          <div
            key={s.submission_id}
            className="rounded-[20px] border border-border bg-card p-6"
          >
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="m-0 text-sm font-bold">{s.location}</p>
              <p className="m-0 text-xs text-muted-3">{s.created_at}</p>
            </div>
            <p className="m-0 mb-3 text-sm text-muted-2">
              {s.meals} meals delivered
            </p>
            <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
              {s.photo_urls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="relative block aspect-[4/3] overflow-hidden rounded-xl border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Delivery proof"
                    className="h-full w-full object-cover"
                  />
                  {url === s.cover_photo_url && (
                    <span className="absolute bottom-0 left-0 w-full bg-[var(--accent-green)] py-0.5 text-center text-[10px] font-bold text-ink-fg">
                      Cover
                    </span>
                  )}
                </a>
              ))}
              {s.receipt_url && (
                <a
                  href={s.receipt_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex aspect-[4/3] items-center justify-center rounded-xl border border-border text-sm font-bold text-muted-2"
                >
                  View Receipt
                </a>
              )}
            </div>
            {s.caption && (
              <p className="m-0 mb-3 text-sm leading-[1.6] text-muted italic">
                {s.caption}
              </p>
            )}
            {facebookErrors[s.submission_id] && (
              <p className="m-0 mb-3 text-sm text-red-700">
                {facebookErrors[s.submission_id]}
              </p>
            )}
            {s.status === "pending" ? (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => handleApprove(s.submission_id)}
                  className="cursor-pointer rounded-full border-none bg-[var(--accent-green)] px-5 py-2.5 text-sm font-bold text-ink-fg"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(s.submission_id)}
                  className="cursor-pointer rounded-full border border-border-strong bg-transparent px-5 py-2.5 text-sm font-bold text-ink"
                >
                  Reject
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                {s.facebook_post_id ? (
                  <>
                    <span className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-bold text-muted-2">
                      Posted to Facebook ✓
                    </span>
                    <a
                      href={`https://www.facebook.com/${s.facebook_post_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-bold text-ink underline"
                    >
                      View post
                    </a>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={postingIds.has(s.submission_id)}
                    onClick={() => handlePostToFacebook(s.submission_id)}
                    className="cursor-pointer rounded-full border-none bg-[var(--accent-green)] px-5 py-2.5 text-sm font-bold text-ink-fg disabled:cursor-default disabled:opacity-60"
                  >
                    {postingIds.has(s.submission_id)
                      ? "Posting…"
                      : "Post to Facebook"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDismiss(s.submission_id)}
                  className="cursor-pointer rounded-full border border-border-strong bg-transparent px-5 py-2.5 text-sm font-bold text-ink"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
