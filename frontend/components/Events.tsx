"use client";

import { useState } from "react";
import { ShareEventMenu } from "@/components/ShareEventMenu";
import {
  directionsUrl,
  formatTimeRange,
  hasStaticMap,
  staticMapUrl,
} from "@/lib/staticMap";
import type { DonationEvent, EventItem } from "@/lib/types";

type EventsProps = {
  events: EventItem[];
  donationEvents: DonationEvent[];
};

export function Events({ events, donationEvents }: EventsProps) {
  const scheduledDonationEvents = donationEvents.filter(
    (d) => d.status === "scheduled",
  );
  const completedDonationEvents = donationEvents.filter(
    (d) => d.status === "completed",
  );
  const hasScheduled = events.length > 0 || scheduledDonationEvents.length > 0;
  const [tab, setTab] = useState<"scheduled" | "completed">("scheduled");
  const [selectedCompleted, setSelectedCompleted] =
    useState<DonationEvent | null>(null);

  // Derived, not synced-via-effect: if Scheduled is (or becomes) empty,
  // Completed wins regardless of the last explicit selection — covers
  // both "there was never anything scheduled" and "it emptied out from
  // under an already-mounted visitor." See
  // specs/features/014-homepage-scheduled-events/requirements.md.
  const showScheduled = hasScheduled && tab === "scheduled";

  return (
    <section
      id="events"
      className="bg-bg-alt px-[clamp(20px,5vw,56px)] py-[clamp(56px,8vw,100px)]"
    >
      <div className="mx-auto max-w-[1160px]">
        <div className="mx-auto mb-8 max-w-[640px] text-center">
          <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--accent-green)] uppercase">
            Upcoming Events
          </span>
          <h2 className="mt-3 mb-3.5 font-display text-[clamp(28px,4vw,42px)] font-extrabold tracking-[-0.01em]">
            Join an upcoming drive.
          </h2>
          <p className="m-0 text-base leading-[1.65] text-muted">
            Real dates, real neighborhoods — come deliver meals with us in
            person.
          </p>
        </div>

        <div className="mb-8 flex justify-center gap-2">
          <button
            type="button"
            disabled={!hasScheduled}
            onClick={() => setTab("scheduled")}
            className={`cursor-pointer rounded-full border px-5 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
              showScheduled
                ? "border-[var(--accent-green)] bg-[var(--accent-green)] text-ink-fg"
                : "border-border-strong bg-transparent text-muted"
            }`}
          >
            Scheduled
          </button>
          <button
            type="button"
            onClick={() => setTab("completed")}
            className={`cursor-pointer rounded-full border px-5 py-2.5 text-sm font-bold ${
              !showScheduled
                ? "border-[var(--accent-green)] bg-[var(--accent-green)] text-ink-fg"
                : "border-border-strong bg-transparent text-muted"
            }`}
          >
            Completed
          </button>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
          {showScheduled ? (
            <>
              {events.map((ev) => (
                <CommunityEventCard key={ev.id} event={ev} />
              ))}
              {scheduledDonationEvents.map((ev) => (
                <ScheduledDonationEventCard key={ev.id} event={ev} />
              ))}
              {events.length === 0 && scheduledDonationEvents.length === 0 && (
                <p className="col-span-full text-center text-sm text-muted">
                  No scheduled events yet.
                </p>
              )}
            </>
          ) : (
            <>
              {completedDonationEvents.map((ev) => (
                <CompletedDonationEventCard
                  key={ev.id}
                  event={ev}
                  onClick={() => setSelectedCompleted(ev)}
                />
              ))}
              {completedDonationEvents.length === 0 && (
                <p className="col-span-full text-center text-sm text-muted">
                  No completed events yet.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {selectedCompleted && (
        <CompletedEventModal
          event={selectedCompleted}
          onClose={() => setSelectedCompleted(null)}
        />
      )}
    </section>
  );
}

function CommunityEventCard({ event }: { event: EventItem }) {
  return (
    <div
      data-testid="community-event-card"
      className="flex flex-col gap-3.5 rounded-[20px] border border-border bg-card p-7"
    >
      <div className="inline-flex self-start rounded-full bg-green-soft px-3.5 py-1.5 text-[13px] font-bold text-[var(--accent-green)]">
        {event.date} · {event.time}
      </div>
      <p className="m-0 text-sm font-bold text-muted-2">{event.location}</p>
      <p className="m-0 flex-grow text-[15px] leading-[1.6] text-muted">
        {event.description}
      </p>
      <p className="m-0 text-[13px] font-bold tracking-[0.03em] text-muted-2 uppercase">
        Packet goal: {event.packetsGoal.toLocaleString()}
      </p>
      <a
        href="#participate"
        className="mt-1.5 rounded-full bg-[var(--accent-green)] px-5 py-3 text-center text-[14.5px] font-bold text-ink-fg no-underline"
      >
        I&apos;ll Join This One
      </a>
    </div>
  );
}

function CompletedDonationEventCard({
  event,
  onClick,
}: {
  event: DonationEvent;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="donation-event-card"
      className="flex cursor-pointer flex-col gap-3.5 rounded-[20px] border border-border bg-card p-7 text-left"
    >
      {event.coverPhotoUrl && (
        <div className="-mx-7 -mt-7 h-40 overflow-hidden rounded-t-[20px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.coverPhotoUrl}
            alt="Delivery proof"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="inline-flex self-start rounded-full bg-green-soft px-3.5 py-1.5 text-[13px] font-bold text-[var(--accent-green)]">
        {event.date} · Delivered ✓
      </div>
      <p className="m-0 text-sm font-bold text-muted-2">{event.location}</p>
      <p className="m-0 text-[15px] leading-[1.6] text-muted">
        A donation from <span className="font-bold">{event.donorName}</span>
      </p>
      <p className="m-0 text-[13px] font-bold tracking-[0.03em] text-muted-2 uppercase">
        {event.partnerCharity
          ? `Delivered via ${event.partnerCharity}`
          : event.volunteerName
            ? `Volunteer: ${event.volunteerName}`
            : "Self-delivered"}
      </p>
    </button>
  );
}

function ScheduledDonationEventCard({ event }: { event: DonationEvent }) {
  const [mapFailed, setMapFailed] = useState(false);
  const { latitude: lat, longitude: lon } = event;
  const hasCoords = lat != null && lon != null;
  const showMap = hasCoords && hasStaticMap() && !mapFailed;
  const timeRange = formatTimeRange(event.startTime, event.endTime);
  const deliveryLine = event.partnerCharity
    ? `Delivered via ${event.partnerCharity}`
    : event.volunteerName
      ? `Volunteer: ${event.volunteerName}`
      : null;

  return (
    <div
      data-testid="donation-event-card"
      className="flex flex-col gap-3.5 rounded-[20px] border border-border bg-card p-7 text-left"
    >
      {showMap && lat != null && lon != null && (
        <a
          href={directionsUrl(lat, lon)}
          target="_blank"
          rel="noopener noreferrer"
          className="-mx-7 -mt-7 block h-40 overflow-hidden rounded-t-[20px]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={staticMapUrl(lat, lon)}
            alt={`Map of ${event.location}`}
            onError={() => setMapFailed(true)}
            className="h-full w-full object-cover"
          />
        </a>
      )}
      <div className="inline-flex self-start rounded-full bg-green-soft px-3.5 py-1.5 text-[13px] font-bold text-[var(--accent-green)]">
        {timeRange ? `${event.date} · ${timeRange}` : event.date}
      </div>
      {showMap ? (
        <p className="m-0 text-sm font-bold text-muted-2">{event.location}</p>
      ) : hasCoords && lat != null && lon != null ? (
        <a
          href={directionsUrl(lat, lon)}
          target="_blank"
          rel="noopener noreferrer"
          className="m-0 text-sm font-bold text-muted-2 no-underline"
        >
          {event.location}
        </a>
      ) : (
        <p className="m-0 text-sm font-bold text-muted-2">{event.location}</p>
      )}
      <p className="m-0 text-[15px] leading-[1.6] text-muted">
        A donation from <span className="font-bold">{event.donorName}</span>
      </p>
      {event.notes && (
        <p className="m-0 text-sm leading-[1.6] text-muted italic">
          {event.notes}
        </p>
      )}
      {deliveryLine && (
        <p className="m-0 text-[13px] font-bold tracking-[0.03em] text-muted-2 uppercase">
          {deliveryLine}
        </p>
      )}
      <div className="mt-1 self-start">
        <ShareEventMenu event={event} />
      </div>
    </div>
  );
}

function CompletedEventModal({
  event,
  onClose,
}: {
  event: DonationEvent;
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
            {event.location}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent p-1 text-[22px] leading-none text-muted-2"
          >
            ×
          </button>
        </div>
        <p className="m-0 text-sm text-muted-2">{event.date} · Delivered ✓</p>
        <p className="m-0 text-sm text-muted">
          A donation from <span className="font-bold">{event.donorName}</span>
          {" — "}
          {event.partnerCharity
            ? `delivered via ${event.partnerCharity}`
            : event.volunteerName
              ? `volunteer: ${event.volunteerName}`
              : "self-delivered"}
        </p>
        {event.caption && (
          <p className="m-0 text-sm text-muted italic">{event.caption}</p>
        )}
        {event.coverPhotoUrl && (
          <div className="overflow-hidden rounded-2xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.coverPhotoUrl}
              alt="Delivery proof"
              className="w-full object-cover"
            />
          </div>
        )}
        {(event.photoUrls?.length ?? 0) > 1 && (
          <div className="grid grid-cols-4 gap-2">
            {event.photoUrls!.map((url) => (
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
      </div>
    </>
  );
}
