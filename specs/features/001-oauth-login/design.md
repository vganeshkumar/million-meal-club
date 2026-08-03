# Feature: OAuth Login — Design

## Frontend
- `lib/auth.ts`:
  - `loadGoogleScript()` — injects `https://accounts.google.com/gsi/client`,
    initializes with `client_id` (public env var
    `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, baked in at build time — safe, it's a
    public identifier), renders the button or uses the token-client flow to
    get an ID token on click.
  - `loadFacebookSdk()` — injects the FB JS SDK, `FB.init({ appId:
    NEXT_PUBLIC_FACEBOOK_APP_ID, ... })`, uses `FB.login()` to get an
    access token.
  - `signInWithGoogle(idToken)` / `signInWithFacebook(accessToken)` — POST
    to `/api/auth/google` / `/api/auth/facebook`, then re-fetch
    `/api/auth/me` to refresh app state.
  - `signOut()` — `POST /api/auth/logout`, clear local `user` state.
- `SignInModal.tsx` — same layout/copy as the prototype (heading, one line,
  Google button, Facebook button) minus the "Your Name" input and minus the
  demo disclaimer line, since this is now real.

## Backend
See [[../../backend/design]] "Auth mechanics" section for the full
verification/session flow. Summary of this feature's specific pieces:
- `POST /api/auth/google` — verify `id_token` via `google.oauth2.id_token`
  against `GOOGLE_CLIENT_ID`.
- `POST /api/auth/facebook` — verify `access_token` via Facebook's Graph
  `debug_token`, then fetch profile fields.
- Both upsert into `Users` (keyed `provider:sub` or `provider:fb_user_id`)
  and issue the session cookie.
- `GET /api/auth/me` — decodes/verifies the session cookie, returns
  `{ name, email, provider }` or 401.
- `POST /api/auth/logout` — sets the cookie's `Max-Age=0`.

## Data
`Users` table: PK `user_id` (a `uuid4` generated at first sign-in, stable
across sessions), attributes `provider`, `provider_subject` (Google `sub` /
FB user id), `email`, `name`, `created_at`. A GSI on `provider_subject` (or
just query by constructing the same deterministic key format) is used to
look up existing users on repeat sign-in.

## Edge cases
- Same person signs in with Google once and Facebook another time → two
  separate `Users` rows (no cross-provider identity merging in v1 — email
  match merging is a possible future enhancement, not required now).
- Facebook token verification fails (expired/invalid) → 401 with a clear
  error the frontend surfaces as "Sign-in failed, please try again."
- Admin check: `require_admin()` dependency compares the session's `email`
  (lowercased) against `ADMIN_EMAILS` env var split on commas — done at
  request time, not baked into the JWT, so revoking admin access is just an
  env var change + redeploy, not requiring affected users to re-login.
