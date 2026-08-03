const STEPS = [
  {
    n: "01",
    title: "Pick Your Location & Packet Count",
    body: "Tell us which neighborhood you'd like to feed and how many food packets you want to fund.",
  },
  {
    n: "02",
    title: "Choose Your Role",
    body: "Deliver the meals yourself, request a volunteer to deliver on your behalf, or give through one of our partner charities instead.",
  },
  {
    n: "03",
    title: "We Connect The Dots",
    body: "Our local volunteer network coordinates pickup, packing, and delivery — entirely unpaid, entirely by hand.",
  },
  {
    n: "04",
    title: "Share The Proof",
    body: "Once delivered, upload a photo. We verify it and add it to the running total on this page.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="mx-auto max-w-[1160px] px-[clamp(20px,5vw,56px)] py-[clamp(56px,8vw,100px)]"
    >
      <div className="mx-auto mb-13 max-w-[640px] text-center">
        <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--accent-green)] uppercase">
          How It Works
        </span>
        <h2 className="mt-3 mb-0 font-display text-[clamp(28px,4vw,42px)] font-extrabold tracking-[-0.01em]">
          Four steps. Zero dollars.
        </h2>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-7">
        {STEPS.map((step) => (
          <div
            key={step.n}
            className="rounded-[20px] border border-border bg-card px-[26px] py-[30px]"
          >
            <div className="mb-3.5 font-display text-[32px] font-extrabold text-[var(--accent-green)]">
              {step.n}
            </div>
            <h3 className="mt-0 mb-2.5 font-display text-[19px] font-bold">
              {step.title}
            </h3>
            <p className="m-0 text-[15px] leading-[1.6] text-muted">
              {step.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
