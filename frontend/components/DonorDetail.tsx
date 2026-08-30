import type { Donor } from "@/lib/types";

type DonorDetailProps = {
  donor: Donor | null;
  loading: boolean;
};

export function DonorDetail({ donor, loading }: DonorDetailProps) {
  if (loading || !donor) {
    return (
      <div className="mx-auto max-w-[900px] px-[clamp(20px,5vw,56px)] pt-[clamp(40px,6vw,72px)] pb-[100px] text-center text-muted">
        {loading ? "Loading donor…" : "Donor not found."}
      </div>
    );
  }

  const initial = donor.name.trim().charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-[900px] px-[clamp(20px,5vw,56px)] pt-[clamp(40px,6vw,72px)] pb-[100px]">
      <div className="mb-8 flex flex-wrap items-center gap-5">
        <div
          style={{ backgroundColor: "var(--accent-green)" }}
          className="flex h-21 w-21 flex-shrink-0 items-center justify-center rounded-full font-display text-[32px] font-extrabold text-ink-fg"
        >
          {initial}
        </div>
        <div>
          <h1 className="m-0 mb-1.5 font-display text-[clamp(28px,4vw,40px)] font-extrabold tracking-[-0.01em]">
            {donor.name}
          </h1>
          <p className="m-0 text-[15px] text-muted-2">{donor.location}</p>
        </div>
      </div>

      <div className="mb-10 flex flex-wrap gap-10 rounded-[20px] bg-bg-alt px-7 py-6">
        <div>
          <div
            style={{ color: "var(--accent-green)" }}
            className="font-display text-4xl font-extrabold"
          >
            {donor.totalMeals.toLocaleString()}
          </div>
          <div className="text-[12.5px] font-bold tracking-[0.04em] text-muted-2 uppercase">
            meals delivered
          </div>
        </div>
        <div>
          <div
            style={{ color: "var(--accent-green)" }}
            className="font-display text-4xl font-extrabold"
          >
            {donor.donationCount}
          </div>
          <div className="text-[12.5px] font-bold tracking-[0.04em] text-muted-2 uppercase">
            donations made
          </div>
        </div>
        <div>
          {/* Every donor commits to the same amount — this is static copy,
              not a per-donor value, matching the design's literal
              "10,000 / 5 yrs" (no interpolation). */}
          <div
            style={{ color: "var(--accent-green)" }}
            className="font-display text-4xl font-extrabold"
          >
            10,000 / 5 yrs
          </div>
          <div className="text-[12.5px] font-bold tracking-[0.04em] text-muted-2 uppercase">
            committed meals
          </div>
        </div>
      </div>

      <div className="mb-11">
        <h2 className="mt-0 mb-3 font-display text-xl font-bold">
          Why I&apos;m doing this
        </h2>
        <p className="m-0 font-mono text-sm leading-[1.7] text-muted-2">
          {donor.story || "+ add why this donor is doing this, in their own words"}
        </p>
      </div>

      <div>
        <h2 className="mt-0 mb-5 font-display text-xl font-bold">
          Their Deliveries
        </h2>
        <div className="flex flex-col gap-6">
          {(donor.donations ?? []).map((d) => (
            <div
              key={d.id}
              className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-center gap-6 rounded-[20px] border border-border bg-card p-6"
            >
              <div className="flex aspect-[4/3] items-center justify-center rounded-[14px] overflow-hidden border border-border">
                {d.coverPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.coverPhotoUrl}
                    alt={d.caption}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="placeholder-photo flex h-full w-full items-center justify-center font-mono text-xs text-muted-3">
                    delivery photo
                  </span>
                )}
              </div>
              <div>
                <p className="m-0 mb-1.5 text-[13px] font-bold tracking-[0.04em] text-muted-2 uppercase">
                  {d.date} · {d.location}
                </p>
                <p
                  style={{ color: "var(--accent-green)" }}
                  className="m-0 mb-2.5 font-display text-2xl font-extrabold"
                >
                  {d.meals.toLocaleString()} meals
                </p>
                <p className="m-0 text-sm leading-[1.6] text-muted">
                  {d.caption}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
