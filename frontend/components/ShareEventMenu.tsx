"use client";

import { useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import { generateEventShareImage } from "@/lib/shareCard";
import type { DonationEvent } from "@/lib/types";

// See specs/features/023-event-location-time-and-sharing/design.md —
// "easy to share" means both a downloadable/native-share-sheet branded
// image (works for Instagram, which has no link-paste concept) and a
// link that unfurls a rich preview on X/Facebook/WhatsApp.
export function ShareEventMenu({ event }: { event: DonationEvent }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const shareUrl = new URL(
    `${API_BASE}/donation-events/${event.id}/share`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost",
  ).toString();

  const shareText = `Help ${event.donorName} deliver meals on ${event.date} — join The Million Meal Club.`;

  function theme() {
    const styles = containerRef.current
      ? getComputedStyle(containerRef.current)
      : null;
    return {
      accentGreen: styles?.getPropertyValue("--accent-green").trim() || "",
      accentAmber: styles?.getPropertyValue("--accent-amber").trim() || "",
    };
  }

  async function generateImage(): Promise<Blob> {
    return generateEventShareImage(event, theme());
  }

  async function handleShareOrDownload() {
    setError("");
    setBusy(true);
    try {
      const blob = await generateImage();
      const file = new File([blob], "million-meal-club-event.png", {
        type: "image/png",
      });
      const canShareFiles =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });
      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title: "The Million Meal Club",
          text: shareText,
          url: shareUrl,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "million-meal-club-event.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled the native share sheet — not an error.
      } else {
        setError("Couldn't create the share image. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLink() {
    setError("");
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy the link. Please try again.");
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer rounded-full border border-border-strong bg-transparent px-4 py-2 text-xs font-bold text-ink"
      >
        Share
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
          />
          <div className="absolute top-full right-0 z-50 mt-2 flex w-64 flex-col gap-2 rounded-2xl border border-border bg-card p-4 shadow-[0_12px_28px_oklch(21%_0.03_155_/_0.18)]">
            <button
              type="button"
              disabled={busy}
              onClick={handleShareOrDownload}
              className="cursor-pointer rounded-full border-none bg-[var(--accent-green)] px-4 py-2.5 text-sm font-bold text-ink-fg disabled:opacity-60"
            >
              {busy ? "Preparing…" : "Share / Download Image"}
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="cursor-pointer rounded-full border border-border-strong bg-transparent px-4 py-2 text-sm font-bold text-ink"
            >
              {copied ? "Link copied!" : "Copy Link"}
            </button>
            <div className="mt-1 flex justify-center gap-3 text-[13px] font-bold text-muted-2">
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                X
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Facebook
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
            </div>
            {error && <p className="m-0 text-xs text-red-700">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
