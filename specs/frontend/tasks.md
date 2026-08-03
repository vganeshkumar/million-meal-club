# Frontend — Tasks

- [x] Scaffold `create-next-app` (TypeScript, App Router, Tailwind v4, `src/` off).
- [x] Set `output: 'export'` in `next.config.ts`.
- [x] Add OKLCH design tokens + fonts to `globals.css` / `layout.tsx`.
- [x] Build static-shell components: Header, Hero, HowItWorks, Faq, Footer
      (no backend dependency, pure markup/interaction).
- [x] Build `lib/types.ts` mirroring backend pydantic schemas.
- [x] Build `lib/api.ts` fetch wrapper (base URL `/api`, `credentials:'include'`).
- [x] Build Progress (counter + bar), wired to `content.config`.
- [x] Build Events, FeaturedDonors, DonorDetail, Gallery (public grid part)
      wired to `content.events` / `content.donors` / `content.gallery`.
- [x] Build `lib/auth.ts` (GIS + FB SDK loaders) + SignInModal.
- [ ] Wire real `/api/auth/google` and `/api/auth/facebook` calls once
      backend auth endpoints exist and OAuth client IDs are provisioned.
      (Wired to call them; blocked on real OAuth credentials being
      provisioned — see specs/features/001-oauth-login/requirements.md.)
- [x] Build JoinInForm (fund/volunteer toggle) posting to `/api/signups`.
- [x] Build Gallery upload form (presign → PUT → submit) once
      `/api/uploads/presign` and `/api/submissions` exist.
- [ ] Manual QA pass against `design_artifacts/.../screenshots/` for pixel-closeness.
      (Verified via curl/API round-trips and code review; not yet checked
      in a live browser — the Chrome extension wasn't connected when this
      was built.)
- [x] `npm run build` produces a clean static export with no server-only
      features accidentally used.
- [ ] Adopt the newer authoritative design (see [[../01-architecture]]
      "Source design", decided with user 2026-08-03): update Hero, Footer,
      Progress copy; expand Faq to 9 questions; update JoinInForm to the
      invitation-only donor application; update FeaturedDonors/DonorDetail
      copy + the static "50,000 / 4 yrs" stat; add PartnerCharities.tsx +
      `#charities` nav/routing (see
      [[../features/006-partner-charities/tasks]]).
      (Manual QA against screenshots note above also predates this
      redesign — the old screenshots reflect the superseded design.)
