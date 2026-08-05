# Feature: OAuth Login — Tasks

**Update, 2026-08-05**: Facebook sign-in was removed — Google-only for now
(see requirements.md and design.md for the amendment). The Facebook-specific
tasks below are struck through rather than deleted, for the historical
record of what was built and then retired.

- [x] User provisions Google OAuth Client ID (see requirements.md open questions).
- ~~User provisions Facebook App ID/Secret (see requirements.md open questions).~~
- [x] Backend: `app/services/oauth.py` (verify_google_token).
- [x] Backend: `app/services/jwt_session.py` (issue/verify session cookie).
- [x] Backend: `app/routers/auth.py` (google/me/logout).
- [x] Backend: `Users` table access in `local_store.py` / `dynamo_store.py`.
- [x] Frontend: `lib/auth.ts` (GIS loader, signIn/signOut helpers).
- [x] Frontend: `SignInModal.tsx` wired to real sign-in calls.
- [x] Frontend: header "Sign In"/"Hi, {name}"/"Sign Out" wired to `/api/auth/me`.
- [x] Manual test: sign in with a real Google account end-to-end (dev env),
      confirm cookie set, `Users` row created, `/api/auth/me` returns it.
- ~~Manual test: sign in with a real Facebook test user, same checks.~~
- [x] Manual test: set `ADMIN_EMAILS` to the founder's email, confirm
      `/api/admin/*` routes become accessible only after signing in as that email.
