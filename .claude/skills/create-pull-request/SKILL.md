---
name: create-pull-request
description: Creates a GitHub pull request for the current branch with a structured body covering (1) a description of the change, (2) the files that changed, and (3) a quality summary spanning test coverage, code quality, and security posture. Use when asked to create, open, submit, or put up a pull request/PR.
---

# Create a pull request with a quality summary

This produces a PR body with **exactly three sections**, in this order —
not the generic "Summary / Test plan" shape used elsewhere. Follow this
template regardless of how small the change is; keep each section honest
rather than padded (a "none" or "not applicable" line is a valid, useful
answer).

## 1. Gather context

Run in parallel:
- `git status` (never `-uall`)
- `git diff` (staged + unstaged) and `git diff --stat`
- Detect the base branch (`git symbolic-ref refs/remotes/origin/HEAD` or
  fall back to `main`/`master`) and run `git log <base>...HEAD` plus
  `git diff <base>...HEAD --stat` to see the **full** set of commits and
  files this PR will contain, not just the latest commit
- Check whether the branch tracks a remote and whether it's already pushed

If there are uncommitted changes the user hasn't asked to commit, stop and
ask rather than committing on their behalf — this skill assumes the branch
is already in the state the user wants shipped.

## 2. Draft the PR body

Use this exact structure:

```markdown
## Description
<1 short paragraph or a few bullets: what changed and why, in plain
language a reviewer can read without opening the diff first. Pull the
"why" from commit messages, not just the "what" from the diff.>

## Files Changed
<Grouped list, not a raw `git diff --stat` dump — cluster by area (e.g.
backend/frontend/infra/specs, or by feature) and add a one-line note per
file or group where the filename alone doesn't say enough:
- `path/to/file.py` — one-line note on what changed and why, if non-obvious
- ...>

## Quality Summary

**Test coverage**
<Concretely check, don't assume:
- Does this repo have an automated test suite at all (search for
  `tests/`, `*_test.py`, `test_*.py`, `*.test.ts(x)`, `*.spec.ts(x)`, a
  `test` script in package.json, pytest/jest/vitest config)? If none
  exists, say so plainly ("no automated test suite exists in this repo")
  rather than fabricating a coverage percentage.
- If tests exist, run them (or the relevant subset) and report actual
  pass/fail counts — don't claim coverage you haven't verified.
- Call out any new/changed code paths in this diff that have no
  corresponding test, and whether that's a real gap or low-risk (e.g. a
  config/docs-only change).>

**Code quality**
<Run whatever this repo already has configured — linters, type checkers,
`terraform fmt`/`validate`, build — and report results plainly (clean vs.
N warnings/errors, with the gist of what they are). Note anything in the
diff itself worth a reviewer's attention: duplicated logic, naming
inconsistent with surrounding code, obvious complexity that could be
simplified, dead code left behind. Keep it to what's actually true of
this diff — don't pad with generic praise.>

**Security posture**
<Review the diff specifically for:
- New or changed endpoints/handlers — do they have the same
  authn/authz checks as equivalent existing ones? Any new way to bypass
  an existing check?
- Input validation on anything user-controlled; injection risk (SQL,
  command, template, XSS) in any new query/exec/render path.
- Secrets, credentials, or tokens — none should be hardcoded or logged.
- Dependency changes — any new package or version bump, and whether it's
  from a pinned/lockfile-controlled source.
- Infra/IAM changes — least-privilege maintained (no new wildcard
  permissions), no new public exposure of previously private resources.
State "no security-relevant changes" plainly when that's actually true —
don't invent concerns to fill the section.>
```

## 3. Create the PR

- Push the branch (`-u` if it doesn't track a remote yet) — confirm with
  the user first if the branch has never been pushed, since that's the
  first time this work becomes visible outside their machine.
- `gh pr create --title "<short, imperative, <70 chars>" --body "$(cat
  <<'EOF' ... EOF)"` using the exact template above, filled in for real
  (no placeholder text left in).
- Report the PR URL back.

## Notes
- Keep the PR title separate from the body — details belong in the body,
  not stuffed into the title.
- If `gh` isn't authenticated or the repo has no GitHub remote, say so and
  stop rather than guessing a URL.
- This skill only opens the PR; it doesn't merge, doesn't force-push, and
  doesn't touch branch protection settings.
