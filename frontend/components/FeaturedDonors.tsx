import type { Donor } from "@/lib/types";
import { ScrollRow } from "@/components/ScrollRow";

type FeaturedDonorsProps = {
  donors: Donor[];
  onSelectDonor: (id: string) => void;
};

export function FeaturedDonors({ donors, onSelectDonor }: FeaturedDonorsProps) {
  return (
    <section
      id="donors"
      className="bg-bg-alt px-[clamp(20px,5vw,56px)] py-[clamp(56px,8vw,100px)]"
    >
      <div className="mx-auto max-w-[1160px]">
        <div className="mx-auto mb-11 max-w-[640px] text-center">
          <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--accent-green)] uppercase">
            Featured Donors
          </span>
          <h2 className="mt-3 mb-3.5 font-display text-[clamp(28px,4vw,42px)] font-extrabold tracking-[-0.01em]">
            The people getting us there.
          </h2>
          <p className="m-0 text-base leading-[1.65] text-muted">
            Our donors join by invitation only, each committing to at least
            10,000 meals over 5 years. Ranked by meals delivered — read
            their stories and see what&apos;s driving them.
          </p>
        </div>
        <ScrollRow>
          {donors.map((donor, i) => {
            const isTop = i === 0;
            const accent = isTop ? "var(--accent-amber)" : "var(--accent-green)";
            return (
              <button
                key={donor.id}
                type="button"
                onClick={() => onSelectDonor(donor.id)}
                style={{ borderColor: isTop ? "var(--accent-amber)" : undefined }}
                className="flex w-[280px] cursor-pointer flex-col gap-4.5 rounded-[20px] border-2 border-border bg-card p-7 text-left transition-transform hover:-translate-y-0.5 hover:shadow-[0_12px_28px_oklch(21%_0.03_155_/_0.1)]"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    style={{ backgroundColor: accent }}
                    className="flex h-13 w-13 flex-shrink-0 items-center justify-center rounded-full font-display text-xl font-extrabold text-ink-fg"
                  >
                    {donor.name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="m-0 text-base font-bold">{donor.name}</p>
                    <p className="mt-0.5 mb-0 text-[13px] text-muted-2">
                      {donor.location}
                    </p>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <span
                    style={{ color: "var(--accent-green)" }}
                    className="font-display text-[34px] font-extrabold"
                  >
                    {donor.totalMeals.toLocaleString()}
                  </span>
                  <span className="text-[12.5px] font-bold tracking-[0.04em] text-muted-2 uppercase">
                    meals delivered
                  </span>
                </div>
              </button>
            );
          })}
        </ScrollRow>
      </div>
    </section>
  );
}
