"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import type { AuthUser, ContentResponse, Donor } from "@/lib/types";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Progress } from "@/components/Progress";
import { Events } from "@/components/Events";
import { HowItWorks } from "@/components/HowItWorks";
import { JoinInForm } from "@/components/JoinInForm";
import { Gallery } from "@/components/Gallery";
import { FeaturedDonors } from "@/components/FeaturedDonors";
import { DonorDetail } from "@/components/DonorDetail";
import { PartnerCharities } from "@/components/PartnerCharities";
import { AdminSignoff } from "@/components/AdminSignoff";
import { DonorDashboard } from "@/components/DonorDashboard";
import { VolunteerDashboard } from "@/components/VolunteerDashboard";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";
import { SignInModal } from "@/components/SignInModal";

const DEFAULT_ACCENT: [string, string] = [
  "oklch(38% 0.1 155)",
  "oklch(68% 0.15 55)",
];

// The donor detail "route" is derived from window.location.hash via
// useSyncExternalStore rather than mirrored into component state — this is
// the idiomatic way to read a browser API that changes outside React's
// render cycle (avoids the setState-in-effect anti-pattern) and keeps
// direct links / back-forward navigation working for free.
function subscribeToHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function getHashSnapshot() {
  return window.location.hash;
}
function getServerHashSnapshot() {
  return "";
}

export default function Home() {
  const [content, setContent] = useState<ContentResponse | null>(null);
  const [contentError, setContentError] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeDonor, setActiveDonor] = useState<Donor | null>(null);
  const [donorFetchErrorId, setDonorFetchErrorId] = useState<string | null>(
    null,
  );
  const [showAuthModal, setShowAuthModal] = useState(false);

  const hash = useSyncExternalStore(
    subscribeToHash,
    getHashSnapshot,
    getServerHashSnapshot,
  );
  const donorMatch = /^#donor-(.+)$/.exec(hash);
  const donorId = donorMatch ? donorMatch[1] : null;
  const view:
    | "home"
    | "donor"
    | "charities"
    | "admin"
    | "my-donations"
    | "my-volunteering" = donorId
    ? "donor"
    : hash === "#charities"
      ? "charities"
      : hash === "#admin"
        ? "admin"
        : hash === "#my-donations"
          ? "my-donations"
          : hash === "#my-volunteering"
            ? "my-volunteering"
            : "home";

  useEffect(() => {
    api
      .getContent()
      .then(setContent)
      .catch(() => setContentError(true));

    api
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!donorId) return;
    let cancelled = false;
    api
      .getDonor(donorId)
      .then((d) => {
        if (cancelled) return;
        setActiveDonor(d);
        setDonorFetchErrorId(null);
      })
      .catch(() => {
        if (cancelled) return;
        setActiveDonor(null);
        setDonorFetchErrorId(donorId);
      });
    return () => {
      cancelled = true;
    };
  }, [donorId]);

  const donorLoading =
    Boolean(donorId) &&
    activeDonor?.id !== donorId &&
    donorFetchErrorId !== donorId;

  function goHome() {
    window.location.hash = "";
    window.scrollTo(0, 0);
  }

  function openDonor(id: string) {
    window.location.hash = `donor-${id}`;
    window.scrollTo(0, 0);
  }

  function openCharities() {
    window.location.hash = "charities";
    window.scrollTo(0, 0);
  }

  function openAdmin() {
    window.location.hash = "admin";
    window.scrollTo(0, 0);
  }

  function openMyDonations() {
    window.location.hash = "my-donations";
    window.scrollTo(0, 0);
  }

  function openMyVolunteering() {
    window.location.hash = "my-volunteering";
    window.scrollTo(0, 0);
  }

  function applyAsDonor() {
    // Clears the hash (→ view becomes "home" once re-rendered) then
    // scrolls to #participate a frame later, once that section actually
    // exists in the DOM — a plain `href="#participate"` anchor can't do
    // this reliably from the charities view, since the target isn't
    // mounted yet at click time. `html { scroll-behavior: smooth }`
    // (globals.css) makes this a smooth scroll for free.
    window.location.hash = "";
    requestAnimationFrame(() => {
      document.getElementById("participate")?.scrollIntoView();
    });
  }

  async function handleSignOut() {
    await api.logout().catch(() => {});
    setUser(null);
  }

  const config = content?.config;
  const accent = config?.accentPalette ?? DEFAULT_ACCENT;

  return (
    <div
      style={
        {
          "--accent-green": accent[0],
          "--accent-amber": accent[1],
        } as React.CSSProperties
      }
    >
      <Header
        charityName={config?.charityName ?? "The Million Meal Club"}
        isDonorView={view === "donor"}
        isCharitiesView={view === "charities"}
        isAdminView={view === "admin"}
        isMyDonationsView={view === "my-donations"}
        isMyVolunteeringView={view === "my-volunteering"}
        user={user}
        onSignIn={() => setShowAuthModal(true)}
        onSignOut={handleSignOut}
        onGoHome={goHome}
        onOpenCharities={openCharities}
        onOpenAdmin={openAdmin}
        onOpenMyDonations={openMyDonations}
        onOpenMyVolunteering={openMyVolunteering}
      />

      {contentError && (
        <div className="mx-auto max-w-[640px] px-6 py-6 text-center text-sm text-muted">
          Couldn&apos;t load site content — is the backend running? See{" "}
          <code>backend/README.md</code>.
        </div>
      )}

      {view === "home" && (
        <>
          {/* Hero, HowItWorks, and Faq are static content (no backend
              dependency — see specs/frontend/design.md "Static content") and
              always render, even before/if GET /api/content resolves. Only
              the sections that genuinely need real data wait on `content`. */}
          <Hero
            charityName={config?.charityName ?? "The Million Meal Club"}
            founderName={config?.founderName ?? "Founder"}
          />

          {content && (
            <>
              <Progress
                totalMeals={config!.totalMeals}
                milestone2027={config!.milestone2027}
                goal2030={config!.goal2030}
              />
              <Events events={content.events} />
            </>
          )}

          <HowItWorks />

          {content && (
            <>
              <section
                id="participate"
                className="bg-bg-alt px-[clamp(20px,5vw,56px)] py-[clamp(56px,8vw,100px)]"
              >
                <div className="mx-auto grid max-w-[1160px] grid-cols-[repeat(auto-fit,minmax(340px,1fr))] items-start gap-14">
                  <div>
                    <span className="text-[13px] font-bold tracking-[0.08em] text-[var(--accent-green)] uppercase">
                      Join In
                    </span>
                    <h2 className="mt-3 mb-4.5 font-display text-[clamp(28px,4vw,42px)] font-extrabold tracking-[-0.01em]">
                      Tell us where, and how you&apos;ll help.
                    </h2>
                    <p className="m-0 mb-5 max-w-[460px] text-base leading-[1.7] text-muted">
                      Donors join by invitation only, committing to deliver
                      at least 50,000 meals over 4 years — apply below and
                      I&apos;ll personally follow up. Not ready for that
                      commitment? Register to volunteer instead, collecting
                      and delivering for a donor who needs a hand.
                    </p>
                    <p className="m-0 max-w-[460px] text-sm leading-[1.6] text-muted-2">
                      100% volunteer-run. No money is ever collected through
                      this site or by our volunteers.
                    </p>
                  </div>
                  <JoinInForm
                    user={user}
                    partnerCharities={content.partnerCharities}
                  />
                </div>
              </section>

              <Gallery
                user={user}
                gallery={content.gallery}
                partnerCharities={content.partnerCharities}
                onOpenSignIn={() => setShowAuthModal(true)}
              />
              <FeaturedDonors
                donors={content.donors}
                onSelectDonor={openDonor}
              />
            </>
          )}

          <Faq />
        </>
      )}

      {view === "donor" && (
        <DonorDetail donor={activeDonor} loading={donorLoading} />
      )}

      {view === "charities" && content && (
        <PartnerCharities
          charities={content.partnerCharities}
          onApplyAsDonor={applyAsDonor}
        />
      )}

      {view === "admin" && (
        <AdminSignoff user={user} onUserChange={setUser} />
      )}

      {view === "my-donations" && <DonorDashboard />}

      {view === "my-volunteering" && (
        <VolunteerDashboard events={content?.events ?? []} />
      )}

      <Footer
        charityName={config?.charityName ?? "The Million Meal Club"}
        founderName={config?.founderName ?? "Founder"}
      />

      <SignInModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSignedIn={(u) => {
          setUser(u);
          setShowAuthModal(false);
        }}
      />
    </div>
  );
}
