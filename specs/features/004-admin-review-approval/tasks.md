# Feature: Admin Review & Approval — Tasks

- [x] Backend: `deps.require_admin()`.
- [x] Backend: `app/routers/admin.py` — list/approve/reject/config endpoints.
- [x] Backend: atomic `ADD` counter updates for `Donors.total_meals` and
      `Config.total_meals` on approval (DynamoDB path uses `UpdateExpression
      ADD`; local dev store uses direct increment, single-process so no race).
- [x] Backend: donor auto-create-on-first-approval logic.
- [x] Manual test: full loop — submitted as a non-admin test user, approved
      as an admin-allowlisted user, confirmed `GET /api/content` reflected
      the new total (10000 → 10042) and a new donor row was auto-created.
- [ ] Manual test: reject path leaves totals unchanged. (Endpoint implemented,
      not yet exercised.)
- [ ] Decide (with user) whether a minimal admin UI page is worth adding as
      its own follow-up feature spec, or if API-only + manual tooling is
      sufficient long-term.
