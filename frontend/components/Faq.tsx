"use client";

import { useState } from "react";

// Static, finalized copy — same treatment as HowItWorks.tsx. Per the
// authoritative design (design_artifacts/Million Meal Club.dc.html
// faqsData), FAQ copy is already final and isn't part of the
// admin-editable data set (donors/events/partner charities/milestones)
// that needs a real backing store — see specs/01-architecture.md, whose
// table list never included a Faqs table.
const FAQS = [
  {
    q: "Do you accept money donations?",
    a: "No. This project does not collect or handle money. You buy the food packets yourself and either deliver them or arrange for a volunteer to do it. 100% volunteer-run, 100% of the time.",
  },
  {
    q: "How do you verify the meal count?",
    a: "After your delivery, upload a photo of the packets or a purchase receipt. Once it's personally reviewed and confirmed, the total on this page goes up.",
  },
  {
    q: "Can I volunteer even if I can't buy packets myself?",
    a: "Yes — sign up and note that you're available to collect and deliver for someone else. We'll match you with a nearby donor who needs a hand.",
  },
  {
    q: "What counts as a 'meal packet'?",
    a: "Any packed, ready-to-eat meal or food parcel meant for one person. Consistency matters more than the exact format.",
  },
  {
    q: "How are delivery locations chosen?",
    a: "You choose. Tell us your neighborhood or city when you sign up, and we'll help connect you with people there who need it.",
  },
  {
    q: "How do I become a donor?",
    a: "Donor spots are by invitation only. Submit a donor application — including your story and a commitment to deliver at least 10,000 meals within 5 years — and I'll personally follow up if it's a fit. Every donor agrees to have their story published here to inspire the next one.",
  },
  {
    q: "What if I don't know which location to support?",
    a: "You can donate through one of our vetted partner charities instead of picking a location yourself. Your money goes directly to that charity, and you still submit a receipt plus photos from their food distribution event as proof — it counts toward your total the same way.",
  },
  {
    q: "Is there a tax refund for my donation?",
    a: "Not through us directly — we intentionally chose not to start a formal nonprofit organization, as it would be a distraction, and for that reason we don't transact or collect any money from our donors. If you'd prefer a tax-deductible option, you can give through one of our partner charities instead; if they provide a tax receipt, you're welcome to use it. We're looking for donors who truly want to help regardless of whether there's a tax benefit.",
  },
  {
    q: "Are you a registered nonprofit organization?",
    a: "No, and that's intentional — we intentionally chose not to start a formal organization, as it would be a distraction, and for that reason we don't transact or collect any money from our donors. We partner with established charities for those who prefer that route, and their tax receipts are yours to use if provided. We're looking for donors who truly want to help regardless of whether there's a tax benefit.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });

  return (
    <section
      id="faq"
      className="mx-auto max-w-[820px] px-[clamp(20px,5vw,56px)] py-[clamp(56px,8vw,100px)]"
    >
      <div className="mb-11 text-center">
        <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--accent-green)] uppercase">
          Questions
        </span>
        <h2 className="mt-3 mb-0 font-display text-[clamp(28px,4vw,42px)] font-extrabold tracking-[-0.01em]">
          Frequently asked.
        </h2>
      </div>
      <div className="flex flex-col gap-3">
        {FAQS.map((f, i) => (
          <div
            key={f.q}
            className="rounded-2xl border border-border bg-card px-6"
          >
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, [i]: !s[i] }))}
              className="flex w-full cursor-pointer items-center justify-between gap-4 border-none bg-transparent py-[18px] text-left"
            >
              <span className="text-base font-bold text-ink">{f.q}</span>
              <span className="flex-shrink-0 text-[22px] font-normal text-[var(--accent-green)]">
                {open[i] ? "−" : "+"}
              </span>
            </button>
            {open[i] && (
              <p className="m-0 mb-5 text-[15px] leading-[1.7] text-muted">
                {f.a}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
