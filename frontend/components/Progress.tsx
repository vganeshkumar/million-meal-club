"use client";

import { useEffect, useRef, useState } from "react";

type ProgressProps = {
  totalMeals: number;
  milestone2027: number;
  goal2030: number;
};

function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

export function Progress({
  totalMeals,
  milestone2027,
  goal2030,
}: ProgressProps) {
  const [count, setCount] = useState(0);
  const countedRef = useRef(false);
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const animate = () => {
      if (countedRef.current) return;
      countedRef.current = true;
      const duration = 1500;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        setCount(Math.round(easeOutCubic(p) * totalMeals));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    let observer: IntersectionObserver | null = null;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) animate();
        },
        { threshold: 0.3 },
      );
      if (sectionRef.current) observer.observe(sectionRef.current);
    } catch {
      // IntersectionObserver unavailable — fallback timer below covers it.
    }
    const fallback = setTimeout(animate, 900);

    return () => {
      observer?.disconnect();
      clearTimeout(fallback);
    };
  }, [totalMeals]);

  const progressPct = Math.max(
    2,
    Math.min(100, Math.round((count / milestone2027) * 100)),
  );

  return (
    <section
      id="progress"
      ref={sectionRef}
      className="bg-ink px-[clamp(20px,5vw,56px)] py-[clamp(56px,8vw,100px)] text-ink-fg"
    >
      <div className="mx-auto max-w-[1000px] text-center">
        <span className="text-[13px] font-bold tracking-[0.08em] text-ink-muted uppercase">
          Every Meal Counts
        </span>
        <div className="my-3.5 font-display text-[clamp(56px,11vw,140px)] leading-none font-extrabold tracking-[-0.02em] text-[var(--accent-amber)]">
          {count.toLocaleString()}
        </div>
        <p className="mb-10 text-lg text-ink-muted">
          meals delivered so far — verified by photo proof from our
          volunteers, on the way to touching a million lives
        </p>

        <div className="mx-auto max-w-[640px]">
          <div className="mb-2.5 flex justify-between text-sm font-bold text-ink-muted">
            <span>{count.toLocaleString()} delivered</span>
            <span>Goal: {milestone2027.toLocaleString()} by end of 2027</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-ink-border">
            <div
              className="h-full rounded-full bg-[var(--accent-amber)] transition-[width] duration-[1.6s] ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-5 text-[15px] text-ink-muted">
            And beyond that — our lifetime goal is{" "}
            <strong className="text-ink-fg">
              {goal2030.toLocaleString()} meals by 2030
            </strong>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
