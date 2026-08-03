"use client";

import { useEffect, useState } from "react";
import { api, ApiError, uploadToPresignedUrl } from "@/lib/api";
import type { EventItem, Volunteer } from "@/lib/types";

const fieldClass =
  "rounded-[10px] border border-border-strong bg-bg px-3.5 py-3 text-[15px] font-body";
const labelClass = "flex flex-col gap-1.5 text-[13px] font-bold";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type VolunteerDashboardProps = {
  events: EventItem[];
};

export function VolunteerDashboard({ events }: VolunteerDashboardProps) {
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [error, setError] = useState("");
  const [rsvpPending, setRsvpPending] = useState<string | null>(null);

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
        <>
          <p className="m-0 mb-8 text-sm text-muted-2">
            {volunteer.name} · {volunteer.location}
          </p>

          <h2 className="mt-0 mb-4 font-display text-lg font-bold">Events</h2>
          {events.length === 0 && (
            <p className="text-sm text-muted">No upcoming events yet.</p>
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

          <SubmitForDonorForm />
        </>
      )}
    </div>
  );
}

function SubmitForDonorForm() {
  const [status, setStatus] = useState<
    "idle" | "uploading" | "done" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const photo = data.get("photo") as File | null;
    const receipt = data.get("receipt") as File | null;
    const donorId = String(data.get("donor_id") ?? "").trim();

    if (!donorId) {
      setStatus("error");
      setErrorMessage("Please enter the donor's ID.");
      return;
    }
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
        donor_id: donorId,
        location: String(data.get("location") ?? ""),
        meals: Number(data.get("meals_delivered") ?? 0),
        photo_key: photoPresign.key,
        receipt_key: receiptKey,
        caption: (data.get("caption") as string) || undefined,
      });
      setStatus("done");
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
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-[clamp(24px,3vw,36px)]"
        >
          <label className={labelClass}>
            Donor ID
            <input
              type="text"
              name="donor_id"
              required
              placeholder="The donor's ID"
              className={fieldClass}
            />
          </label>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
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
