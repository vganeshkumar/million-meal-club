// Renders an attractive, on-brand, downloadable/shareable image for a
// scheduled donation event — client-side canvas, no external image fetch
// (a fetched map thumbnail would taint the canvas without permissive CORS
// headers from the free static-map host). See
// specs/features/023-event-location-time-and-sharing/design.md.

import type { DonationEvent } from "./types";
import { formatTimeRange } from "./staticMap";

const SIZE = 1080;
const FALLBACK_GREEN = "#1f5f3a";
const FALLBACK_AMBER = "#d97b29";
const INK = "#122a1c";
const PAPER = "#f3f1ea";
const PAPER_MUTED = "#d8e3da";
const PAPER_FAINT = "#b7c6bb";

export type ShareCardTheme = {
  accentGreen: string;
  accentAmber: string;
};

export async function generateEventShareImage(
  event: DonationEvent,
  theme: ShareCardTheme,
): Promise<Blob> {
  if (typeof document.fonts?.ready?.then === "function") {
    await document.fonts.ready;
  }

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.textBaseline = "top";

  const pad = 80;
  const green = theme.accentGreen || FALLBACK_GREEN;
  const amber = theme.accentAmber || FALLBACK_AMBER;

  const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  gradient.addColorStop(0, INK);
  gradient.addColorStop(1, green);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.fillStyle = PAPER;
  ctx.font = "700 32px 'Karla', sans-serif";
  ctx.fillText("THE MILLION MEAL CLUB", pad, pad);

  drawPin(ctx, pad + 22, pad + 96, 22, amber);

  const timeRange = formatTimeRange(event.startTime, event.endTime);
  ctx.fillStyle = amber;
  ctx.font = "700 30px 'Karla', sans-serif";
  ctx.fillText(
    timeRange ? `${event.date} · ${timeRange}` : event.date,
    pad + 60,
    pad + 105,
  );

  ctx.fillStyle = PAPER;
  ctx.font = "800 54px 'Bricolage Grotesque', sans-serif";
  let y = pad + 210;
  y = wrapText(ctx, event.location, pad, y, SIZE - pad * 2, 62);

  if (event.notes) {
    const excerpt =
      event.notes.length > 160 ? `${event.notes.slice(0, 157)}…` : event.notes;
    ctx.fillStyle = PAPER_MUTED;
    ctx.font = "italic 400 28px 'Karla', sans-serif";
    y += 26;
    wrapText(ctx, excerpt, pad, y, SIZE - pad * 2, 38);
  }

  const partnerLine = event.partnerCharity
    ? `Delivered via ${event.partnerCharity}`
    : event.volunteerName
      ? `Volunteer: ${event.volunteerName}`
      : null;
  if (partnerLine) {
    ctx.fillStyle = PAPER;
    ctx.font = "700 28px 'Karla', sans-serif";
    ctx.fillText(partnerLine, pad, SIZE - pad - 76);
  }

  const footerLine = event.packetCount
    ? `${event.packetCount.toLocaleString()} food packets · A donation from ${event.donorName}`
    : `A donation from ${event.donorName}`;
  ctx.fillStyle = PAPER_FAINT;
  ctx.font = "500 24px 'Karla', sans-serif";
  ctx.fillText(footerLine, pad, SIZE - pad - 36);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Couldn't generate the share image."));
    }, "image/png");
  });
}

function drawPin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.6, cy + r * 0.5);
  ctx.lineTo(cx + r * 0.6, cy + r * 0.5);
  ctx.lineTo(cx, cy + r * 1.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(/\s+/);
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineHeight;
}
