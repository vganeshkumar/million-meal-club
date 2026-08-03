type HeroProps = {
  charityName: string;
  founderName: string;
};

export function Hero({ charityName, founderName }: HeroProps) {
  return (
    <section
      id="top"
      className="relative mx-auto max-w-[1160px] px-[clamp(20px,5vw,56px)] pt-[clamp(56px,9vw,120px)] pb-[clamp(64px,8vw,96px)] text-center"
    >
      <div className="pointer-events-none absolute top-[10%] left-[2%] z-0 h-[220px] w-[220px] rounded-full bg-[var(--accent-amber)] opacity-[0.13] blur-[6px]" />
      <div className="pointer-events-none absolute right-[4%] bottom-0 z-0 h-[280px] w-[280px] rounded-full bg-[var(--accent-green)] opacity-10 blur-[6px]" />

      <div className="relative z-10">
        <span className="mb-[22px] inline-block rounded-full bg-green-soft px-4 py-[7px] text-[13px] font-bold tracking-[0.08em] text-[var(--accent-green)] uppercase">
          A volunteer movement, one life at a time
        </span>
        <h1 className="mx-0 mt-0 mb-[22px] font-display text-[clamp(38px,6.5vw,84px)] leading-[1.02] font-extrabold tracking-[-0.02em]">
          No One Should Starve
          <br />
          For A Meal.
        </h1>
        <p className="mx-auto mb-8 max-w-[640px] text-[clamp(16px,1.6vw,19px)] leading-[1.65] text-muted">
          A mother once walked to a camp for food her family needed to
          survive — and was shot along the way. Her children never saw her
          again. War isn&apos;t the only cause: every day, quietly, families
          everywhere exhaust themselves just to put one more meal on the
          table. In this day and age, no one should starve for a meal.
        </p>
        <p className="mx-auto mb-9 max-w-[640px] text-[clamp(16px,1.6vw,19px)] leading-[1.65] text-muted">
          {charityName} exists to give people that chance. Our mission is
          simple: reach as many people as we can and help each one move
          toward a better life. We&apos;re starting with meals — funded,
          packed, and hand-delivered entirely by volunteers, with no money
          changing hands — but meals are just the beginning. The real goal
          is the opportunity itself, the one so many never get. I&apos;m
          trying to fix that, alongside people who see it the same way. —{" "}
          {founderName}
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="#participate"
            className="rounded-full bg-[var(--accent-green)] px-[30px] py-4 text-base font-bold text-ink-fg no-underline"
          >
            Join In
          </a>
          <a
            href="#progress"
            className="rounded-full border-2 border-border-strong bg-transparent px-7 py-[14px] text-base font-bold text-ink no-underline"
          >
            See Our Progress
          </a>
        </div>
      </div>
    </section>
  );
}
