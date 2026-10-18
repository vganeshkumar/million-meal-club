# Feature: Donation Kinds and Quantity — Requirements

## Why
Requested by the founder (2026-10-18). Every donation tracked so far has
been food packets — one packet, one meal, one person fed, so `meals` has
always doubled as both "what kind of donation" and "how many people it
helped." Starting this month, the club supports other forms of donation
that improve lives beyond food: education supplies for kids, lab equipment
for a school, clothing for a group, medicine for the elderly, an ambulance
for a rural village, and so on. The data model and every form built around
a single `meals` number need to generalize to **kind + quantity**, where
quantity always means "how many people/lives this donation benefits" —
for food packets that's still one packet per person, unchanged.

This does **not** change the minimum lifetime commitment every donor
agrees to (10,000 units within 5 years) — it's the same number, just no
longer meal-specific; a donor committing to deliver medicine is held to
the same 10,000-unit bar as one delivering food.

## Decisions made with the founder
Four open design questions were resolved directly with the founder before
writing this spec (see conversation, 2026-10-18):

1. **Public goal framing**: the homepage headline keeps the same
   `1,000,000` milestone number and keeps counting up from the same
   underlying total — only the **unit label** changes, from "meals
   delivered" to a generic phrase ("lives impacted") so every kind blends
   into the one running total. The site's name and the origin-story Hero
   copy ("No One Should Starve For A Meal") are unchanged — that section
   already reads as the founding story, not a literal scope limit (it
   already says "we're starting with meals... but meals are just the
   beginning").
2. **Kind scope**: kind is captured **per donation event**, not locked to
   the donor. At signup, a donor picks an initial kind as a signal of
   intent (mirrors today's `packet_count` at signup), but every event they
   later schedule independently records its own kind + quantity — a donor
   can diversify across kinds over their lifetime relationship with the
   club.
3. **Kind taxonomy**: a seeded starter list (Food Packets, Education
   Supplies, Clothing, Medicine, Ambulance/Transport, and a few others —
   see [[design#kind-taxonomy]]) that anyone can add to by typing a new
   kind at signup or when scheduling an event. A newly-typed kind becomes
   selectable for everyone else immediately — no admin approval queue.
   The founder can merge/rename duplicates later by hand if typos
   accumulate; not solved by this spec.
4. **Existing data**: a one-time backfill migration writes
   `kind = "Food Packets"` onto every existing donation, donation event,
   and submission record that predates this feature, so every record in
   storage has an explicit `kind` going forward — no permanent read-time
   inference needed.

## Requirements

### Terminology
- **Kind**: a free-text category of donation (e.g. "Food Packets",
  "Medicine"), drawn from a shared, ever-growing list.
- **Quantity**: how many people/lives a single donation benefits. For
  "Food Packets" this is the same number `meals`/`packet_count` already
  meant. For every other kind, it's the founder's/donor's honest estimate
  of people helped (e.g. "200 students" for a school lab, "1 village" —
  entered as a number, so "an ambulance for a village" is quantified as
  the number of people that village's ambulance serves, not "1").

### Signup (Join In form, donor mode)
- The existing "How many meals/packets" field becomes two fields: **Kind**
  (combo-box: pick from the shared list or type a new one) and
  **Quantity** (number, same validation as today's `packet_count` —
  required, must be positive).
- This is the donor's stated *intent*, same role `packet_count` plays
  today (shown on `SignupAdminView` for the founder's review) — it does
  not lock future events to that kind.
- The 10,000-minimum commitment checkbox copy changes from "I commit to
  delivering at least 10,000 meals within 5 years" to "...10,000 [kind]"
  interpolating the donor's chosen kind, or a generic "...10,000 units of
  help" if that reads awkwardly for non-countable kinds — see
  [[design#copy]] for the exact resolved wording.

### Scheduling a donation event
- `Create`/`Update` donation event forms (My Donations) replace the
  "food packets" quantity field with the same Kind + Quantity pair as
  signup. Defaults to the donor's most-recently-used kind (or their
  signup kind, for their first event) to reduce repetitive typing, but is
  always changeable per event.
- The public homepage Scheduled/Completed donation-event feed
  ([[../014-homepage-scheduled-events/requirements]]) shows the kind
  alongside quantity wherever it currently shows "N food packets".

### Submitting proof / admin approval
- The proof-submission form's quantity field becomes Kind + Quantity
  (pre-filled and read-only when submitting against a scheduled donation
  event, matching how location already auto-fills today; freely editable
  for a spontaneous, unplanned delivery).
- The founder's admin review card shows "`{quantity} {kind}` delivered"
  instead of the hard-coded "`{meals} meals` delivered".
- On approval, the resulting `Donation` record carries both `kind` and
  `quantity`.

### The public running total
- The single headline counter (today's `total_meals`) becomes a sum of
  **quantity across every kind** — approving a submission of any kind
  adds its quantity to the same number that currently only counts meals.
- Label changes from "meals delivered" to "lives impacted" (exact copy —
  see [[design#copy]]); the `1,000,000`/milestone/lifetime-goal numbers
  themselves are unchanged.

### New: breakdown by kind
- A new public section (homepage, near the existing progress counter)
  shows the running total broken down per kind — e.g. "812,340 Food
  Packets · 4,200 Education Supplies · 310 Medicine · ...". Only kinds
  with at least one *approved* (completed) donation appear; kinds with
  zero completed donations so far don't clutter the list.
- This is read-only and public — no admin configuration needed beyond
  what naturally accrues from approved submissions.

### Existing donor commitment language elsewhere
- Wherever "meals"-specific copy appears outside the Hero origin story
  (FAQ, donor dashboard labels, admin tables) is updated to be kind-aware
  rather than hard-coded to "meals" — see [[design#copy]] for the full
  inventory of copy sites.

## Out of scope
- Any admin UI for curating/merging/renaming kinds — the founder manages
  typos/duplicates by hand (e.g. a future direct DynamoDB edit or a
  follow-up spec) if the shared list gets messy; this spec doesn't build
  tooling for it.
- Changing the per-donor 10,000-unit minimum itself, or making it
  kind-specific (e.g. "10,000 meals OR 500 medicine units") — it stays a
  single flat number regardless of kind, as stated above.
- Renaming the site/brand itself ("Million Meal Club") or the domain —
  only the in-app counter *label* changes, not the org's name.
- Retroactively reclassifying any existing donation's kind — the backfill
  sets every pre-existing record to "Food Packets" (they all were) and
  that's final; no UI to bulk-edit historical kinds.
- Facebook auto-posting captions ([[../033-facebook-event-posting/requirements]])
  referencing kind by name — out of scope for this spec; it can keep
  saying "meals delivered" in that caption text, or get a small follow-up
  later. Not addressed here.
