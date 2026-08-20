"use client";

import { useEffect, useRef, useState } from "react";

type ScrollRowProps = {
  children: React.ReactNode;
};

// Generic horizontal-scroll wrapper — caller's children set their own
// width (e.g. `min-w-[280px]`); this just stops them wrapping/shrinking
// and adds click-to-scroll arrows on top of native scroll/swipe. See
// specs/features/029-homepage-scrollable-top5/design.md.
export function ScrollRow({ children }: ScrollRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function updateArrows() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }

    updateArrows();
    el.addEventListener("scroll", updateArrows);
    // Catches content resizing after mount (e.g. images loading in,
    // async data changing the number of cards) without a `children`
    // effect dependency, which wouldn't reliably fire on count changes.
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      observer.disconnect();
    };
  }, []);

  function scrollByAmount(direction: 1 | -1) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="relative">
      {canScrollLeft && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollByAmount(-1)}
          className="absolute top-1/2 left-0 z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-card text-lg shadow-[0_4px_14px_oklch(21%_0.03_155_/_0.18)]"
        >
          ‹
        </button>
      )}
      <div
        ref={ref}
        className="flex snap-x snap-proximity gap-6 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:flex-shrink-0 [&>*]:snap-start"
      >
        {children}
      </div>
      {canScrollRight && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollByAmount(1)}
          className="absolute top-1/2 right-0 z-10 flex h-11 w-11 translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-border-strong bg-card text-lg shadow-[0_4px_14px_oklch(21%_0.03_155_/_0.18)]"
        >
          ›
        </button>
      )}
    </div>
  );
}
