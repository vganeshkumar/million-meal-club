# Handoff: Charity Progress Website ("The Million Meal Club")

## Overview
A public-facing progress website for a fully volunteer-run charity that feeds people weekly via donor-funded, hand-delivered food packets. No money is ever collected through the site. Goal: track and celebrate progress toward 1,000,000 meals delivered in the founder's lifetime (interim milestone: 100,000 meals by end of 2027; 1,000,000 by 2030).

Core purposes of the site:
1. Communicate progress (an animated meal counter + progress bar toward milestones).
2. Let people sign up to either **fund** food packets or **volunteer** to collect/deliver them (one consolidated form).
3. Let signed-in donors/volunteers **submit photo/receipt proof** of a completed delivery, which the founder manually verifies before the meal count increases.
4. **Feature donors** on a spotlight wall (ranked by meals delivered), each with a detail page showing their story and a log of each individual donation with photos.
5. Promote **upcoming in-person events**.
6. Point visitors to Facebook/Instagram.

## About the Design Files
The bundled file (`Million Meal Club.dc.html`) is a **design reference prototype** — it was built in this project's internal "Design Component" authoring format (a single HTML file + a small runtime script, `support.js`, that together render the page live in a browser for review). It is **not production code to copy directly**. It does not use a real framework, real authentication, a real backend, or a real database.

Your task is to **recreate this design in whatever stack you choose for the actual static site** (plain HTML/CSS/JS is a perfectly reasonable choice given this is meant to be an AWS S3 static site — or React/Vue/Astro if you prefer). Use the structure, copy, layout, and interaction logic described below as the spec. Do not try to keep the `.dc.html` file or its runtime — it's for visual/behavioral reference only. Open it in a browser (double-click, or serve the folder) to see it live and interact with it.

## Fidelity
**High-fidelity.** Colors, type, spacing, and copy are final/intentional (though copy can be freely edited). Layout is fully responsive already (fluid grid/flex, no fixed breakpoints — uses CSS `clamp()`/`minmax()`/`auto-fit` throughout). Recreate it pixel-close using your target stack's own component/styling conventions.

## Known gaps you need to fill in (explicitly out of scope of this prototype)
These are the pieces that only work as a stubbed/simulated experience in the prototype and need real implementation:

1. **Formspree endpoints are placeholders.** Both forms (`Join In` at `#participate`, and the `Submit Proof` form in the Gallery section) post to placeholder URLs like `https://formspree.io/f/YOUR_FORM_ID`. Replace with real Formspree (or other form-backend) endpoints, or build a real backend for submissions.
2. **Sign-in is simulated, not real OAuth.** Clicking "Continue with Google" / "Continue with Facebook" in the Sign In modal just takes a typed name and stores `{name, provider}` in `localStorage` — there is no real Google Identity Services or Facebook Login integration wired up, no token verification, and no real email is ever captured. The intent (per the founder's request) is: a real OAuth integration means the founder never needs to build/maintain their own signup+password system or manually collect emails — the provider supplies a verified identity. Recreate real sign-in using:
   - Google Identity Services (https://developers.google.com/identity/gsi/web) — client-side only, needs a Google Cloud OAuth Client ID.
   - Facebook Login SDK — needs a Facebook App ID.
   Once wired, the verified `name`/`email` from the provider should replace the current `user.name`-only object, and can be included in the form submissions as hidden fields so the founder gets a real contact channel without ever building an email input.
3. **Meal counter, milestones, donor list, event list, and gallery are all hardcoded placeholder data** inside the prototype's JS (see "State Management" below) — there is no real database. The founder's intended workflow: someone submits proof (photo/receipt) via the gated upload form → founder manually reviews it → founder manually updates the data (currently: hand-edit an array in code / re-deploy). For the real implementation, consider replacing this with a lightweight admin-editable data source (a JSON file the founder edits and the static site fetches at build/runtime, or a simple headless CMS / spreadsheet-backed API) so the founder isn't editing code by hand. This was flagged to the founder as a natural next improvement.
4. **Approval workflow is manual by design** — there is no auto-increment on submission. Preserve this: the meal counter and donor totals should only change after the founder explicitly approves a submission.

## Screens / Views
The prototype is a single page with client-side "view" switching (no real routing):

### 1. Home (default view)
Sections in order, all on one scrollable page:
- **Header (sticky)** — logo/charity name (left), nav links + Sign In / account chip (right). Nav links: How It Works, Progress, Events, Gallery, Donors, FAQ, plus a "Join In" pill CTA. When a donor detail page is open, the nav is replaced by a single "← Back to all donors" button.
- **Hero** — eyebrow label, two-line display headline, one paragraph of founder's-voice copy, two CTA buttons ("Join In" → scrolls to `#participate`, "See Our Progress" → scrolls to `#progress`). Two large soft-blurred decorative circles (amber + green, low opacity) positioned top-left and bottom-right for atmosphere.
- **Progress** (`#progress`, dark green full-bleed band) — eyebrow, giant animated counter (counts up from 0 to the current meal total when scrolled into view, ~1.5s ease-out cubic), a supporting line, then a labeled progress bar showing progress toward the next milestone (100,000 by end of 2027), and a closing line about the ultimate 1,000,000-by-2030 goal.
- **Events** (`#events`) — eyebrow/heading/subtitle, then a responsive card grid of upcoming events: date+time badge, location, description, "Packet goal: N", and a "I'll Join This One" button linking to `#participate`.
- **How It Works** (`#how-it-works`) — eyebrow/heading, 4-card responsive grid, each card: large numeral (01–04), title, one-sentence body. Steps: (1) Pick location & packet count, (2) Choose role (self-deliver vs. need a volunteer), (3) "We connect the dots" — volunteer network coordinates, (4) Share proof (photo) to be verified and counted.
- **Join In** (`#participate`) — consolidated signup, replacing what used to be two separate sections (donor signup + volunteer signup). Two-column layout: left = static copy explaining the mission/no-money policy; right = one form with:
  - A 2-option segmented toggle at the top: "Fund Meals" vs. "Volunteer To Deliver" (controls which fields below are shown).
  - If signed in: a "Signed in as {name}" chip replaces the Name field (submitted via hidden input); if signed out: a normal Name text input.
  - Shared: Location/City field, Notes (optional) textarea.
  - Fund Meals mode only: Number of Food Packets, and a "Delivery role" radio (I'll deliver it myself / I need a volunteer to collect & deliver).
  - Volunteer mode only: Packets You Can Handle Per Trip, Availability (free text).
  - Submit button label changes with mode ("Count Me In" vs. "Register As A Volunteer"). A hidden `signup_type` field carries the current mode.
- **Proof Of Delivery / Gallery** (`#gallery`) — eyebrow/heading/subtitle. Then, gated by sign-in state:
  - **Signed in:** the upload form — "Submitting as {name}" chip, Location, Meals Delivered, Photo Proof (file, required), Receipt (file, optional), Caption (optional), Submit button.
  - **Signed out:** a dashed-border card with a short explanation and a "Sign In" button (opens the Sign In modal).
  Below either state: a public, always-visible responsive grid of gallery photo placeholders (currently 6, striped diagonal placeholder pattern + "delivery photo / awaiting submission" monospace label) — this grid is NOT gated, only the upload action is.
- **Featured Donors** (`#donors`) — eyebrow/heading/subtitle, then a responsive card grid of donors **sorted by total meals delivered, descending**. Each card: circular initial-avatar (colored — top-ranked donor gets the amber accent, others get the green accent, same for the card's border), name, location, big meal-total number + "meals delivered" label, and an italic/monospace placeholder line for their "why" story. Cards are clickable → open that donor's detail view (see below) and push a URL hash like `#donor-2` for shareable/back-button-friendly deep links.
- **FAQ** (`#faq`) — eyebrow/heading, then an accordion list (5 items). Each row: question + a +/− toggle glyph; only one/any can be open, click toggles that row's answer visibility.
- **Footer** — 3-column responsive layout: (1) logo + one-line thank-you signed by the founder, (2) "Follow Our Progress" — Facebook/Instagram link pills (placeholder hrefs), (3) "Get In Touch" — mailto link. Closing copyright line reiterating "fully volunteer-run, no money donations collected."

### 2. Donor Detail (opened by clicking a donor card; closed via header "← Back to all donors")
Replaces the entire home content (same page, different view state), reachable via hash routing (`#donor-<id>`, survives page refresh/back button):
- Header row: large circular initial-avatar + donor name + location.
- Stat strip: total meals delivered, and number of donations made (2 stat blocks side by side in a light rounded panel).
- "Why I'm doing this" — the donor's full story text.
- "Their Deliveries" — a vertical list of cards, one per individual donation: photo placeholder (same striped pattern as gallery), date + location label, that donation's meal count, and a caption.

### 3. Sign In Modal (overlay, triggerable from header or from the gated Gallery upload prompt)
Centered card over a dark semi-transparent backdrop (click backdrop or × to close): heading "Sign In", one short explanatory line, a "Your Name" text input, then "Continue with Google" (dark filled button) and "Continue with Facebook" (outlined button), then a small italic disclaimer that this is a demo sign-in in the prototype.

## Interactions & Behavior
- **Sticky header** stays pinned on scroll with a translucent/blurred background.
- **Anchor-link scrolling** for all in-page nav (`#progress`, `#participate`, etc.) — plain `<a href="#id">`, no JS smooth-scroll library required, standard browser anchor jump is fine (or add smooth scroll via CSS `scroll-behavior: smooth` on `html`).
- **Meal counter animation**: triggers once, via IntersectionObserver on the counter element (threshold ~0.3) with a ~900ms fallback timer in case the observer never fires (some environments don't reliably fire it) — counts 0 → current total over ~1.5s with cubic ease-out, formatted with thousands separators.
- **Progress bar** fill width = `min(100, count / milestone2027 * 100)%`, animated via CSS transition on width.
- **FAQ accordion**: click a question row to toggle just that row's answer (independent, not single-open-at-a-time — multiple can be open simultaneously). Toggle glyph switches between "+" and "−".
- **Donor card click** → sets an in-memory "view" state to `donor` + a `donorId`, updates `window.location.hash` to `donor-<id>` for shareability, scrolls to top. Listens for `hashchange`/initial load so a direct link to `#donor-2` opens straight into that donor's page (supports browser back/forward).
- **"Fund Meals" / "Volunteer To Deliver" toggle** in the Join In form: pure client-side state, swaps which fields render, changes submit button label, sets a hidden field value — all within one `<form>`/one Formspree submission.
- **Sign In flow**: header "Sign In" button (when signed out) opens the modal; "Sign Out" text link (when signed in, shown next to "Hi, {name}") clears the session. Session (`{name, provider}`) persists across reloads via `localStorage` (key: `mmc_user`). Signing in immediately: (a) prefills the Name field as a read-only "Signed in as {name}" chip in the Join In form, (b) unlocks the Gallery upload form in place of the "Sign in to submit proof" prompt.
- **No real form submission handling** — forms are native `<form action="..." method="POST">` posts (the Join In form is a normal POST; the Gallery upload form additionally uses `enctype="multipart/form-data"` for the file inputs). No client-side validation beyond native HTML `required`/`type` attributes.

## State Management
Minimal, all client-side/in-memory in the prototype (no backend):
- `count` — current animated value of the meal counter (0 → target).
- `faqOpen` — map of FAQ index → open/closed boolean.
- `view` — `"home"` | `"donor"`; `donorId` — which donor's detail page is showing. Derived from/synced to `window.location.hash`.
- `user` — `null` or `{ name, provider }`; persisted to `localStorage` under `mmc_user`.
- `showAuthModal` — boolean.
- `joinMode` — `"donor"` | `"volunteer"` (Join In form toggle).

Data (all hardcoded placeholder arrays in the prototype's JS — replace with a real data source):
- `steps` — the 4 "How It Works" steps (title + body each).
- `donorsData` — array of donors: `{ name, location, story, donations: [{ date, location, meals, caption }, ...] }`. Total meals per donor = sum of their `donations[].meals`; list is sorted descending by that total at render time; the top-ranked donor gets the accent color treatment.
- `eventsData` — array of `{ date, time, location, packetsGoal, description }`.
- `faqsData` — array of `{ q, a }` (5 items, real copy already written — see file).
- `gallery` — currently just a count of 6 placeholder slots (no real photos yet).

Props exposed as easy top-level config (currently editable via this tool's "Tweaks" concept — in a real implementation these should become simple constants, CMS fields, or env-driven config):
- `charityName` (string, default `"The Million Meal Club"`)
- `founderName` (string)
- `totalMeals` (number, default `10000`) — current verified meal count.
- `milestone2027` (number, default `100000`)
- `goal2030` (number, default `1000000`)
- `accentPalette` — a 2-color array `[green, amber]` (3 curated preset pairs exist in the prototype).

## Design Tokens

### Colors (all defined in OKLCH; hex equivalents approximate — recreate using OKLCH if your CSS tooling supports it for closest match)
- Background (page): `oklch(97% 0.014 95)` — warm off-white/cream.
- Background (alternating section band): `oklch(94% 0.025 95)`.
- Card/surface background: `oklch(99% 0.006 95)`.
- Card/section border: `oklch(89% 0.02 95)`.
- Primary text (ink): `oklch(21% 0.03 155)`.
- Secondary/muted text: `oklch(38–45% 0.03 150)` (varies slightly by use).
- Primary accent (green — default): `oklch(38% 0.1 155)`. Alternate presets: `oklch(35% 0.09 165)`, `oklch(42% 0.1 145)`.
- Secondary accent (amber — default): `oklch(68% 0.15 55)`. Alternate presets: `oklch(65% 0.16 45)`, `oklch(70% 0.14 70)`.
- Dark band background (Progress section + Footer): `oklch(21% 0.03 155)` (same as primary ink color, used as a background here).
- Modal backdrop: `oklch(21% 0.03 155 / 0.55)`.

### Typography
- Display/heading font: **Bricolage Grotesque** (Google Font), weights 400/500/600/700/800. Used for: logo wordmark, all headings, big stat numbers, step numerals, FAQ question marks are body font but headings use this.
- Body font: **Karla** (Google Font), weights 400/500/600/700. Used for: all paragraph copy, labels, buttons, form inputs.
- Headline sizes are fluid via `clamp()`, e.g. hero H1 `clamp(38px, 6.5vw, 84px)`; section H2s `clamp(28px, 4vw, 42px)`; the big meal counter `clamp(56px, 11vw, 140px)`.
- Body copy: 15–19px depending on context; small labels/eyebrows: 12.5–14px, bold, uppercase, letter-spacing ~0.06–0.08em.

### Spacing / Layout
- Section vertical padding: fluid, roughly `clamp(56px, 8vw, 100px)` top/bottom (hero slightly larger).
- Horizontal page padding: `clamp(20px, 5vw, 56px)`.
- Content max-width: 1160px (most sections), 1000px (progress), 900px (donor detail page), 820px (FAQ), 640px (narrow copy/forms).
- Grids: responsive via `grid-template-columns: repeat(auto-fit, minmax(Npx, 1fr))` — no fixed breakpoints anywhere; column count naturally reduces as viewport narrows. Typical minmax bases: 240–340px depending on section.
- Border radius: large/pill for buttons and badges (`999px`), 16–24px for cards/panels, 10–14px for inputs and small elements.

### Shadows
- Donor card hover: `0 12px 28px oklch(21% 0.03 155 / 0.1)` + `translateY(-2px)`.
- Sign-in modal: `0 24px 60px oklch(21% 0.03 155 / 0.25)`.

## Assets
No real photos/logos are used yet — everything is a clearly-labeled placeholder:
- Gallery photos and each donation's photo: a repeating diagonal-stripe CSS pattern (`repeating-linear-gradient`, two cream tones) with centered monospace text ("delivery photo" / "awaiting submission" or similar). Replace with real uploaded photos.
- Donor avatars: colored circles with the donor's first initial (no photo assets needed, but could be swapped for real profile photos later).
- No icons/logos are hand-drawn; Facebook/Instagram are plain text pill links (no logo marks used) — add real brand icon assets if desired.
- Google Font imports: Bricolage Grotesque + Karla, loaded via `fonts.googleapis.com` `<link>` tags — carry these over or self-host equivalents.

## Files
- `Million Meal Club.dc.html` — the full design reference (structure + inline styles + interaction logic, in this tool's internal component format). Open directly in a browser to view/interact with it live.
- `support.js` — small runtime required only to render the `.dc.html` file in a browser for reference; not needed in your real implementation.
- `screenshots/` — reference screenshots of key states:
  - `01-home-hero.png` — home page, top (hero + header, signed out).
  - `02-gallery-gated-signedout.png` — Gallery section's upload prompt when signed out.
  - `03-gallery-upload-signedin.png` — Gallery upload form unlocked after sign-in.
  - `04-featured-donors.png` — Featured Donors spotlight cards.
  - `05-joinin-form-volunteer-mode.png` — consolidated Join In form, "Volunteer To Deliver" mode, signed in.
  - `06-faq.png` — FAQ accordion (open state).
  - `07-signin-modal.png` — Sign In modal overlay.
  - `08-donor-detail.png` — a donor's detail page (story + per-donation log).

## Deployment target note
The founder's stated goal is a fully static site hosted on AWS (e.g. S3 + CloudFront). Keep the real implementation static-hosting-friendly: no server-required rendering, and any "backend" needs (form capture, auth, data storage) should be third-party/serverless (Formspree, Google/Facebook OAuth client-side SDKs, a static JSON data file or headless CMS, etc.) rather than a custom server.
