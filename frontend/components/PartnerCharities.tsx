"use client";

import { useEffect } from "react";
import type { PartnerCharity } from "@/lib/types";

type PartnerCharitiesProps = {
  charities: PartnerCharity[];
  onApplyAsDonor: () => void;
  // Set when arriving from the homepage summary section's "Brief
  // Summary" cards — scrolls to and highlights the matching card here.
  highlightedId?: string | null;
};

export function PartnerCharities({
  charities,
  onApplyAsDonor,
  highlightedId,
}: PartnerCharitiesProps) {
  useEffect(() => {
    if (!highlightedId) return;
    document
      .getElementById(`charity-${highlightedId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedId]);

  return (
    <div className="mx-auto max-w-[1000px] px-[clamp(20px,5vw,56px)] pt-[clamp(40px,6vw,72px)] pb-[100px]">
      <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--accent-green)] uppercase">
        Partner Charities
      </span>
      <h1 className="mt-3 mb-4.5 font-display text-[clamp(28px,4vw,42px)] font-extrabold tracking-[-0.01em]">
        Not sure which location to support?
      </h1>
      <p className="m-0 mb-10 max-w-[640px] text-base leading-[1.7] text-muted">
        Donate money directly to one of these vetted partner charities
        instead of picking a location yourself. Your money goes straight to
        them — you still submit a receipt plus photos from their food
        distribution event, and it counts toward your total the same way.
      </p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
        {charities.map((c) => (
          <div
            key={c.id}
            id={`charity-${c.id}`}
            className={`flex flex-col gap-2.5 rounded-[20px] border bg-card p-7 transition-colors ${
              c.id === highlightedId
                ? "border-2 border-[var(--accent-green)]"
                : "border-border"
            }`}
          >
            <h3 className="m-0 font-display text-[19px] font-bold">
              {c.name}
            </h3>
            <p className="m-0 text-[13px] font-bold text-muted-2">
              {c.location}
              {c.yearsActive ? ` · ${c.yearsActive}` : ""}
            </p>
            <p className="m-0 text-[14.5px] leading-[1.6] text-muted">
              {c.description}
            </p>
            {c.coreServices && (
              <div>
                <p className="m-0 text-[11px] font-bold tracking-[0.06em] text-[var(--accent-green)] uppercase">
                  Core Services
                </p>
                {/* One line entered in the admin form = one bullet — a
                    plain <p> collapses the admin's newlines into a single
                    run-on paragraph, which is what this list fixes. */}
                <ul className="m-0 list-disc pl-[18px] text-[14.5px] leading-[1.6] font-bold text-[var(--accent-green)]">
                  {c.coreServices
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              </div>
            )}
            {c.founderDetails && (
              <div>
                <p className="m-0 text-[11px] font-bold tracking-[0.06em] text-muted-2 uppercase">
                  Founder
                </p>
                <p className="m-0 text-[14.5px] leading-[1.6] text-muted italic">
                  {c.founderDetails}
                </p>
              </div>
            )}
            {c.awardsCredentials && (
              <p className="m-0 text-[13.5px] leading-[1.6] text-muted-2 italic">
                {c.awardsCredentials}
              </p>
            )}
            {(c.websiteUrl || c.donationUrl) && (
              <div className="mt-1 flex gap-4 text-[13px] font-bold">
                {c.websiteUrl && (
                  <a
                    href={c.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--accent-green)]"
                  >
                    Visit Website
                  </a>
                )}
                {c.donationUrl && (
                  <a
                    href={c.donationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--accent-green)]"
                  >
                    Donate
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onApplyAsDonor}
        className="mt-10 inline-block cursor-pointer rounded-full border-none bg-[var(--accent-green)] px-[30px] py-4 text-base font-bold text-ink-fg no-underline"
      >
        Apply As A Donor
      </button>
    </div>
  );
}
