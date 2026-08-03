type FooterProps = {
  charityName: string;
  founderName: string;
};

export function Footer({ charityName, founderName }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink px-[clamp(20px,5vw,56px)] pt-[clamp(48px,6vw,72px)] pb-9 text-ink-muted">
      <div className="mx-auto grid max-w-[1160px] grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-10 border-b border-ink-border pb-9">
        <div>
          <div className="mb-3.5 flex items-center gap-2.5">
            <span className="inline-block h-3 w-3 rounded-full bg-[var(--accent-amber)]" />
            <span className="font-display text-lg font-bold text-ink-fg">
              {charityName}
            </span>
          </div>
          <p className="m-0 max-w-[360px] text-[14.5px] leading-[1.7]">
            Thank you for being part of this. Every packet gets us one step
            closer to a million lives changed. — {founderName}, Founder
          </p>
        </div>
        <div>
          <p className="mb-3.5 text-[13px] font-bold tracking-[0.06em] text-ink-muted uppercase">
            Follow Our Progress
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#"
              className="rounded-full bg-ink-chip px-[18px] py-2.5 text-[14.5px] font-bold text-ink-fg no-underline"
            >
              Facebook — @millionmealclub
            </a>
            <a
              href="#"
              className="rounded-full bg-ink-chip px-[18px] py-2.5 text-[14.5px] font-bold text-ink-fg no-underline"
            >
              Instagram — @millionmealclub
            </a>
          </div>
        </div>
        <div>
          <p className="mb-3.5 text-[13px] font-bold tracking-[0.06em] text-ink-muted uppercase">
            Get In Touch
          </p>
          <a
            href="mailto:hello@millionmealclub.org"
            className="text-[14.5px] text-ink-muted underline"
          >
            hello@millionmealclub.org
          </a>
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-[1160px] text-[13px] text-ink-muted">
        © {year} {charityName}. Fully volunteer-run. No donations of money
        are collected.
      </p>
    </footer>
  );
}
