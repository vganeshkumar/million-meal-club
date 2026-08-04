# Feature: Required-Field Validation on Join In Submit — Design

## Backend (`app/models/domain.py`)
`SignupRequest`'s `model_validator` (currently `_validate_donor_fields`,
donor-only) widens to cover both modes — renamed
`_validate_required_fields`:
```python
@model_validator(mode="after")
def _validate_required_fields(self) -> Self:
    if self.mode == "donor":
        if self.packet_count is None:
            raise ValueError("packet_count is required when mode is 'donor'")
        if not self.delivery_role and not self.partner_charity:
            raise ValueError(
                "either delivery_role or partner_charity is required when "
                "mode is 'donor' — self-deliver, need a volunteer, or give "
                "through a partner charity are the three ways to deliver"
            )
        if not self.donor_story or not self.donor_story.strip():
            raise ValueError("donor_story is required when mode is 'donor'")
        if not self.commit_50k_4yr:
            raise ValueError("commit_50k_4yr must be true when mode is 'donor'")
        if not self.agree_publish_story:
            raise ValueError("agree_publish_story must be true when mode is 'donor'")
    else:
        if self.packets_per_trip is None:
            raise ValueError("packets_per_trip is required when mode is 'volunteer'")
        if not self.availability or not self.availability.strip():
            raise ValueError("availability is required when mode is 'volunteer'")
    return self
```
**Correction, 2026-08-04**: `delivery_role`/`partner_charity` is an
OR-group, not two independent checks — the first version of this
validator required `delivery_role` unconditionally, which was wrong (see
requirements.md). `location`/`country` are already non-optional model
fields (422 automatically if absent). `name`/`email` stay resolved and
validated in `app/routers/signups.py` (unchanged — they depend on session
state, not just the request body). `notes` gets no new checks (optional,
both modes).

## Frontend (`components/JoinInForm.tsx`)
- Add `required` to: the `packets`/donor packet-count input, the
  volunteer `capacity` input, the volunteer `availability` input. The
  `role` radio inputs and `partner_charity` select are **not** marked
  `required` — see below.
- Track form validity reactively instead of only gating at submit time:
  ```tsx
  const formRef = useRef<HTMLFormElement>(null);
  const [isValid, setIsValid] = useState(false);

  function recomputeValidity() {
    const form = formRef.current;
    if (!form) { setIsValid(false); return; }
    let valid = form.checkValidity();
    if (mode === "donor") {
      // delivery_role/partner_charity is an OR-group across a radio
      // group and a separate <select> — native `required` can't
      // express that, so it's checked here via FormData instead.
      const data = new FormData(form);
      const hasDeliveryRole = Boolean(data.get("role"));
      const hasPartnerCharity = Boolean(data.get("partner_charity"));
      valid = valid && (hasDeliveryRole || hasPartnerCharity);
    }
    setIsValid(valid);
  }

  useEffect(recomputeValidity, [mode, user]);
  // ...
  <form ref={formRef} onChange={recomputeValidity} ...>
  ```
  `onChange` (not `onInput`) is enough here — every field in this form is
  a native `<input>`/`<textarea>`/`<select>`, all of which bubble
  `change`; recomputing on every keystroke isn't needed since disabled
  state only needs to reflect "is it submittable right now," not live
  per-character feedback. The `useEffect` re-run on `[mode, user]`
  handles the two cases where the *set* of required fields changes
  without any single field's value changing (toggling donor/volunteer;
  the Name+Email pair appearing/disappearing based on sign-in state).
- Submit button: `disabled={status === "submitting" || !isValid}`.
- Field labels spell out the OR relationship rather than leaving it
  implicit: "Delivery role (required unless giving through a partner
  charity below)" / "...instead (required if no delivery role is picked
  above)."

### Mutual exclusivity — Correction, 2026-08-04
The "at least one" check above isn't the whole story: since only one
delivery method can be true, the form actively clears the other side
rather than just tolerating both being set. Both delivery-role radios and
the partner-charity `<select>` get refs and their own `onChange`,
independent of the whole-form `onChange={recomputeValidity}`:
```tsx
const selfRoleRef = useRef<HTMLInputElement>(null);
const volunteerRoleRef = useRef<HTMLInputElement>(null);
const partnerCharityRef = useRef<HTMLSelectElement>(null);

function handleDeliveryRoleChange() {
  if (partnerCharityRef.current) partnerCharityRef.current.value = "";
}

function handlePartnerCharityChange(e: React.ChangeEvent<HTMLSelectElement>) {
  if (!e.target.value) return;
  if (selfRoleRef.current) selfRoleRef.current.checked = false;
  if (volunteerRoleRef.current) volunteerRoleRef.current.checked = false;
}
```
Each radio's `onChange={handleDeliveryRoleChange}`; the select's
`onChange={handlePartnerCharityChange}`. Programmatically setting
`.value`/`.checked` doesn't dispatch another native `change` event, so
there's no risk of a feedback loop; React's synthetic bubble dispatch
still invokes these target-level handlers before the form-level
`onChange={recomputeValidity}` fires (same underlying native event), so
`recomputeValidity` always sees the post-mutation DOM state without an
extra manual call.

## Tests
- Backend (`backend/tests/test_signups.py`, pytest): valid donor payload
  succeeds; donor payload missing `packet_count` → 422 with a message
  naming the field; valid volunteer payload succeeds; volunteer payload
  missing `packets_per_trip`/`availability` → 422. Existing donor_story/
  checkbox 422 cases stay covered too (renamed validator, same behavior).
  `delivery_role`/`partner_charity` OR-group: valid with only
  `partner_charity` set (no `delivery_role`); valid with only
  `delivery_role` set (no `partner_charity`); 422 when both are absent,
  naming both fields.
- Frontend (`frontend/e2e/required-field-validation.spec.ts`, Playwright):
  in both modes, submit button starts disabled; filling every required
  field enables it; clearing one required field (e.g. unchecking a
  donor-mode checkbox, or blanking Availability in volunteer mode)
  disables it again; the two explicitly-optional volunteer fields (Prior
  Volunteering Experience, Donor References) being empty never blocks
  submission; a donor picking only a partner charity (no delivery role)
  can submit, and vice versa.
