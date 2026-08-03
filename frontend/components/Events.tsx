import type { EventItem } from "@/lib/types";

type EventsProps = {
  events: EventItem[];
};

export function Events({ events }: EventsProps) {
  return (
    <section
      id="events"
      className="bg-bg-alt px-[clamp(20px,5vw,56px)] py-[clamp(56px,8vw,100px)]"
    >
      <div className="mx-auto max-w-[1160px]">
        <div className="mx-auto mb-11 max-w-[640px] text-center">
          <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--accent-green)] uppercase">
            Upcoming Events
          </span>
          <h2 className="mt-3 mb-3.5 font-display text-[clamp(28px,4vw,42px)] font-extrabold tracking-[-0.01em]">
            Join an upcoming drive.
          </h2>
          <p className="m-0 text-base leading-[1.65] text-muted">
            Real dates, real neighborhoods — come deliver meals with us in
            person.
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex flex-col gap-3.5 rounded-[20px] border border-border bg-card p-7"
            >
              <div className="inline-flex self-start rounded-full bg-green-soft px-3.5 py-1.5 text-[13px] font-bold text-[var(--accent-green)]">
                {ev.date} · {ev.time}
              </div>
              <p className="m-0 text-sm font-bold text-muted-2">
                {ev.location}
              </p>
              <p className="m-0 flex-grow text-[15px] leading-[1.6] text-muted">
                {ev.description}
              </p>
              <p className="m-0 text-[13px] font-bold tracking-[0.03em] text-muted-2 uppercase">
                Packet goal: {ev.packetsGoal.toLocaleString()}
              </p>
              <a
                href="#participate"
                className="mt-1.5 rounded-full bg-[var(--accent-green)] px-5 py-3 text-center text-[14.5px] font-bold text-ink-fg no-underline"
              >
                I&apos;ll Join This One
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
