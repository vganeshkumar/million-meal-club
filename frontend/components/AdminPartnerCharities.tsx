"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PartnerCharity } from "@/lib/types";
import { StatusBadge, ToggleButton } from "@/components/AdminDirectory";

const fieldClass =
  "rounded-[10px] border border-border-strong bg-bg px-3.5 py-3 text-[15px] font-body";
const labelClass = "flex flex-col gap-1.5 text-[13px] font-bold";

type CharityFormFields = {
  name: string;
  location: string;
  description: string;
  core_services?: string;
  founder_details?: string;
  years_active?: string;
  awards_credentials?: string;
  website_url?: string;
  donation_url?: string;
  tax_refund_eligible?: boolean;
};

function readForm(form: FormData): CharityFormFields {
  const taxRefundEligible = form.get("tax_refund_eligible");
  return {
    name: String(form.get("name") ?? ""),
    location: String(form.get("location") ?? ""),
    description: String(form.get("description") ?? ""),
    core_services: (form.get("core_services") as string) || undefined,
    founder_details: (form.get("founder_details") as string) || undefined,
    years_active: (form.get("years_active") as string) || undefined,
    awards_credentials: (form.get("awards_credentials") as string) || undefined,
    website_url: (form.get("website_url") as string) || undefined,
    donation_url: (form.get("donation_url") as string) || undefined,
    tax_refund_eligible:
      taxRefundEligible === "yes"
        ? true
        : taxRefundEligible === "no"
          ? false
          : undefined,
  };
}

function CharityFields({ defaults }: { defaults?: PartnerCharity }) {
  return (
    <>
      <label className={labelClass}>
        Name
        <input
          type="text"
          name="name"
          required
          defaultValue={defaults?.name}
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        Location
        <input
          type="text"
          name="location"
          required
          defaultValue={defaults?.location}
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        Brief summary of the charity
        <textarea
          name="description"
          rows={3}
          required
          defaultValue={defaults?.description}
          className={`${fieldClass} resize-y`}
        />
      </label>
      <label className={labelClass}>
        Core services
        <textarea
          name="core_services"
          rows={3}
          required
          placeholder="What they actually do, day to day"
          defaultValue={defaults?.coreServices}
          className={`${fieldClass} resize-y`}
        />
      </label>
      <label className={labelClass}>
        Founder details (optional)
        <textarea
          name="founder_details"
          rows={2}
          placeholder="Who founded it, and any background worth sharing"
          defaultValue={defaults?.founderDetails}
          className={`${fieldClass} resize-y`}
        />
      </label>
      <label className={labelClass}>
        How long have they been around? (optional)
        <input
          type="text"
          name="years_active"
          placeholder="e.g. Since 1998, or 25+ years"
          defaultValue={defaults?.yearsActive}
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        Awards / credentials (optional)
        <textarea
          name="awards_credentials"
          rows={2}
          defaultValue={defaults?.awardsCredentials}
          className={`${fieldClass} resize-y`}
        />
      </label>
      <div className={labelClass}>
        Eligible for tax refund? (optional)
        <div className="flex gap-5 text-sm font-normal">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="tax_refund_eligible"
              value="yes"
              defaultChecked={defaults?.taxRefundEligible === true}
            />
            Yes
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="tax_refund_eligible"
              value="no"
              defaultChecked={defaults?.taxRefundEligible === false}
            />
            No
          </label>
        </div>
      </div>
      <label className={labelClass}>
        Website link (optional)
        <input
          type="url"
          name="website_url"
          placeholder="https://…"
          defaultValue={defaults?.websiteUrl}
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        Donation link (optional)
        <input
          type="url"
          name="donation_url"
          placeholder="https://…"
          defaultValue={defaults?.donationUrl}
          className={fieldClass}
        />
      </label>
    </>
  );
}

export function AdminPartnerCharities() {
  const [charities, setCharities] = useState<PartnerCharity[] | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function refresh() {
    api
      .listAllPartnerCharities()
      .then(setCharities)
      .catch(() => setError("Couldn't load partner charities."));
  }

  useEffect(refresh, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const created = await api.createPartnerCharity(
        readForm(new FormData(e.currentTarget)),
      );
      setCharities((prev) => [created, ...(prev ?? [])]);
      formRef.current?.reset();
    } catch {
      setFormError("Couldn't add that partner charity. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit(
    id: string,
    e: React.FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const updated = await api.updatePartnerCharity(
        id,
        readForm(new FormData(e.currentTarget)),
      );
      setCharities(
        (prev) => prev?.map((c) => (c.id === id ? updated : c)) ?? null,
      );
      setEditingId(null);
    } catch {
      setFormError("Couldn't save those changes. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(charity: PartnerCharity) {
    setTogglingId(charity.id);
    try {
      if (charity.status === "active") {
        await api.disablePartnerCharity(charity.id);
      } else {
        await api.reactivatePartnerCharity(charity.id);
      }
      setCharities(
        (prev) =>
          prev?.map((c) =>
            c.id === charity.id
              ? { ...c, status: c.status === "active" ? "disabled" : "active" }
              : c,
          ) ?? null,
      );
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <h1 className="mt-0 mb-6 font-display text-2xl font-extrabold">
        Charity Partners
      </h1>

      <form
        ref={formRef}
        onSubmit={handleCreate}
        className="mb-8 flex flex-col gap-4 rounded-3xl border border-border bg-card p-[clamp(24px,3vw,40px)]"
      >
        <CharityFields />

        {formError && !editingId && (
          <p className="m-0 text-sm text-red-700">{formError}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 cursor-pointer rounded-full border-none bg-[var(--accent-green)] py-4 text-base font-bold text-ink-fg disabled:opacity-60"
        >
          {submitting ? "Adding…" : "Add Charity Partner"}
        </button>
      </form>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {charities === null && !error && (
        <p className="text-sm text-muted">Loading…</p>
      )}
      {charities?.length === 0 && (
        <p className="text-sm text-muted">No partner charities yet.</p>
      )}
      <div className="flex flex-col gap-4">
        {charities?.map((c) =>
          editingId === c.id ? (
            <form
              key={c.id}
              onSubmit={(e) => handleSaveEdit(c.id, e)}
              className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-6"
            >
              <CharityFields defaults={c} />
              {formError && (
                <p className="m-0 text-sm text-red-700">{formError}</p>
              )}
              <div className="flex gap-2.5">
                <button
                  type="submit"
                  disabled={submitting}
                  className="cursor-pointer rounded-full border-none bg-[var(--accent-green)] px-5 py-2.5 text-sm font-bold text-ink-fg disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setFormError("");
                  }}
                  className="cursor-pointer rounded-full border border-border-strong bg-transparent px-5 py-2.5 text-sm font-bold text-ink"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div
              key={c.id}
              data-testid="charity-card"
              className="rounded-[20px] border border-border bg-card p-6"
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="m-0 text-base font-bold">{c.name}</p>
                  <StatusBadge status={c.status} />
                </div>
                <p className="m-0 text-sm text-muted-2">{c.location}</p>
              </div>
              <p className="m-0 mb-2 text-sm leading-[1.6] text-muted">
                {c.description}
              </p>
              {c.yearsActive && (
                <p className="m-0 text-[13px] font-bold text-muted-2">
                  {c.yearsActive}
                </p>
              )}
              {c.awardsCredentials && (
                <p className="m-0 mt-1 text-[13px] text-muted-2">
                  {c.awardsCredentials}
                </p>
              )}
              <div className="mt-2 flex gap-4 text-[13px] font-bold">
                {c.websiteUrl && (
                  <a
                    href={c.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--accent-green)]"
                  >
                    Website
                  </a>
                )}
                {c.donationUrl && (
                  <a
                    href={c.donationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--accent-green)]"
                  >
                    Donate
                  </a>
                )}
              </div>
              <div className="mt-4 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(c.id);
                    setFormError("");
                  }}
                  className="cursor-pointer rounded-full border border-border-strong bg-transparent px-5 py-2.5 text-sm font-bold text-ink"
                >
                  Edit
                </button>
                <ToggleButton
                  status={c.status}
                  pending={togglingId === c.id}
                  onClick={() => handleToggle(c)}
                />
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
