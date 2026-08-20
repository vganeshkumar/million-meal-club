import type { PartnerCharity } from "@/lib/types";
import { ScrollRow } from "@/components/ScrollRow";

type CharityPartnersSectionProps = {
  charities: PartnerCharity[];
  onSeeAll: () => void;
  onSelectCharity: (id: string) => void;
};

export function CharityPartnersSection({
  charities,
  onSeeAll,
  onSelectCharity,
}: CharityPartnersSectionProps) {
  if (charities.length === 0) return null;

  return (
    <section className="px-[clamp(20px,5vw,56px)] py-[clamp(56px,8vw,100px)]">
      <div className="mx-auto max-w-[1160px]">
        <div className="mx-auto mb-11 max-w-[640px] text-center">
          <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--accent-green)] uppercase">
            Charity Partners
          </span>
          <h2 className="mt-3 mb-3.5 font-display text-[clamp(28px,4vw,42px)] font-extrabold tracking-[-0.01em]">
            Vetted partners you can give through directly.
          </h2>
          <p className="m-0 text-base leading-[1.65] text-muted">
            Prefer to donate money instead of picking a location yourself?
            Give directly to one of these vetted charities.
          </p>
        </div>
        <ScrollRow>
          {charities.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCharity(c.id)}
              className="flex w-[280px] cursor-pointer flex-col gap-2.5 rounded-[20px] border border-border bg-card p-7 text-left transition-transform hover:-translate-y-0.5 hover:shadow-[0_12px_28px_oklch(21%_0.03_155_/_0.1)]"
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
            </button>
          ))}
        </ScrollRow>
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={onSeeAll}
            className="inline-block cursor-pointer rounded-full border border-border-strong bg-transparent px-[30px] py-4 text-base font-bold text-ink"
          >
            See All Partner Charities
          </button>
        </div>
      </div>
    </section>
  );
}
