# Feature: OAuth Login

## Why
The design brief is explicit: the founder should never build/maintain a
password system or manually collect emails. A verified provider identity
replaces all of that. See design README's OAuth section and
[[00-constitution]] §4.

## Requirements
- Sign In modal (unchanged UI from the prototype) offers "Continue with
  Google" and "Continue with Facebook" only — no Instagram, no name/password
  fields.
- Successful sign-in yields a verified `{ name, email, provider }` — real
  values from the provider, never user-typed.
- Session persists across page reloads via an `HttpOnly` cookie (not
  `localStorage`, unlike the prototype).
- Signing in immediately: (a) prefills the Join In form's name as a
  read-only "Signed in as {name}" chip, (b) unlocks the Gallery upload form.
- Signing out clears the session (`POST /api/auth/logout`) and reverts both
  of the above.
- The founder's own admin access is just this same login, checked against
  an email allowlist server-side (see [[004-admin-review-approval]]) — no
  separate admin credential to create or remember.

## Open questions for the user (fill in before implementing)
- [ ] Google Cloud OAuth Client ID — needs a Google Cloud project +
      OAuth consent screen configured (external, testing or published) and
      an OAuth 2.0 Client ID of type "Web application" with the site's
      origin(s) as authorized JavaScript origins.
- [ ] Facebook App ID + App Secret — needs a Meta developer app with
      "Facebook Login" product added, valid OAuth redirect/JS origins
      configured, and (for production use beyond the developer's own test
      users) App Review for the `public_profile`/`email` permissions.
- [ ] The founder's own email address(es) for the initial `ADMIN_EMAILS`
      allowlist value.
