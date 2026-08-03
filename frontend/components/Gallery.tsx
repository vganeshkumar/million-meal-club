"use client";

import { useState } from "react";
import { api, ApiError, uploadToPresignedUrl } from "@/lib/api";
import type { AuthUser, GalleryPhoto, PartnerCharity } from "@/lib/types";

const NOT_APPROVED_MESSAGE =
  "You need an approved donor application before submitting proof — apply via Join In below.";

type GalleryProps = {
  user: AuthUser | null;
  gallery: GalleryPhoto[];
  partnerCharities: PartnerCharity[];
  onOpenSignIn: () => void;
};

const PLACEHOLDER_COUNT = 6;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const fieldClass =
  "rounded-[10px] border border-border-strong bg-bg px-3.5 py-3 text-[15px] font-body";
const labelClass = "flex flex-col gap-1.5 text-[13px] font-bold";

export function Gallery({
  user,
  gallery,
  partnerCharities,
  onOpenSignIn,
}: GalleryProps) {
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
        location: String(data.get("location") ?? ""),
        meals: Number(data.get("meals_delivered") ?? 0),
        photo_key: photoPresign.key,
        receipt_key: receiptKey,
        caption: (data.get("caption") as string) || undefined,
        delivery_role:
          (data.get("delivery_role") as "self" | "volunteer_needed" | null) ??
          undefined,
        partner_charity: (data.get("partner_charity") as string) || undefined,
      });
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof ApiError && err.status === 403
          ? NOT_APPROVED_MESSAGE
          : "Something went wrong submitting your proof. Please try again.",
      );
    }
  }

  const slots = Array.from(
    { length: Math.max(gallery.length, PLACEHOLDER_COUNT) },
    (_, i) => gallery[i],
  );

  return (
    <section
      id="gallery"
      className="mx-auto max-w-[1160px] px-[clamp(20px,5vw,56px)] py-[clamp(56px,8vw,100px)]"
    >
      <div className="mx-auto mb-5 max-w-[680px] text-center">
        <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--accent-green)] uppercase">
          Proof Of Delivery
        </span>
        <h2 className="mt-3 mb-3.5 font-display text-[clamp(28px,4vw,42px)] font-extrabold tracking-[-0.01em]">
          Show us you delivered.
        </h2>
        <p className="m-0 text-base leading-[1.65] text-muted">
          Finished a delivery? Sign in and upload a photo and receipt below.
          Once I verify it, your meals get added to the running total.
        </p>
      </div>

      {user ? (
        status === "done" ? (
          <div className="mx-auto mb-15 max-w-[640px] rounded-3xl border border-border bg-card p-9 text-center">
            <p className="m-0 text-lg font-bold text-[var(--accent-green)]">
              Thanks — submitted for review!
            </p>
            <p className="mt-2 mb-0 text-sm text-muted">
              Your meal count updates once it&apos;s approved.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mx-auto mb-15 flex max-w-[640px] flex-col gap-4 rounded-3xl border border-border bg-card p-[clamp(24px,3vw,36px)]"
          >
            <div className="flex items-center justify-between gap-2.5 rounded-[10px] bg-green-soft px-3.5 py-2.5">
              <span className="text-sm font-bold text-[var(--accent-green)]">
                Submitting as {user.name}
              </span>
            </div>
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
            <div className="flex flex-col gap-2 text-[13px] font-bold">
              How was it delivered? (optional)
              <label className="flex items-center gap-2 text-[15px] font-medium">
                <input type="radio" name="delivery_role" value="self" /> I
                delivered it myself
              </label>
              <label className="flex items-center gap-2 text-[15px] font-medium">
                <input
                  type="radio"
                  name="delivery_role"
                  value="volunteer_needed"
                />{" "}
                A volunteer delivered it for me
              </label>
            </div>
            <label className={labelClass}>
              Delivered through a partner charity? (optional)
              <select name="partner_charity" className={fieldClass}>
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
        )
      ) : (
        <div className="mx-auto mb-15 max-w-[520px] rounded-3xl border border-dashed border-border-strong bg-card p-[clamp(32px,4vw,44px)] text-center">
          <p className="m-0 mb-4.5 text-base leading-[1.6] text-muted">
            Sign in to submit proof of your delivery. Signing in confirms who
            you are without asking you to fill out yet another form.
          </p>
          <button
            type="button"
            onClick={onOpenSignIn}
            className="cursor-pointer rounded-full border-none bg-[var(--accent-green)] px-6.5 py-3.5 text-[15px] font-bold text-ink-fg"
          >
            Sign In
          </button>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4.5">
        {slots.map((shot, i) =>
          shot ? (
            <div
              key={shot.id}
              className="aspect-[4/3] overflow-hidden rounded-2xl border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.photoUrl}
                alt={shot.caption ?? "Delivery photo"}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div
              key={`placeholder-${i}`}
              className="placeholder-photo flex aspect-[4/3] items-center justify-center rounded-2xl border border-border p-3.5 text-center"
            >
              <span className="font-mono text-xs leading-[1.6] text-muted-3">
                delivery photo
                <br />
                awaiting submission
              </span>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
