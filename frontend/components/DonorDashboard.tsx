"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { DonationEvent, Donor, VolunteerSummary } from "@/lib/types";

const fieldClass =
  "rounded-[10px] border border-border-strong bg-bg px-3.5 py-3 text-[15px] font-body";
const labelClass = "flex flex-col gap-1.5 text-[13px] font-bold";

export function DonorDashboard() {
  const [donor, setDonor] = useState<Donor | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getMyDonor()
      .then(setDonor)
      .catch((err) =>
        setError(
          err instanceof ApiError && err.status === 404
            ? "We couldn't find a donor profile linked to your account."
            : "Couldn't load your donations.",
        ),
      );
  }, []);

  return (
    <div className="mx-auto max-w-[760px] px-[clamp(20px,5vw,56px)] py-[clamp(40px,6vw,72px)]">
      <h1 className="mt-0 mb-1 font-display text-2xl font-extrabold">
        My Donations
      </h1>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {!donor && !error && <p className="text-sm text-muted">Loading…</p>}

      {donor && (
        <>
          <p className="m-0 mb-8 text-sm text-muted-2">
            {donor.name} · {donor.location}
            {donor.country ? `, ${donor.country}` : ""}
          </p>

          <div className="mb-8 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="m-0 text-3xl font-extrabold text-[var(--accent-green)]">
                {donor.totalMeals.toLocaleString()}
              </p>
              <p className="m-0 mt-1 text-sm text-muted-2">Meals delivered</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="m-0 text-3xl font-extrabold">
                {donor.donationCount}
              </p>
              <p className="m-0 mt-1 text-sm text-muted-2">Deliveries</p>
            </div>
          </div>

          <DonationEventsSection donorCountry={donor.country} />

          <h2 className="mt-0 mb-4 font-display text-lg font-bold">
            Delivery history
          </h2>
          {(donor.donations?.length ?? 0) === 0 && (
            <p className="text-sm text-muted">No deliveries recorded yet.</p>
          )}
          <div className="flex flex-col gap-3">
            {donor.donations?.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5"
              >
                <div>
                  <p className="m-0 text-sm font-bold">
                    {d.meals} meals — {d.location}
                  </p>
                  <p className="m-0 mt-1 text-xs text-muted-2">{d.date}</p>
                  {d.caption && (
                    <p className="m-0 mt-1 text-sm text-muted italic">
                      {d.caption}
                    </p>
                  )}
                </div>
                {d.photoUrl && (
                  <a
                    href={d.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={d.photoUrl}
                      alt="Delivery proof"
                      className="h-full w-full object-cover"
                    />
                  </a>
                )}
              </div>
            ))}
          </div>

          <p className="mt-8 mb-0 text-sm text-muted-2">
            Ready to log a new delivery? Head to the{" "}
            <a href="#gallery" className="font-bold text-ink">
              Proof of Delivery
            </a>{" "}
            section to submit it yourself, or ask a volunteer to submit on
            your behalf.
          </p>
        </>
      )}
    </div>
  );
}

function DonationEventsSection({ donorCountry }: { donorCountry: string }) {
  const [events, setEvents] = useState<DonationEvent[] | null>(null);
  const [volunteers, setVolunteers] = useState<VolunteerSummary[]>([]);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  function refresh() {
    api
      .listMyDonationEvents()
      .then(setEvents)
      .catch(() => setError("Couldn't load your scheduled donation events."));
  }

  useEffect(() => {
    refresh();
    api
      .listVolunteers()
      .then((list) =>
        // Same-country-as-donor volunteers first — a nudge toward the
        // likely-right match, not a hard filter. See
        // specs/features/010-country-field-for-matching/design.md.
        setVolunteers(
          [...list].sort((a, b) => {
            const aMatch = a.country === donorCountry ? 0 : 1;
            const bMatch = b.country === donorCountry ? 0 : 1;
            return aMatch - bMatch;
          }),
        ),
      )
      .catch(() => {});
  }, [donorCountry]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setCreating(true);
    setError("");
    try {
      await api.createDonationEvent({
        location: String(data.get("location") ?? ""),
        date: String(data.get("date") ?? ""),
        volunteer_id: (data.get("volunteer_id") as string) || undefined,
      });
      form.reset();
      refresh();
    } catch {
      setError("Couldn't schedule that donation. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleAssign(eventId: string, volunteerId: string) {
    try {
      await api.assignDonationEventVolunteer(eventId, volunteerId || null);
      refresh();
    } catch {
      setError("Couldn't update the assigned volunteer. Please try again.");
    }
  }

  return (
    <div className="mb-10">
      <h2 className="mt-0 mb-4 font-display text-lg font-bold">
        Scheduled Donation Events
      </h2>
      <p className="m-0 mb-4 text-sm text-muted-2">
        Plan a delivery ahead of time and optionally assign a volunteer to
        it — once assigned, either of you can submit proof for it from the
        event, no need to re-enter the details.
      </p>

      <form
        onSubmit={handleCreate}
        className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          <label className={labelClass}>
            Location
            <input
              type="text"
              name="location"
              required
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Date
            <input type="date" name="date" required className={fieldClass} />
          </label>
        </div>
        <label className={labelClass}>
          Assign a volunteer (optional)
          <select name="volunteer_id" className={fieldClass}>
            <option value="">— Unassigned (I&apos;ll deliver it) —</option>
            {volunteers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} — {v.location}, {v.country}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={creating}
          className="cursor-pointer rounded-full border-none bg-[var(--accent-green)] px-5 py-2.5 text-sm font-bold text-ink-fg disabled:opacity-60"
        >
          {creating ? "Scheduling…" : "Schedule Donation"}
        </button>
      </form>

      {error && <p className="m-0 mb-3 text-sm text-red-700">{error}</p>}
      {events === null && !error && (
        <p className="text-sm text-muted">Loading…</p>
      )}
      {events?.length === 0 && (
        <p className="text-sm text-muted">No donation events scheduled yet.</p>
      )}
      <div className="flex flex-col gap-3">
        {events?.map((ev) => (
          <div
            key={ev.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5"
          >
            <div>
              <p className="m-0 text-sm font-bold">
                {ev.date} — {ev.location}
              </p>
              <p className="m-0 mt-1 text-xs text-muted-2">
                {ev.status === "submitted"
                  ? "Submitted"
                  : ev.volunteerName
                    ? `Assigned to ${ev.volunteerName}`
                    : "Unassigned"}
              </p>
            </div>
            {ev.status === "scheduled" && (
              <select
                defaultValue={ev.volunteerId ?? ""}
                onChange={(e) => handleAssign(ev.id, e.target.value)}
                className={`${fieldClass} w-auto`}
              >
                <option value="">— Unassigned —</option>
                {volunteers.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.country})
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
