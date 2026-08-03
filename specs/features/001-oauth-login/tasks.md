# Feature: OAuth Login — Tasks

- [ ] User provisions Google OAuth Client ID (see requirements.md open questions).
- [ ] User provisions Facebook App ID/Secret (see requirements.md open questions).
- [x] Backend: `app/services/oauth.py` (verify_google_token, verify_facebook_token).
- [x] Backend: `app/services/jwt_session.py` (issue/verify session cookie).
- [x] Backend: `app/routers/auth.py` (google/facebook/me/logout).
- [x] Backend: `Users` table access in `local_store.py` / `dynamo_store.py`.
- [x] Frontend: `lib/auth.ts` (GIS + FB SDK loaders, signIn/signOut helpers).
- [x] Frontend: `SignInModal.tsx` wired to real sign-in calls.
- [x] Frontend: header "Sign In"/"Hi, {name}"/"Sign Out" wired to `/api/auth/me`.
- [ ] Manual test: sign in with a real Google account end-to-end (dev env),
      confirm cookie set, `Users` row created, `/api/auth/me` returns it.
      (Blocked on the user provisioning a Google OAuth Client ID — the
      session/cookie/user-upsert mechanics were verified with a manually
      minted session token instead; only the provider-token-verification
      step is unexercised.)
- [ ] Manual test: sign in with a real Facebook test user, same checks.
- [x] Manual test: set `ADMIN_EMAILS` to the founder's email, confirm
      `/api/admin/*` routes become accessible only after signing in as that email.
