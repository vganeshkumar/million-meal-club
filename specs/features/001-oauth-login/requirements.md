# Feature: OAuth Login

## Why
The design brief is explicit: the founder should never build/maintain a
password system or manually collect emails. A verified provider identity
replaces all of that. See design README's OAuth section and
[[00-constitution]] §4.

## Requirements
- Sign In modal (unchanged UI from the prototype) offers "Continue with
  Google" only — no Instagram, no name/password fields.
- Successful sign-in yields a verified `{ name, email, provider }` — real
  values from the provider, never user-typed.
- Session persists across page reloads via an `HttpOnly` cookie (not
  `localStorage`, unlike the prototype).
- Signing in immediately prefills the Join In form's name as a read-only
  "Signed in as {name}" chip.
- Signing out clears the session (`POST /api/auth/logout`) and reverts the
  above.
- The founder's own admin access is just this same login, checked against
  an email allowlist server-side (see [[004-admin-review-approval]]) — no
  separate admin credential to create or remember.

**Update, 2026-08-05**: Facebook sign-in was removed — Google is the only
provider for now ("won't need it at this stage" per the founder). The
requirement above originally read "Continue with Google" and "Continue with
Facebook" only, and there was an open question below for a Facebook App
ID/Secret; both have been superseded by this decision. Re-adding Facebook
later is a separate decision, not blocked by anything removed here — the
code just needs the same shape rebuilt (`verify_facebook_token` in
`app/services/oauth.py`, `POST /api/auth/facebook`, the FB JS SDK loader in
`frontend/lib/auth.ts`, and the `facebook_app_id`/`facebook_app_secret`
Terraform variables — see git history around this date for the removed
implementation).

## Open questions for the user (fill in before implementing)
- [x] Google Cloud OAuth Client ID — needs a Google Cloud project +
      OAuth consent screen configured (external, testing or published) and
      an OAuth 2.0 Client ID of type "Web application" with the site's
      origin(s) as authorized JavaScript origins.
- [x] The founder's own email address(es) for the initial `ADMIN_EMAILS`
      allowlist value.
