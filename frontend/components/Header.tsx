"use client";

import type { AuthUser } from "@/lib/types";

type HeaderProps = {
  charityName: string;
  isDonorView: boolean;
  isCharitiesView: boolean;
  isAdminView: boolean;
  isMyDonationsView: boolean;
  isMyVolunteeringView: boolean;
  user: AuthUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onGoHome: () => void;
  onOpenCharities: () => void;
  onOpenAdmin: () => void;
  onOpenMyDonations: () => void;
  onOpenMyVolunteering: () => void;
};

const NAV_LINKS = [
  { href: "#how-it-works", label: "How It Works" },
  { href: "#progress", label: "Progress" },
  { href: "#events", label: "Events" },
  { href: "#gallery", label: "Gallery" },
  { href: "#donors", label: "Donors" },
];

export function Header({
  charityName,
  isDonorView,
  isCharitiesView,
  isAdminView,
  isMyDonationsView,
  isMyVolunteeringView,
  user,
  onSignIn,
  onSignOut,
  onGoHome,
  onOpenCharities,
  onOpenAdmin,
  onOpenMyDonations,
  onOpenMyVolunteering,
}: HeaderProps) {
  const showBackButton =
    isDonorView || isCharitiesView || isAdminView || isMyDonationsView || isMyVolunteeringView;

  return (
    <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4 border-b border-border bg-bg/92 px-[clamp(20px,5vw,56px)] py-4 backdrop-blur-sm">
      <a
        href="#top"
        onClick={(e) => {
          e.preventDefault();
          onGoHome();
        }}
        className="flex items-center gap-2.5 text-ink no-underline"
      >
        <span className="inline-block h-3.5 w-3.5 rounded-full bg-[var(--accent-green)]" />
        <span className="font-display text-[19px] font-bold tracking-tight">
          {charityName}
        </span>
      </a>

      {!showBackButton ? (
        <nav className="flex flex-wrap items-center gap-[clamp(14px,2vw,28px)] text-[14.5px] font-semibold">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-ink no-underline"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#charities"
            onClick={(e) => {
              e.preventDefault();
              onOpenCharities();
            }}
            className="text-ink no-underline"
          >
            Partner Charities
          </a>
          <a href="#faq" className="text-ink no-underline">
            FAQ
          </a>
          <a
            href="#participate"
            className="rounded-full bg-[var(--accent-green)] px-[18px] py-[9px] font-bold text-ink-fg no-underline"
          >
            Join In
          </a>
          {user?.isDonor && (
            <a
              href="#my-donations"
              onClick={(e) => {
                e.preventDefault();
                onOpenMyDonations();
              }}
              className="text-ink no-underline"
            >
              My Donations
            </a>
          )}
          {user?.isVolunteer && (
            <a
              href="#my-volunteering"
              onClick={(e) => {
                e.preventDefault();
                onOpenMyVolunteering();
              }}
              className="text-ink no-underline"
            >
              My Volunteering
            </a>
          )}
          {user?.isAdmin && (
            <a
              href="#admin"
              onClick={(e) => {
                e.preventDefault();
                onOpenAdmin();
              }}
              className="text-ink no-underline"
            >
              Admin
            </a>
          )}
          {!user ? (
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-full border border-border-strong bg-transparent px-4 py-2 text-sm font-bold text-ink"
            >
              Sign In
            </button>
          ) : (
            <span className="flex items-center gap-2 text-[13.5px] font-bold text-muted-2">
              Hi, {user.name}
              <button
                type="button"
                onClick={onSignOut}
                className="cursor-pointer border-none bg-transparent p-0 text-[13px] text-muted-2 underline"
              >
                Sign Out
              </button>
            </span>
          )}
        </nav>
      ) : (
        <button
          type="button"
          onClick={onGoHome}
          className="flex cursor-pointer items-center gap-1.5 border-none bg-transparent text-[14.5px] font-bold text-ink"
        >
          {isDonorView ? "← Back to all donors" : "← Back to home"}
        </button>
      )}
    </header>
  );
}
