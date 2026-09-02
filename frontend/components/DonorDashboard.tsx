"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, uploadPhotos, uploadToPresignedUrl } from "@/lib/api";
import { COUNTRIES } from "@/lib/countries";
import { AddressMapPreview } from "@/components/AddressMapPreview";
import { EditDonationEventModal } from "@/components/EditDonationEventModal";
import { PhotoProofPicker } from "@/components/PhotoProofPicker";
import type {
  Donation,
  DonationEvent,
  Donor,
  PartnerCharity,
  VolunteerSummary,
} from "@/lib/types";

const fieldClass =
  "rounded-[10px] border border-border-strong bg-bg px-3.5 py-3 text-[15px] font-body";
const labelClass = "flex flex-col gap-1.5 text-[13px] font-bold";
const DUMMY_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DUMMY_LOGIN === "true";

function navButtonClass(active: boolean): string {
  return `cursor-pointer rounded-lg px-3.5 py-2.5 text-left text-sm font-bold ${
    active
      ? "bg-[var(--accent-green)] text-ink-fg"
      : "bg-transparent text-ink"
  }`;
}

type DashboardTab =
  | "overview"
  | "schedule"
  | "scheduled"
  | "completed"
  | "submit-proof"
  | "pending-approval"
  | "profile";

type DonorDashboardProps = {
  partnerCharities: PartnerCharity[];
};

export function DonorDashboard({ partnerCharities }: DonorDashboardProps) {
  const [donor, setDonor] = useState<Donor | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<DashboardTab>("overview");
  const [events, setEvents] = useState<DonationEvent[] | null>(null);
  const [eventsError, setEventsError] = useState("");
  const [volunteers, setVolunteers] = useState<VolunteerSummary[]>([]);

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

  function refreshEvents() {
    api
      .listMyDonationEvents()
      .then(setEvents)
      .catch(() => setEventsError("Couldn't load your donation events."));
  }

  useEffect(refreshEvents, []);

  useEffect(() => {
    api
      .listVolunteers()
      .then((list) =>
        // Same-country-as-donor volunteers first — a nudge toward the
        // likely-right match, not a hard filter. See
        // specs/features/010-country-field-for-matching/design.md.
        setVolunteers(
          [...list].sort((a, b) => {
            const aMatch = a.country === donor?.country ? 0 : 1;
            const bMatch = b.country === donor?.country ? 0 : 1;
            return aMatch - bMatch;
          }),
        ),
      )
      .catch(() => {});
  }, [donor?.country]);

  const scheduledEvents =
    events?.filter((e) => e.status === "scheduled") ?? [];
  const pendingApprovalEvents =
    events?.filter((e) => e.status === "submitted") ?? [];

  return (
    <div className="mx-auto max-w-[960px] px-[clamp(20px,5vw,56px)] py-[clamp(40px,6vw,72px)]">
      <h1 className="mt-0 mb-1 font-display text-2xl font-extrabold">
        My Donations
      </h1>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {!donor && !error && <p className="text-sm text-muted">Loading…</p>}

      {donor && (
        <div className="mt-6 flex flex-col gap-8 md:flex-row md:gap-10">
          <nav className="flex shrink-0 flex-row flex-wrap gap-2 md:w-48 md:flex-col md:gap-1">
            <button
              type="button"
              data-testid="dashboard-nav-overview"
              onClick={() => setTab("overview")}
              className={navButtonClass(tab === "overview")}
            >
              Overview
            </button>
            <button
              type="button"
              data-testid="dashboard-nav-schedule"
              onClick={() => setTab("schedule")}
              className={navButtonClass(tab === "schedule")}
            >
              Schedule New Donation Events
            </button>
            <button
              type="button"
              data-testid="dashboard-nav-scheduled"
              onClick={() => setTab("scheduled")}
              className={navButtonClass(tab === "scheduled")}
            >
              Scheduled Events
            </button>
            <button
              type="button"
              data-testid="dashboard-nav-completed"
              onClick={() => setTab("completed")}
              className={navButtonClass(tab === "completed")}
            >
              Completed Events
            </button>
            <button
              type="button"
              data-testid="dashboard-nav-submit-proof"
              onClick={() => setTab("submit-proof")}
              className={navButtonClass(tab === "submit-proof")}
            >
              Submit Proof of Delivery
            </button>
            <button
              type="button"
              data-testid="dashboard-nav-pending-approval"
              onClick={() => setTab("pending-approval")}
              className={navButtonClass(tab === "pending-approval")}
            >
              Events Pending Approval
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
            {tab === "overview" && <OverviewSection donor={donor} />}
            {tab === "schedule" && (
              <ScheduleDonationSection
                partnerCharities={partnerCharities}
                volunteers={volunteers}
                onCreated={refreshEvents}
              />
            )}
            {tab === "scheduled" && (
              <ScheduledEventsSection
                events={scheduledEvents}
                loading={events === null}
                error={eventsError}
                volunteers={volunteers}
                partnerCharities={partnerCharities}
                onChanged={refreshEvents}
              />
            )}
            {tab === "completed" && <CompletedEventsSection donor={donor} />}
            {tab === "submit-proof" && (
              <SubmitProofSection
                partnerCharities={partnerCharities}
                scheduledEvents={scheduledEvents}
                onSubmitted={refreshEvents}
              />
            )}
            {tab === "pending-approval" && (
              <PendingApprovalSection
                events={pendingApprovalEvents}
                loading={events === null}
                error={eventsError}
              />
            )}
            {tab === "profile" && (
              <ProfileSection donor={donor} onSaved={setDonor} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewSection({ donor }: { donor: Donor }) {
  return (
    <div>
      <h2 className="mt-0 mb-4 font-display text-lg font-bold">Overview</h2>
      <p className="m-0 mb-8 text-sm text-muted-2">
        {donor.name} · {donor.location}
        {donor.country ? `, ${donor.country}` : ""}
      </p>

      {DUMMY_LOGIN_ENABLED && donor.localUsername && (
        <div className="mb-8 rounded-2xl border border-dashed border-border-strong bg-card p-5">
          <p className="m-0 mb-2 text-xs font-bold text-muted-2 uppercase">
            Local dev login
          </p>
          <p className="m-0 text-sm">
            username: <code>{donor.localUsername}</code>
          </p>
          <p className="m-0 text-sm">
            password: <code>dummy_password</code>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="m-0 text-3xl font-extrabold text-[var(--accent-green)]">
            {donor.totalMeals.toLocaleString()}
          </p>
          <p className="m-0 mt-1 text-sm text-muted-2">Meals delivered</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="m-0 text-3xl font-extrabold">{donor.donationCount}</p>
          <p className="m-0 mt-1 text-sm text-muted-2">Deliveries</p>
        </div>
      </div>
    </div>
  );
}

function ProfileSection({
  donor,
  onSaved,
}: {
  donor: Donor;
  onSaved: (donor: Donor) => void;
}) {
  const [location, setLocation] = useState(donor.location);
  const [country, setCountry] = useState(donor.country || "United States");
  const [story, setStory] = useState(donor.story);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setStatus("idle");
    try {
      const updated = await api.updateMyDonor({ location, country, story });
      onSaved(updated);
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
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
        <label className={labelClass}>
          Your Donor Story
          <textarea
            name="story"
            value={story}
            onChange={(e) => setStory(e.target.value)}
            rows={4}
            required
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

function ScheduleDonationSection({
  partnerCharities,
  volunteers,
  onCreated,
}: {
  partnerCharities: PartnerCharity[];
  volunteers: VolunteerSummary[];
  onCreated: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [deliveryRole, setDeliveryRole] = useState<
    "self" | "volunteer_needed" | ""
  >("");
  const [addressInput, setAddressInput] = useState("");
  const selfRoleRef = useRef<HTMLInputElement>(null);
  const volunteerRoleRef = useRef<HTMLInputElement>(null);
  const partnerCharityRef = useRef<HTMLSelectElement>(null);

  // Delivery role and partner charity are mutually exclusive, matching the
  // Join In form on the home page — picking one clears the other, since
  // only one delivery method applies.
  function handleDeliveryRoleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDeliveryRole(e.target.value as "self" | "volunteer_needed");
    if (partnerCharityRef.current) partnerCharityRef.current.value = "";
  }

  function handlePartnerCharityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!e.target.value) return;
    if (selfRoleRef.current) selfRoleRef.current.checked = false;
    if (volunteerRoleRef.current) volunteerRoleRef.current.checked = false;
    setDeliveryRole("");
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setCreating(true);
    setError("");
    setSuccess(false);
    try {
      await api.createDonationEvent({
        location: String(data.get("location") ?? ""),
        date: String(data.get("date") ?? ""),
        start_time: String(data.get("start_time") ?? ""),
        end_time: String(data.get("end_time") ?? ""),
        volunteer_id: (data.get("volunteer_id") as string) || undefined,
        packet_count: data.get("packet_count")
          ? Number(data.get("packet_count"))
          : undefined,
        delivery_role:
          (data.get("delivery_role") as "self" | "volunteer_needed" | null) ??
          undefined,
        partner_charity: (data.get("partner_charity") as string) || undefined,
        notes: (data.get("notes") as string) || undefined,
      });
      form.reset();
      setDeliveryRole("");
      setAddressInput("");
      setSuccess(true);
      onCreated();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 400
          ? "End time must be after start time."
          : "Couldn't schedule that donation. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h2 className="mt-0 mb-4 font-display text-lg font-bold">
        Schedule new donation events
      </h2>
      <p className="m-0 mb-4 text-sm text-muted-2">
        Plan a delivery ahead of time — click into it later under
        &quot;Scheduled Events&quot; to edit details, assign a volunteer, or
        cancel it.
      </p>

      <form
        data-testid="schedule-donation-form"
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          <label className={labelClass}>
            Exact Address
            <input
              type="text"
              name="location"
              placeholder="700 Congress Ave, Austin, TX"
              required
              onChange={(e) => setAddressInput(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Date
            <input type="date" name="date" required className={fieldClass} />
          </label>
        </div>
        <AddressMapPreview address={addressInput} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
          <label className={labelClass}>
            Start Time
            <input
              type="time"
              name="start_time"
              required
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            End Time
            <input
              type="time"
              name="end_time"
              required
              className={fieldClass}
            />
          </label>
        </div>
        <label className={labelClass}>
          Number of Food Packets (optional)
          <input
            type="number"
            name="packet_count"
            min={1}
            className={fieldClass}
          />
        </label>
        <div className="flex flex-col gap-2 text-[13px] font-bold">
          How will this delivery happen? (optional)
          <label className="flex items-center gap-2 text-[15px] font-medium">
            <input
              ref={selfRoleRef}
              type="radio"
              name="delivery_role"
              value="self"
              onChange={handleDeliveryRoleChange}
            />{" "}
            I&apos;ll deliver it myself
          </label>
          <label className="flex items-center gap-2 text-[15px] font-medium">
            <input
              ref={volunteerRoleRef}
              type="radio"
              name="delivery_role"
              value="volunteer_needed"
              onChange={handleDeliveryRoleChange}
            />{" "}
            A volunteer will collect &amp; deliver
          </label>
          {deliveryRole === "volunteer_needed" && (
            <label className={`${labelClass} ml-6`}>
              Assign a volunteer (optional)
              <select name="volunteer_id" className={fieldClass}>
                <option value="">— Unassigned —</option>
                {volunteers.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} — {v.location}, {v.country}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className={labelClass}>
          Delivered through a partner charity instead? (optional)
          <select
            ref={partnerCharityRef}
            name="partner_charity"
            onChange={handlePartnerCharityChange}
            className={fieldClass}
          >
            <option value="">— None —</option>
            {partnerCharities.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Notes (optional)
          <textarea name="notes" rows={2} className={`${fieldClass} resize-y`} />
        </label>
        {error && <p className="m-0 text-sm text-red-700">{error}</p>}
        {success && !error && (
          <p className="m-0 text-sm text-[var(--accent-green)]">
            Donation event scheduled successfully.
          </p>
        )}
        <button
          type="submit"
          disabled={creating}
          className="cursor-pointer rounded-full border-none bg-[var(--accent-green)] px-5 py-2.5 text-sm font-bold text-ink-fg disabled:opacity-60"
        >
          {creating ? "Scheduling…" : "Schedule Donation"}
        </button>
      </form>
    </div>
  );
}

function ScheduledEventsSection({
  events,
  loading,
  error,
  volunteers,
  partnerCharities,
  onChanged,
}: {
  events: DonationEvent[];
  loading: boolean;
  error: string;
  volunteers: VolunteerSummary[];
  partnerCharities: PartnerCharity[];
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<DonationEvent | null>(null);

  return (
    <div>
      <h2 className="mt-0 mb-4 font-display text-lg font-bold">
        Scheduled Events
      </h2>
      {error && <p className="m-0 mb-3 text-sm text-red-700">{error}</p>}
      {loading && !error && <p className="text-sm text-muted">Loading…</p>}
      {!loading && events.length === 0 && (
        <p className="text-sm text-muted">No donation events scheduled yet.</p>
      )}
      <div className="flex flex-col gap-3">
        {events.map((ev) => (
          <button
            key={ev.id}
            type="button"
            data-testid="my-donation-event-card"
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
          volunteers={volunteers}
          canAssignVolunteer
          canCancel
          onClose={() => setSelected(null)}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}

function PendingApprovalSection({
  events,
  loading,
  error,
}: {
  events: DonationEvent[];
  loading: boolean;
  error: string;
}) {
  return (
    <div>
      <h2 className="mt-0 mb-4 font-display text-lg font-bold">
        Events Pending Approval
      </h2>
      <p className="m-0 mb-4 text-sm text-muted-2">
        Proof has been submitted for these and is awaiting admin review —
        each one moves to Completed Events once approved.
      </p>
      {error && <p className="m-0 mb-3 text-sm text-red-700">{error}</p>}
      {loading && !error && <p className="text-sm text-muted">Loading…</p>}
      {!loading && events.length === 0 && (
        <p className="text-sm text-muted">
          Nothing awaiting approval right now.
        </p>
      )}
      <div className="flex flex-col gap-3">
        {events.map((ev) => (
          <div
            key={ev.id}
            data-testid="pending-approval-event-card"
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5"
          >
            <div>
              <p className="m-0 text-sm font-bold">
                {ev.date} — {ev.location}
              </p>
              <p className="m-0 mt-1 text-xs text-muted-2">
                {ev.volunteerName ? `Assigned to ${ev.volunteerName}` : "Unassigned"}
              </p>
            </div>
            <span className="self-start rounded-full bg-[var(--accent-amber)]/15 px-3.5 py-1.5 text-xs font-bold text-[var(--accent-amber)]">
              Awaiting admin approval
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompletedEventsSection({ donor }: { donor: Donor }) {
  const [selected, setSelected] = useState<Donation | null>(null);

  return (
    <div>
      <h2 className="mt-0 mb-4 font-display text-lg font-bold">
        Completed Events
      </h2>
      {(donor.donations?.length ?? 0) === 0 && (
        <p className="text-sm text-muted">
          No completed deliveries yet.
          {donor.createdAt && ` Joined ${donor.createdAt}.`}
        </p>
      )}
      <div className="flex flex-col gap-3">
        {donor.donations?.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setSelected(d)}
            className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 text-left"
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
            {d.coverPhotoUrl && (
              <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.coverPhotoUrl}
                  alt="Delivery proof"
                  className="h-full w-full object-cover"
                />
              </span>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <CompletedDonationModal
          donation={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function CompletedDonationModal({
  donation,
  onClose,
}: {
  donation: Donation;
  onClose: () => void;
}) {
  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[200] bg-modal-backdrop"
      />
      <div className="fixed top-1/2 left-1/2 z-[201] flex max-h-[90vh] w-[min(480px,90vw)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-3xl bg-card p-[clamp(24px,3vw,32px)] shadow-[0_24px_60px_oklch(21%_0.03_155_/_0.25)]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 font-display text-lg font-bold">
            {donation.meals} meals — {donation.location}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent p-1 text-[22px] leading-none text-muted-2"
          >
            ×
          </button>
        </div>
        <p className="m-0 text-sm text-muted-2">{donation.date}</p>
        {donation.caption && (
          <p className="m-0 text-sm text-muted italic">{donation.caption}</p>
        )}
        {donation.coverPhotoUrl && (
          <div className="overflow-hidden rounded-2xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={donation.coverPhotoUrl}
              alt="Delivery proof"
              className="w-full object-cover"
            />
          </div>
        )}
        {(donation.photoUrls?.length ?? 0) > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {donation.photoUrls!.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square overflow-hidden rounded-lg border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Delivery proof"
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        )}
        {donation.receiptUrl && (
          <a
            href={donation.receiptUrl}
            target="_blank"
            rel="noreferrer"
            className="cursor-pointer self-start rounded-full border border-border-strong bg-transparent px-4 py-2 text-sm font-bold text-ink"
          >
            View Receipt
          </a>
        )}
      </div>
    </>
  );
}

function SubmitProofSection({
  partnerCharities,
  scheduledEvents,
  onSubmitted,
}: {
  partnerCharities: PartnerCharity[];
  scheduledEvents: DonationEvent[];
  onSubmitted: () => void;
}) {
  const [status, setStatus] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [location, setLocation] = useState("");
  const [mealsDelivered, setMealsDelivered] = useState("");
  const [deliveryRole, setDeliveryRole] = useState<
    "self" | "volunteer_needed" | ""
  >("");
  const [partnerCharity, setPartnerCharity] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);

  const selectedEvent = scheduledEvents.find((e) => e.id === selectedEventId);

  function handleEventChange(eventId: string) {
    setSelectedEventId(eventId);
    const event = scheduledEvents.find((e) => e.id === eventId);
    setLocation(event ? event.location : "");
    // Default to what was entered at schedule/edit time; still editable below.
    setMealsDelivered(event?.packetCount ? String(event.packetCount) : "");
    setDeliveryRole(event?.deliveryRole ?? "");
    setPartnerCharity(event?.partnerCharity ?? "");
    setPhotoFiles([]);
    setCoverIndex(0);
  }

  function handleDeliveryRoleChange(value: "self" | "volunteer_needed") {
    setDeliveryRole(value);
    setPartnerCharity("");
  }

  function handlePartnerCharityChange(value: string) {
    setPartnerCharity(value);
    if (value) setDeliveryRole("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const receipt = data.get("receipt") as File | null;

    if (photoFiles.length === 0) {
      setStatus("error");
      setErrorMessage("Please choose a photo.");
      return;
    }

    setStatus("uploading");
    setErrorMessage("");
    try {
      const photoKeys = await uploadPhotos(photoFiles);

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
        location,
        meals: Number(data.get("meals_delivered") ?? 0),
        photo_keys: photoKeys,
        cover_photo_key: photoKeys[coverIndex],
        receipt_key: receiptKey,
        caption: (data.get("caption") as string) || undefined,
        delivery_role:
          (data.get("delivery_role") as "self" | "volunteer_needed" | null) ??
          undefined,
        partner_charity: (data.get("partner_charity") as string) || undefined,
        donation_event_id: selectedEventId,
      });
      setStatus("done");
      setSelectedEventId("");
      setLocation("");
      setMealsDelivered("");
      setDeliveryRole("");
      setPartnerCharity("");
      setPhotoFiles([]);
      setCoverIndex(0);
      form.reset();
      onSubmitted();
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof ApiError && err.status === 403
          ? "You need an approved donor application before submitting proof."
          : "Something went wrong submitting your proof. Please try again.",
      );
    }
  }

  return (
    <div>
      <h2 className="mt-0 mb-4 font-display text-lg font-bold">
        Submit Proof of Delivery
      </h2>
      {status === "done" ? (
        <div className="rounded-3xl border border-border bg-card p-9 text-center">
          <p className="m-0 text-lg font-bold text-[var(--accent-green)]">
            Thanks — submitted for review!
          </p>
          <p className="mt-2 mb-0 text-sm text-muted">
            Your meal count updates once it&apos;s approved.
          </p>
        </div>
      ) : scheduledEvents.length === 0 ? (
        <p className="m-0 rounded-2xl border border-border bg-card p-5 text-sm text-muted">
          There are no scheduled events.
        </p>
      ) : (
        <form
          data-testid="submit-proof-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
        >
          <label className={labelClass}>
            Which scheduled donation is this for?
            <select
              value={selectedEventId}
              onChange={(e) => handleEventChange(e.target.value)}
              required
              className={fieldClass}
            >
              <option value="" disabled>
                — Select a scheduled donation —
              </option>
              {scheduledEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.date} — {ev.location}
                </option>
              ))}
            </select>
          </label>
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
                value={mealsDelivered}
                onChange={(e) => setMealsDelivered(e.target.value)}
                required
                className={fieldClass}
              />
            </label>
          </div>
          <PhotoProofPicker
            files={photoFiles}
            onFilesChange={setPhotoFiles}
            coverIndex={coverIndex}
            onCoverIndexChange={setCoverIndex}
          />
          <label className={labelClass}>
            Receipt (optional)
            <input
              type="file"
              name="receipt"
              accept="image/*,.pdf"
              className="px-1 py-2.5 text-sm"
            />
          </label>
          <div className="flex flex-col gap-2 text-[13px] font-bold">
            How was it delivered? (optional)
            <label className="flex items-center gap-2 text-[15px] font-medium">
              <input
                type="radio"
                name="delivery_role"
                value="self"
                checked={deliveryRole === "self"}
                onChange={() => handleDeliveryRoleChange("self")}
              />{" "}
              I delivered it myself
            </label>
            <label className="flex items-center gap-2 text-[15px] font-medium">
              <input
                type="radio"
                name="delivery_role"
                value="volunteer_needed"
                checked={deliveryRole === "volunteer_needed"}
                onChange={() => handleDeliveryRoleChange("volunteer_needed")}
              />{" "}
              A volunteer delivered it for me
            </label>
            {deliveryRole === "volunteer_needed" && selectedEvent?.volunteerName && (
              <label className={labelClass}>
                Assigned volunteer
                <select
                  disabled
                  value={selectedEvent.volunteerId ?? ""}
                  className={fieldClass}
                >
                  <option value={selectedEvent.volunteerId ?? ""}>
                    {selectedEvent.volunteerName}
                  </option>
                </select>
              </label>
            )}
          </div>
          <label className={labelClass}>
            Delivered through a partner charity? (optional)
            <select
              name="partner_charity"
              value={partnerCharity}
              onChange={(e) => handlePartnerCharityChange(e.target.value)}
              className={fieldClass}
            >
              <option value="">— None —</option>
              {partnerCharities.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
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
    </div>
  );
}
