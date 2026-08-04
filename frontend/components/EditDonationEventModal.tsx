"use client";

import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { AddressMapPreview } from "@/components/AddressMapPreview";
import type { DonationEvent, PartnerCharity, VolunteerSummary } from "@/lib/types";

const fieldClass =
  "rounded-[10px] border border-border-strong bg-bg px-3.5 py-3 text-[15px] font-body";
const labelClass = "flex flex-col gap-1.5 text-[13px] font-bold";

export function EditDonationEventModal({
  event,
  partnerCharities,
  volunteers,
  canAssignVolunteer,
  canCancel,
  onClose,
  onSaved,
}: {
  event: DonationEvent;
  partnerCharities: PartnerCharity[];
  volunteers: VolunteerSummary[];
  canAssignVolunteer: boolean;
  canCancel: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addressInput, setAddressInput] = useState(event.location);
  const [deliveryRole, setDeliveryRole] = useState<
    "self" | "volunteer_needed" | ""
  >(event.deliveryRole ?? "");
  const selfRoleRef = useRef<HTMLInputElement>(null);
  const volunteerRoleRef = useRef<HTMLInputElement>(null);
  const partnerCharityRef = useRef<HTMLSelectElement>(null);

  // Delivery role and partner charity are mutually exclusive, matching
  // ScheduleDonationSection's create form — picking one clears the other.
  function handleDeliveryRoleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDeliveryRole(e.target.value as "self" | "volunteer_needed");
    if (partnerCharityRef.current) partnerCharityRef.current.value = "";
  }

  function handlePartnerCharityChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (!e.target.value) return;
    if (selfRoleRef.current) selfRoleRef.current.checked = false;
    if (volunteerRoleRef.current) volunteerRoleRef.current.checked = false;
    setDeliveryRole("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setSaving(true);
    setError("");
    try {
      await api.updateDonationEvent(event.id, {
        location: String(data.get("location") ?? ""),
        date: String(data.get("date") ?? ""),
        start_time: String(data.get("start_time") ?? ""),
        end_time: String(data.get("end_time") ?? ""),
        packet_count: data.get("packet_count")
          ? Number(data.get("packet_count"))
          : undefined,
        delivery_role:
          (data.get("delivery_role") as "self" | "volunteer_needed" | null) ??
          undefined,
        partner_charity: (data.get("partner_charity") as string) || undefined,
        notes: (data.get("notes") as string) || undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 400
          ? "End time must be after start time."
          : "Couldn't save your changes. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign(volunteerId: string) {
    setError("");
    try {
      await api.assignDonationEventVolunteer(event.id, volunteerId || null);
      onSaved();
    } catch {
      setError("Couldn't update the assigned volunteer. Please try again.");
    }
  }

  async function handleCancel() {
    setError("");
    try {
      await api.cancelDonationEvent(event.id);
      onSaved();
      onClose();
    } catch {
      setError("Couldn't cancel that donation event. Please try again.");
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[200] bg-modal-backdrop"
      />
      <div className="fixed top-1/2 left-1/2 z-[201] flex max-h-[90vh] w-[min(520px,90vw)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-3xl bg-card p-[clamp(24px,3vw,32px)] shadow-[0_24px_60px_oklch(21%_0.03_155_/_0.25)]">
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 font-display text-lg font-bold">
            Edit Donation Event
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-none bg-transparent p-1 text-[22px] leading-none text-muted-2"
          >
            ×
          </button>
        </div>

        <form
          data-testid="edit-donation-event-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-3"
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
            <label className={labelClass}>
              Exact Address
              <input
                type="text"
                name="location"
                defaultValue={event.location}
                required
                onChange={(e) => setAddressInput(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Date
              <input
                type="date"
                name="date"
                defaultValue={event.date}
                required
                className={fieldClass}
              />
            </label>
          </div>
          <AddressMapPreview
            address={addressInput}
            initialLat={event.latitude}
            initialLon={event.longitude}
          />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
            <label className={labelClass}>
              Start Time
              <input
                type="time"
                name="start_time"
                defaultValue={event.startTime}
                required
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              End Time
              <input
                type="time"
                name="end_time"
                defaultValue={event.endTime}
                required
                className={fieldClass}
              />
            </label>
          </div>
          <label className={labelClass}>
            Number of Food Packets (optional)
            <input
              type="number"
              name="packet_count"
              min={1}
              defaultValue={event.packetCount ?? ""}
              className={fieldClass}
            />
          </label>
          <div className="flex flex-col gap-2 text-[13px] font-bold">
            How will this delivery happen? (optional)
            <label className="flex items-center gap-2 text-[15px] font-medium">
              <input
                ref={selfRoleRef}
                type="radio"
                name="delivery_role"
                value="self"
                defaultChecked={event.deliveryRole === "self"}
                onChange={handleDeliveryRoleChange}
              />{" "}
              I&apos;ll deliver it myself
            </label>
            <label className="flex items-center gap-2 text-[15px] font-medium">
              <input
                ref={volunteerRoleRef}
                type="radio"
                name="delivery_role"
                value="volunteer_needed"
                defaultChecked={event.deliveryRole === "volunteer_needed"}
                onChange={handleDeliveryRoleChange}
              />{" "}
              A volunteer will collect &amp; deliver
            </label>
            {canAssignVolunteer && deliveryRole === "volunteer_needed" && (
              <label className={`${labelClass} ml-6`}>
                Assigned volunteer
                <select
                  defaultValue={event.volunteerId ?? ""}
                  onChange={(e) => handleAssign(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">— Unassigned —</option>
                  {volunteers.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.country})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label className={labelClass}>
            Delivered through a partner charity instead? (optional)
            <select
              ref={partnerCharityRef}
              name="partner_charity"
              defaultValue={event.partnerCharity ?? ""}
              onChange={handlePartnerCharityChange}
              className={fieldClass}
            >
              <option value="">— None —</option>
              {partnerCharities.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Notes (optional)
            <textarea
              name="notes"
              rows={2}
              defaultValue={event.notes ?? ""}
              className={`${fieldClass} resize-y`}
            />
          </label>
          {error && <p className="m-0 text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer self-start rounded-full border-none bg-[var(--accent-green)] px-5 py-2.5 text-sm font-bold text-ink-fg disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>

        {canCancel && (
          <button
            type="button"
            onClick={handleCancel}
            className="cursor-pointer self-start rounded-full border border-border-strong bg-transparent px-4 py-2 text-xs font-bold text-ink"
          >
            Cancel Event
          </button>
        )}
      </div>
    </>
  );
}
