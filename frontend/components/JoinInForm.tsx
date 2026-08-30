"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { COUNTRIES } from "@/lib/countries";
import type { AuthUser, JoinMode, PartnerCharity } from "@/lib/types";

type JoinInFormProps = {
  user: AuthUser | null;
  partnerCharities: PartnerCharity[];
};

const fieldClass =
  "rounded-[10px] border border-border-strong bg-bg px-3.5 py-3 text-[15px] font-body";
const labelClass = "flex flex-col gap-1.5 text-[13px] font-bold";

export function JoinInForm({ user, partnerCharities }: JoinInFormProps) {
  const [mode, setMode] = useState<JoinMode>("donor");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const [isValid, setIsValid] = useState(false);
  const selfRoleRef = useRef<HTMLInputElement>(null);
  const volunteerRoleRef = useRef<HTMLInputElement>(null);
  const partnerCharityRef = useRef<HTMLSelectElement>(null);

  // Delivery role and partner charity are mutually exclusive, not just
  // an OR-group at submit time (see recomputeValidity below) — picking
  // one clears the other, since only one delivery method applies.
  function handleDeliveryRoleChange() {
    if (partnerCharityRef.current) partnerCharityRef.current.value = "";
  }

  function handlePartnerCharityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!e.target.value) return;
    if (selfRoleRef.current) selfRoleRef.current.checked = false;
    if (volunteerRoleRef.current) volunteerRoleRef.current.checked = false;
  }

  function recomputeValidity() {
    const form = formRef.current;
    if (!form) {
      setIsValid(false);
      return;
    }
    let valid = form.checkValidity();
    if (mode === "donor") {
      // delivery_role and partner_charity aren't each independently
      // required — self-deliver, need-a-volunteer, and via-a-partner-
      // charity are three mutually exclusive ways to describe delivery,
      // and at least one of the three must be picked. Native `required`
      // can't express that OR across a radio group and a separate
      // select, so it's checked here instead of via checkValidity().
      const data = new FormData(form);
      const hasDeliveryRole = Boolean(data.get("role"));
      const hasPartnerCharity = Boolean(data.get("partner_charity"));
      valid = valid && (hasDeliveryRole || hasPartnerCharity);
    }
    setIsValid(valid);
  }

  // The *set* of required fields changes when the mode toggles (donor vs
  // volunteer) or when sign-in state flips the Name+Email fields in/out —
  // neither of those is itself a field value changing, so they need their
  // own recompute beyond the form's onChange below. Runs after the DOM
  // reflects the new field set (effect, not render-time).
  useEffect(recomputeValidity, [mode, user]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");
    const form = new FormData(e.currentTarget);
    try {
      await api.submitSignup({
        mode,
        name: user ? undefined : String(form.get("name") ?? ""),
        email: !user ? String(form.get("email") ?? "") : undefined,
        location: String(form.get("location") ?? ""),
        country: String(form.get("country") ?? ""),
        notes: (form.get("notes") as string) || undefined,
        packet_count:
          mode === "donor" && form.get("packets")
            ? Number(form.get("packets"))
            : undefined,
        delivery_role:
          mode === "donor"
            ? (form.get("role") as "self" | "volunteer_needed" | null) ??
              undefined
            : undefined,
        partner_charity:
          mode === "donor"
            ? (form.get("partner_charity") as string) || undefined
            : undefined,
        donor_story:
          mode === "donor"
            ? (form.get("donor_story") as string) || undefined
            : undefined,
        commit_50k_4yr: mode === "donor" ? form.get("commit_50k_4yr") === "on" : undefined,
        agree_publish_story:
          mode === "donor" ? form.get("agree_publish_story") === "on" : undefined,
        packets_per_trip:
          mode === "volunteer" && form.get("capacity")
            ? Number(form.get("capacity"))
            : undefined,
        availability:
          mode === "volunteer"
            ? (form.get("availability") as string) || undefined
            : undefined,
        volunteering_history:
          mode === "volunteer"
            ? (form.get("volunteering_history") as string) || undefined
            : undefined,
        references:
          mode === "volunteer"
            ? (form.get("references") as string) || undefined
            : undefined,
      });
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof ApiError
          ? `Couldn't submit (${err.status}). Please try again.`
          : "Couldn't reach the server. Please try again.",
      );
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-[clamp(24px,3vw,40px)] text-center">
        <p className="m-0 text-lg font-bold text-[var(--accent-green)]">
          Application received!
        </p>
        <p className="m-0 text-sm text-muted">
          The founder will personally follow up with next steps.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onChange={recomputeValidity}
      className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-[clamp(24px,3vw,40px)]"
    >
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => setMode("donor")}
          className={`flex-1 cursor-pointer rounded-full border px-3 py-3 text-[14.5px] font-bold ${
            mode === "donor"
              ? "border-[var(--accent-green)] bg-[var(--accent-green)] text-ink-fg"
              : "border-border-strong bg-transparent text-muted"
          }`}
        >
          Apply As A Donor
        </button>
        <button
          type="button"
          onClick={() => setMode("volunteer")}
          className={`flex-1 cursor-pointer rounded-full border px-3 py-3 text-[14.5px] font-bold ${
            mode === "volunteer"
              ? "border-[var(--accent-green)] bg-[var(--accent-green)] text-ink-fg"
              : "border-border-strong bg-transparent text-muted"
          }`}
        >
          Volunteer To Deliver
        </button>
      </div>

      {user ? (
        <div className="flex items-center justify-between gap-2.5 rounded-[10px] bg-green-soft px-3.5 py-2.5">
          <span className="text-sm font-bold text-[var(--accent-green)]">
            Signed in as {user.name}
          </span>
        </div>
      ) : (
        <>
          <label className={labelClass}>
            Name
            <input type="text" name="name" required className={fieldClass} />
          </label>
          <label className={labelClass}>
            Email
            <input
              type="email"
              name="email"
              required
              className={fieldClass}
            />
          </label>
        </>
      )}

      <label className={labelClass}>
        Location / City
        <input type="text" name="location" required className={fieldClass} />
      </label>

      <label className={labelClass}>
        Country
        <select name="country" required defaultValue="United States" className={fieldClass}>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      {mode === "donor" ? (
        <>
          <div className="rounded-xl bg-green-soft px-4 py-3.5 text-[13.5px] leading-[1.6] font-semibold text-[var(--accent-green)]">
            Donors are by invitation only and commit to delivering a minimum
            of 10,000 meals within 5 years of joining.
          </div>
          <label className={labelClass}>
            Number of Food Packets (to start)
            <input
              type="number"
              name="packets"
              min={1}
              required
              className={fieldClass}
            />
          </label>
          <div className="flex flex-col gap-2 text-[13px] font-bold">
            Delivery role (required unless giving through a partner charity
            below)
            <label className="flex items-center gap-2 text-[15px] font-medium">
              <input
                ref={selfRoleRef}
                type="radio"
                name="role"
                value="self"
                onChange={handleDeliveryRoleChange}
              />{" "}
              I&apos;ll deliver it myself
            </label>
            <label className="flex items-center gap-2 text-[15px] font-medium">
              <input
                ref={volunteerRoleRef}
                type="radio"
                name="role"
                value="volunteer_needed"
                onChange={handleDeliveryRoleChange}
              />{" "}
              I need a volunteer to collect &amp; deliver
            </label>
          </div>
          <label className={labelClass}>
            Not sure of a location? Give through a partner charity instead
            (required if no delivery role is picked above)
            <select
              ref={partnerCharityRef}
              name="partner_charity"
              onChange={handlePartnerCharityChange}
              className={fieldClass}
            >
              <option value="">— None, I have my own location —</option>
              {partnerCharities.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Your Donor Story — why are you joining this cause?
            <textarea
              name="donor_story"
              rows={4}
              required
              className={`${fieldClass} resize-y`}
            />
          </label>
          <label className="flex items-start gap-2.5 text-sm leading-[1.5] font-medium">
            <input
              type="checkbox"
              name="commit_50k_4yr"
              required
              className="mt-1"
            />
            I commit to delivering at least 10,000 meals within 5 years of
            joining as a donor.
          </label>
          <label className="flex items-start gap-2.5 text-sm leading-[1.5] font-medium">
            <input
              type="checkbox"
              name="agree_publish_story"
              required
              className="mt-1"
            />
            I agree to have my story, name, and photos published on this
            site to inspire other donors.
          </label>
        </>
      ) : (
        <>
          <label className={labelClass}>
            Packets You Can Handle Per Trip
            <input
              type="number"
              name="capacity"
              min={1}
              required
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Availability
            <input
              type="text"
              name="availability"
              placeholder="e.g. weekends, evenings, flexible"
              required
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Prior Volunteering Experience (optional)
            <textarea
              name="volunteering_history"
              rows={3}
              placeholder="Have you volunteered with us or elsewhere before? Tell us about it."
              className={`${fieldClass} resize-y`}
            />
          </label>
          <label className={labelClass}>
            Donor References (optional)
            <textarea
              name="references"
              rows={2}
              placeholder="Name and contact info for any donors who can vouch for you"
              className={`${fieldClass} resize-y`}
            />
          </label>
        </>
      )}

      <label className={labelClass}>
        Notes (optional)
        <textarea name="notes" rows={3} className={`${fieldClass} resize-y`} />
      </label>

      {status === "error" && (
        <p className="m-0 text-sm text-red-700">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={status === "submitting" || !isValid}
        className="mt-2 cursor-pointer rounded-full border-none bg-[var(--accent-green)] py-4 text-base font-bold text-ink-fg disabled:opacity-60"
      >
        {status === "submitting"
          ? "Submitting…"
          : mode === "volunteer"
            ? "Submit Volunteer Application"
            : "Submit Donor Application"}
      </button>
      <p className="m-0 text-center text-[12.5px] text-muted-3">
        {mode === "donor"
          ? "This is an application, not an instant sign-up — donor spots are limited and reviewed by invitation."
          : "This is an application, not an instant sign-up — new volunteers are reviewed before being linked to your account."}
      </p>
    </form>
  );
}
