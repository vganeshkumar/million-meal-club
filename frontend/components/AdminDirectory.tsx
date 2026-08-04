"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  DonationEvent,
  DonorAdminView,
  MembershipStatus,
  VolunteerAdminView,
} from "@/lib/types";

function StatusBadge({ status }: { status: MembershipStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
        status === "active"
          ? "bg-green-soft text-[var(--accent-green)]"
          : "border border-border-strong text-muted-2"
      }`}
    >
      {status}
    </span>
  );
}

function ToggleButton({
  status,
  pending,
  onClick,
}: {
  status: MembershipStatus;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`cursor-pointer rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-60 ${
        status === "active"
          ? "border border-border-strong bg-transparent text-ink"
          : "border-none bg-[var(--accent-green)] text-ink-fg"
      }`}
    >
      {status === "active" ? "Disable" : "Reactivate"}
    </button>
  );
}

export function AdminDonors() {
  const [donors, setDonors] = useState<DonorAdminView[] | null>(null);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  function refresh() {
    api
      .listAllDonors()
      .then(setDonors)
      .catch(() => setError("Couldn't load donors."));
  }

  useEffect(refresh, []);

  async function toggle(donor: DonorAdminView) {
    setPendingId(donor.donor_id);
    try {
      if (donor.status === "active") {
        await api.disableDonor(donor.donor_id);
      } else {
        await api.reactivateDonor(donor.donor_id);
      }
      setDonors(
        (prev) =>
          prev?.map((d) =>
            d.donor_id === donor.donor_id
              ? { ...d, status: d.status === "active" ? "disabled" : "active" }
              : d,
          ) ?? null,
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <h1 className="mt-0 mb-6 font-display text-2xl font-extrabold">Donors</h1>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {donors === null && !error && <p className="text-sm text-muted">Loading…</p>}
      {donors?.length === 0 && <p className="text-sm text-muted">No donors yet.</p>}
      <div className="flex flex-col gap-4">
        {donors?.map((d) => (
          <div
            key={d.donor_id}
            data-testid="donor-card"
            className="rounded-[20px] border border-border bg-card p-6"
          >
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="m-0 text-base font-bold">{d.name}</p>
                <StatusBadge status={d.status} />
              </div>
              <p className="m-0 text-sm text-muted-2">{d.email}</p>
            </div>
            <dl className="m-0 mb-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 text-sm">
              <div>
                <dt className="font-bold text-muted-2">Location</dt>
                <dd className="m-0">{d.location}</dd>
              </div>
              <div>
                <dt className="font-bold text-muted-2">Meals delivered</dt>
                <dd className="m-0">{d.total_meals.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="font-bold text-muted-2">Donations</dt>
                <dd className="m-0">{d.donation_count}</dd>
              </div>
            </dl>
            <ToggleButton
              status={d.status}
              pending={pendingId === d.donor_id}
              onClick={() => toggle(d)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminVolunteers() {
  const [volunteers, setVolunteers] = useState<VolunteerAdminView[] | null>(
    null,
  );
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  function refresh() {
    api
      .listAllVolunteers()
      .then(setVolunteers)
      .catch(() => setError("Couldn't load volunteers."));
  }

  useEffect(refresh, []);

  async function toggle(volunteer: VolunteerAdminView) {
    setPendingId(volunteer.volunteer_id);
    try {
      if (volunteer.status === "active") {
        await api.disableVolunteer(volunteer.volunteer_id);
      } else {
        await api.reactivateVolunteer(volunteer.volunteer_id);
      }
      setVolunteers(
        (prev) =>
          prev?.map((v) =>
            v.volunteer_id === volunteer.volunteer_id
              ? { ...v, status: v.status === "active" ? "disabled" : "active" }
              : v,
          ) ?? null,
      );
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <h1 className="mt-0 mb-6 font-display text-2xl font-extrabold">
        Volunteers
      </h1>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {volunteers === null && !error && (
        <p className="text-sm text-muted">Loading…</p>
      )}
      {volunteers?.length === 0 && (
        <p className="text-sm text-muted">No volunteers yet.</p>
      )}
      <div className="flex flex-col gap-4">
        {volunteers?.map((v) => (
          <div
            key={v.volunteer_id}
            data-testid="volunteer-card"
            className="rounded-[20px] border border-border bg-card p-6"
          >
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="m-0 text-base font-bold">{v.name}</p>
                <StatusBadge status={v.status} />
              </div>
              <p className="m-0 text-sm text-muted-2">{v.email}</p>
            </div>
            <dl className="m-0 mb-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 text-sm">
              <div>
                <dt className="font-bold text-muted-2">Location</dt>
                <dd className="m-0">{v.location}</dd>
              </div>
              {v.packets_per_trip != null && (
                <div>
                  <dt className="font-bold text-muted-2">Packets per trip</dt>
                  <dd className="m-0">{v.packets_per_trip}</dd>
                </div>
              )}
              {v.availability && (
                <div>
                  <dt className="font-bold text-muted-2">Availability</dt>
                  <dd className="m-0">{v.availability}</dd>
                </div>
              )}
            </dl>
            <ToggleButton
              status={v.status}
              pending={pendingId === v.volunteer_id}
              onClick={() => toggle(v)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminEvents() {
  const [events, setEvents] = useState<DonationEvent[] | null>(null);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    api
      .listUpcomingDonationEvents()
      .then(setEvents)
      .catch(() => setError("Couldn't load upcoming events."));
  }, []);

  async function handleCancel(eventId: string) {
    setPendingId(eventId);
    try {
      await api.cancelDonationEvent(eventId);
      // Cancelled events don't come back to this "upcoming" list — same
      // as a re-fetch would show — so drop it locally rather than
      // flipping a status badge in place.
      setEvents((prev) => prev?.filter((e) => e.id !== eventId) ?? null);
    } catch {
      setError("Couldn't cancel that donation event. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <h1 className="mt-0 mb-6 font-display text-2xl font-extrabold">
        Upcoming Events
      </h1>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {events === null && !error && (
        <p className="text-sm text-muted">Loading…</p>
      )}
      {events?.length === 0 && (
        <p className="text-sm text-muted">No upcoming donation events.</p>
      )}
      <div className="flex flex-col gap-4">
        {events?.map((e) => (
          <div
            key={e.id}
            data-testid="admin-event-card"
            className="rounded-[20px] border border-border bg-card p-6"
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="m-0 text-sm font-bold">{e.date}</p>
              <p className="m-0 text-sm text-muted-2">{e.location}</p>
            </div>
            <p className="m-0 text-sm text-muted">
              Donor: <span className="font-bold">{e.donorName}</span>
            </p>
            <p className="m-0 mt-1 mb-4 text-[13px] font-bold tracking-[0.03em] text-muted-2 uppercase">
              {e.volunteerName
                ? `Volunteer: ${e.volunteerName}`
                : "Unassigned — self-delivered"}
            </p>
            <button
              type="button"
              onClick={() => handleCancel(e.id)}
              disabled={pendingId === e.id}
              className="cursor-pointer rounded-full border border-border-strong bg-transparent px-5 py-2.5 text-sm font-bold text-ink disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
