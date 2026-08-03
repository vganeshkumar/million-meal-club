"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Donor } from "@/lib/types";

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
