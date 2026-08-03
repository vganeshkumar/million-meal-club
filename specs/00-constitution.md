# Constitution

Non-negotiable guardrails for this project. Changing any of these is a deliberate
architectural decision, not an incidental one — if you're about to violate one,
stop and update this file first (with reasoning), then proceed.

## 1. Static-first frontend
The public site is a statically-exported Next.js app (`output: 'export'`). No
Node/SSR server runs in production. Anything that needs to happen at request
time (donor list, meal counts, form submission, auth) goes through `/api/*`,
not through Next.js server code.

## 2. Serverless-only compute
No always-on servers or containers (no EC2, no ECS/Fargate, no RDS instances).
The backend is a single Lambda function (FastAPI + Mangum) behind API Gateway
HTTP API. If a future requirement can't fit serverless compute, that's a
conversation to have explicitly — don't quietly reach for a box that runs 24/7.

## 3. Pay-per-use data, not idle capacity
DynamoDB tables are **on-demand** billing mode, always. Never switch to
provisioned capacity "for cost predictability" — on-demand is cheaper at this
app's traffic level and has zero idle cost, which matters more than predictability
for a volunteer-run charity site.

## 4. OAuth-only authentication
No username/password system, no password database, no email/password reset
flows. Google and Facebook are the only sign-in methods (Instagram is a footer
follow-link only, not a sign-in option — see `specs/01-architecture.md` for why).
The founder should never have to think about credential storage or resets.

**One narrow, explicit exception**: a hardcoded `dummy_user`/
`dummy_password` local-only login (`POST /api/auth/dummy`, credentials
changed from the original `dummy`/`dummy` — see
`specs/features/008-persona-dashboards-and-roles/design.md`), with a role
picker (admin / donor / volunteer), added so the founder can test any of
the three personas' screens without real Google/Facebook OAuth
credentials. It is gated behind `ENABLE_DUMMY_LOGIN=true`, an env var
**never set by Terraform or any deployed environment** — only ever
exported by hand for local `uvicorn`. If this gate is ever removed or made
easier to accidentally enable in a deployed env, that's a constitution
violation, not a minor bug.

Real user-facing donor/volunteer identity is still OAuth-only, no exception
there — the exception is scoped strictly to local testing of all three
personas' screens, admin included.

## 5. Manual approval before any meal count changes
Meal totals, donor totals, and the public gallery are **never** auto-incremented
by a form submission. A submission always lands in a pending state; only an
explicit founder approval action moves it into the public counts. This is a
product requirement from the original design brief, not just a technical
default — preserve it even if it seems like unnecessary friction.

## 6. Terraform is the sole source of infra truth
No console click-ops for anything Terraform manages. If something was changed
by hand in the AWS console for an emergency fix, the very next task is to
reflect that change in Terraform and re-apply, so state doesn't drift.

## 7. Least-privilege IAM
The Lambda execution role gets exactly the permissions it needs (specific
table ARNs, specific bucket/prefix ARNs) — never `*` resource or action
wildcards as a shortcut.

## 8. `terraform apply` is a human action
Nobody (including an AI agent) runs `terraform apply` against real AWS
credentials without the user explicitly asking for that specific apply, in
that moment. Generating, formatting, validating, and planning Terraform is
fine to do proactively; applying is not.

## 9. specs/ before code, for anything cross-cutting
A change that touches more than one of `frontend/` / `backend/` / `infra/`
gets a feature spec under `specs/features/` (or an update to an existing one)
before implementation starts. Pure single-folder bugfixes/polish don't need a
new spec.
