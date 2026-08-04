# Feature: Admin Application Filter — Design

## Frontend (`components/AdminSignoff.tsx`)
`PendingApplications` gains local state:
```tsx
const [filter, setFilter] = useState<"all" | "donor" | "volunteer">("all");
const visible = applications?.filter(
  (a) => filter === "all" || a.mode === filter,
);
```
A segmented control (same visual pattern as the existing Applications/
Submissions tabs) renders above the "Pending Applications" heading:
`All` / `Donor` / `Volunteer` buttons, active one styled with the
`--accent-green` fill. The list below maps over `visible` instead of
`applications`; the "Nothing pending review" empty state checks
`visible?.length === 0` so it also fires correctly when a filter hides
every application of the other mode (distinct from "nothing fetched at
all," but the same message is fine — the founder can tell from context by
switching the filter back to All).

No backend change — this is entirely a client-side narrowing of data
`GET /api/admin/signups` already returns.

## Tests
Frontend (`frontend/e2e/admin-application-filter.spec.ts`, Playwright):
seed one donor and one volunteer application via the API, sign in as
admin, open `#admin`, confirm both cards show under "All," confirm only
the donor card shows under "Donor," confirm only the volunteer card shows
under "Volunteer."
