"use client";

import { useEffect, useState } from "react";
import { api, ApiError, uploadToPresignedUrl } from "@/lib/api";
import { COUNTRIES } from "@/lib/countries";
import { EditDonationEventModal } from "@/components/EditDonationEventModal";
import type {
  DonationEvent,
  EventItem,
  PartnerCharity,
  Volunteer,
} from "@/lib/types";

const fieldClass =
  "rounded-[10px] border border-border-strong bg-bg px-3.5 py-3 text-[15px] font-body";
const labelClass = "flex flex-col gap-1.5 text-[13px] font-bold";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DUMMY_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DUMMY_LOGIN === "true";

function navButtonClass(active: boolean): string {
  return `cursor-pointer rounded-lg px-3.5 py-2.5 text-left text-sm font-bold ${
    active
      ? "bg-[var(--accent-green)] text-ink-fg"
      : "bg-transparent text-ink"
  }`;
}

type VolunteerDashboardProps = {
  events: EventItem[];
  partnerCharities: PartnerCharity[];
};

export function VolunteerDashboard({
  events,
  partnerCharities,
}: VolunteerDashboardProps) {
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [error, setError] = useState("");
  const [rsvpPending, setRsvpPending] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "profile">("overview");
  const [assignedEvents, setAssignedEvents] = useState<DonationEvent[] | null>(
    null,
  );
  const [assignedEventsError, setAssignedEventsError] = useState("");

  function refresh() {
    api
      .getMyVolunteer()
      .then(setVolunteer)
      .catch((err) =>
        setError(
          err instanceof ApiError && err.status === 404
            ? "We couldn't find a volunteer profile linked to your account."
            : "Couldn't load your volunteer profile.",
        ),
      );
  }

  useEffect(refresh, []);

  function refreshAssignedEvents() {
    api
      .listVolunteerAssignedEvents()
      .then(setAssignedEvents)
      .catch(() =>
        setAssignedEventsError("Couldn't load your assigned donation events."),
      );
  }

  useEffect(refreshAssignedEvents, []);

  const scheduledAssignedEvents =
    assignedEvents?.filter((e) => e.status === "scheduled") ?? [];

  const joinedIds = new Set(volunteer?.events.map((e) => e.id));

  async function toggleRsvp(eventId: string, joined: boolean) {
    setRsvpPending(eventId);
    try {
      if (joined) {
        await api.cancelRsvp(eventId);
      } else {
        await api.rsvpToEvent(eventId);
      }
      refresh();
    } catch {
      setError("Couldn't update your RSVP. Please try again.");
    } finally {
      setRsvpPending(null);
    }
  }

  return (
    <div className="mx-auto max-w-[760px] px-[clamp(20px,5vw,56px)] py-[clamp(40px,6vw,72px)]">
      <h1 className="mt-0 mb-1 font-display text-2xl font-extrabold">
        My Volunteering
      </h1>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {!volunteer && !error && <p className="text-sm text-muted">Loading…</p>}

      {volunteer && (
        <div className="mt-6 flex flex-col gap-8 md:flex-row md:gap-10">
          <nav className="flex shrink-0 flex-row gap-2 md:w-44 md:flex-col md:gap-1">
            <button
              type="button"
              data-testid="dashboard-nav-overview"
              onClick={() => setTab("overview")}
              className={navButtonClass(tab === "overview")}
            >
              My Volunteering
            </button>
            <button
              type="button"
              data-testid="dashboard-nav-profile"
              onClick={() => setTab("profile")}
              className={navButtonClass(tab === "profile")}
            >
              Profile
            </button>
          </nav>

          <div className="min-w-0 flex-1">
            {tab === "profile" ? (
              <ProfileSection volunteer={volunteer} onSaved={setVolunteer} />
            ) : (
              <>
                <p className="m-0 mb-8 text-sm text-muted-2">
                  {volunteer.name} · {volunteer.location}
                  {volunteer.country ? `, ${volunteer.country}` : ""}
                </p>

                {DUMMY_LOGIN_ENABLED && volunteer.localUsername && (
                  <div className="mb-8 rounded-2xl border border-dashed border-border-strong bg-card p-5">
                    <p className="m-0 mb-2 text-xs font-bold text-muted-2 uppercase">
                      Local dev login
                    </p>
                    <p className="m-0 text-sm">
                      username: <code>{volunteer.localUsername}</code>
                    </p>
                    <p className="m-0 text-sm">
                      password: <code>dummy_password</code>
                    </p>
                  </div>
                )}

                <h2 className="mt-0 mb-4 font-display text-lg font-bold">
                  Events
                </h2>
                {events.length === 0 && (
                  <p className="text-sm text-muted">
                    No upcoming events yet.
                  </p>
                )}
                <div className="mb-10 flex flex-col gap-3">
                  {events.map((e) => {
                    const joined = joinedIds.has(e.id);
                    return (
                      <div
                        key={e.id}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5"
                      >
                        <div>
                          <p className="m-0 text-sm font-bold">
                            {e.date} · {e.time} — {e.location}
                          </p>
                          <p className="m-0 mt-1 text-sm text-muted-2">
                            {e.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={rsvpPending === e.id}
                          onClick={() => toggleRsvp(e.id, joined)}
                          className={`shrink-0 cursor-pointer rounded-full border px-4 py-2 text-xs font-bold disabled:opacity-60 ${
                            joined
                              ? "border-border-strong bg-transparent text-ink"
                              : "border-none bg-[var(--accent-green)] text-ink-fg"
                          }`}
                        >
                          {joined ? "Cancel RSVP" : "RSVP"}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <AssignedDonationEventsSection
                  events={scheduledAssignedEvents}
                  loading={assignedEvents === null}
                  error={assignedEventsError}
                  partnerCharities={partnerCharities}
                  onChanged={refreshAssignedEvents}
                />

                <SubmitForDonorForm assignedEvents={scheduledAssignedEvents} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileSection({
  volunteer,
  onSaved,
}: {
  volunteer: Volunteer;
  onSaved: (volunteer: Volunteer) => void;
}) {
  const [location, setLocation] = useState(volunteer.location);
  const [country, setCountry] = useState(volunteer.country || "United States");
  const [packetsPerTrip, setPacketsPerTrip] = useState(
    volunteer.packetsPerTrip != null ? String(volunteer.packetsPerTrip) : "",
  );
  const [availability, setAvailability] = useState(volunteer.availability ?? "");
  const [volunteeringHistory, setVolunteeringHistory] = useState(
    volunteer.volunteeringHistory ?? "",
  );
  const [references, setReferences] = useState(volunteer.references ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setStatus("idle");
    try {
      const updated = await api.updateMyVolunteer({
        location,
        country,
        packets_per_trip: Number(packetsPerTrip),
        availability,
        volunteering_history: volunteeringHistory || undefined,
        references: references || undefined,
      });
      onSaved(updated);
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-10">
      <h2 className="mt-0 mb-4 font-display text-lg font-bold">
        My Profile
      </h2>
      <form
        data-testid="profile-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
          <label className={labelClass}>
            Location
            <input
              type="text"
              name="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Country
            <select
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
              className={fieldClass}
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
          <label className={labelClass}>
            Packets You Can Handle Per Trip
            <input
              type="number"
              name="packets_per_trip"
              min={1}
              value={packetsPerTrip}
              onChange={(e) => setPacketsPerTrip(e.target.value)}
              required
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Availability
            <input
              type="text"
              name="availability"
              placeholder="e.g. weekends, evenings, flexible"
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              required
              className={fieldClass}
            />
          </label>
        </div>
        <label className={labelClass}>
          Prior Volunteering Experience (optional)
          <textarea
            name="volunteering_history"
            rows={3}
            value={volunteeringHistory}
            onChange={(e) => setVolunteeringHistory(e.target.value)}
            className={`${fieldClass} resize-y`}
          />
        </label>
        <label className={labelClass}>
          Donor References (optional)
          <textarea
            name="references"
            rows={2}
            value={references}
            onChange={(e) => setReferences(e.target.value)}
            className={`${fieldClass} resize-y`}
          />
        </label>
        {status === "error" && (
          <p className="m-0 text-sm text-red-700">
            Couldn&apos;t save your profile. Please try again.
          </p>
        )}
        {status === "saved" && (
          <p className="m-0 text-sm text-[var(--accent-green)]">
            Profile updated.
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="cursor-pointer self-start rounded-full border-none bg-[var(--accent-green)] px-5 py-2.5 text-sm font-bold text-ink-fg disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Profile"}
        </button>
      </form>
    </div>
  );
}

function AssignedDonationEventsSection({
  events,
  loading,
  error,
  partnerCharities,
  onChanged,
}: {
  events: DonationEvent[];
  loading: boolean;
  error: string;
  partnerCharities: PartnerCharity[];
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<DonationEvent | null>(null);

  return (
    <div className="mb-10">
      <h2 className="mt-0 mb-4 font-display text-lg font-bold">
        My Assigned Donation Events
      </h2>
      {error && <p className="m-0 mb-3 text-sm text-red-700">{error}</p>}
      {loading && !error && <p className="text-sm text-muted">Loading…</p>}
      {!loading && events.length === 0 && (
        <p className="text-sm text-muted">
          No donation events assigned to you yet.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {events.map((ev) => (
          <button
            key={ev.id}
            type="button"
            data-testid="assigned-donation-event-card"
            onClick={() => setSelected(ev)}
            className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 text-left"
          >
            <div>
              <p className="m-0 text-sm font-bold">
                {ev.date} — {ev.location}
              </p>
              {ev.packetCount && (
                <p className="m-0 mt-1 text-xs text-muted-2">
                  {ev.packetCount} food packets
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <EditDonationEventModal
          event={selected}
          partnerCharities={partnerCharities}
          volunteers={[]}
          canAssignVolunteer={false}
          canCancel={false}
          onClose={() => setSelected(null)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}

function SubmitForDonorForm({
  assignedEvents,
}: {
  assignedEvents: DonationEvent[];
}) {
  const [status, setStatus] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [location, setLocation] = useState("");

  const selectedEvent = assignedEvents.find((e) => e.id === selectedEventId);

  function handleEventChange(eventId: string) {
    setSelectedEventId(eventId);
    const event = assignedEvents.find((e) => e.id === eventId);
    setLocation(event ? event.location : "");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const photo = data.get("photo") as File | null;
    const receipt = data.get("receipt") as File | null;

    if (!photo || photo.size === 0) {
      setStatus("error");
      setErrorMessage("Please choose a photo.");
      return;
    }
    if (photo.size > MAX_UPLOAD_BYTES) {
      setStatus("error");
      setErrorMessage("Photo must be under 10MB.");
      return;
    }

    setStatus("uploading");
    setErrorMessage("");
    try {
      const photoPresign = await api.presignUpload({
        content_type: photo.type,
        size: photo.size,
      });
      await uploadToPresignedUrl(photoPresign.upload_url, photo);

      let receiptKey: string | undefined;
      if (receipt && receipt.size > 0) {
        const receiptPresign = await api.presignUpload({
          content_type: receipt.type,
          size: receipt.size,
        });
        await uploadToPresignedUrl(receiptPresign.upload_url, receipt);
        receiptKey = receiptPresign.key;
      }

      await api.submitProof({
        donation_event_id: selectedEventId,
        location,
        meals: Number(data.get("meals_delivered") ?? 0),
        photo_key: photoPresign.key,
        receipt_key: receiptKey,
        caption: (data.get("caption") as string) || undefined,
      });
      setStatus("done");
      setSelectedEventId("");
      setLocation("");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof ApiError && err.status === 403
          ? "You're not a linked volunteer, so you can't submit on a donor's behalf."
          : "Something went wrong submitting proof. Please try again.",
      );
    }
  }

  return (
    <>
      <h2 className="mt-0 mb-4 font-display text-lg font-bold">
        Submit proof for a donor
      </h2>
      <p className="m-0 mb-4 text-sm text-muted-2">
        Delivered on behalf of a donor? Submit the proof here and it&apos;ll
        count toward their total once approved.
      </p>
      {status === "done" ? (
        <div className="rounded-3xl border border-border bg-card p-9 text-center">
          <p className="m-0 text-lg font-bold text-[var(--accent-green)]">
            Thanks — submitted for review!
          </p>
        </div>
      ) : assignedEvents.length === 0 ? (
        <p className="m-0 rounded-3xl border border-border bg-card p-[clamp(24px,3vw,36px)] text-sm text-muted">
          There are no scheduled events.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-[clamp(24px,3vw,36px)]"
        >
          <label className={labelClass}>
            Which donation is this for?
            <select
              value={selectedEventId}
              onChange={(e) => handleEventChange(e.target.value)}
              required
              className={fieldClass}
            >
              <option value="" disabled>
                — Select a scheduled donation —
              </option>
              {assignedEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.donorName} — {ev.date} — {ev.location}
                </option>
              ))}
            </select>
          </label>
          {selectedEvent && (
            <div className="rounded-[10px] bg-green-soft px-3.5 py-2.5 text-sm font-bold text-[var(--accent-green)]">
              Donor: {selectedEvent.donorName}
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
            <label className={labelClass}>
              Location
              <input
                type="text"
                name="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                readOnly={Boolean(selectedEvent)}
                required
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Meals Delivered
              <input
                type="number"
                name="meals_delivered"
                min={1}
                required
                className={fieldClass}
              />
            </label>
          </div>
          <label className={labelClass}>
            Photo Proof
            <input
              type="file"
              name="photo"
              accept="image/*"
              required
              className="px-1 py-2.5 text-sm"
            />
          </label>
          <label className={labelClass}>
            Receipt (optional)
            <input
              type="file"
              name="receipt"
              accept="image/*,.pdf"
              className="px-1 py-2.5 text-sm"
            />
          </label>
          <label className={labelClass}>
            Caption (optional)
            <input type="text" name="caption" className={fieldClass} />
          </label>
          {status === "error" && (
            <p className="m-0 text-sm text-red-700">{errorMessage}</p>
          )}
          <button
            type="submit"
            disabled={status === "uploading"}
            className="mt-1 cursor-pointer rounded-full border-none bg-[var(--accent-amber)] py-4 text-base font-bold text-ink disabled:opacity-60"
          >
            {status === "uploading" ? "Uploading…" : "Submit Proof"}
          </button>
        </form>
      )}
    </>
  );
}
