// Public per-kind breakdown of the running total — see
// specs/features/034-donation-kinds-and-quantity/design.md. Only kinds
// with at least one approved donation appear (kindTotals simply omits
// the rest), sorted descending by quantity.

type DonationKindBreakdownProps = {
  kindTotals: Record<string, number>;
};

export function DonationKindBreakdown({
  kindTotals,
}: DonationKindBreakdownProps) {
  const entries = Object.entries(kindTotals).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  return (
    <section className="bg-bg-alt px-[clamp(20px,5vw,56px)] py-[clamp(40px,6vw,64px)]">
      <div className="mx-auto max-w-[1160px]">
        <div className="mx-auto mb-8 max-w-[640px] text-center">
          <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--accent-green)] uppercase">
            Impact By Kind
          </span>
          <h2 className="mt-3 mb-0 font-display text-[clamp(22px,3vw,30px)] font-extrabold tracking-[-0.01em]">
            Every kind of help counts toward the same total.
          </h2>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {entries.map(([kind, quantity]) => (
            <div
              key={kind}
              className="min-w-[160px] rounded-2xl border border-border bg-card px-6 py-5 text-center"
            >
              <p
                style={{ color: "var(--accent-green)" }}
                className="m-0 font-display text-3xl font-extrabold"
              >
                {quantity.toLocaleString()}
              </p>
              <p className="m-0 mt-1 text-[13px] font-bold tracking-[0.03em] text-muted-2 uppercase">
                {kind}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
