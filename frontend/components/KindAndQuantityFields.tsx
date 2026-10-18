"use client";

// Shared "pick a donation kind, or type a new one" + quantity field pair —
// used at signup, donation-event scheduling, and proof submission. See
// specs/features/034-donation-kinds-and-quantity/design.md. A plain
// <input list> + <datalist> combo-box, consistent with this app's
// preference for native form elements over a picker library.

const fieldClass =
  "rounded-[10px] border border-border-strong bg-bg px-3.5 py-3 text-[15px] font-body";
const labelClass = "flex flex-col gap-1.5 text-[13px] font-bold";

type KindAndQuantityFieldsProps = {
  kinds: string[];
  datalistId: string;
  kindDefaultValue?: string;
  quantityDefaultValue?: number;
  required?: boolean;
  readOnly?: boolean;
  kindLabel?: string;
  quantityLabel?: string;
};

export function KindAndQuantityFields({
  kinds,
  datalistId,
  kindDefaultValue,
  quantityDefaultValue,
  required = false,
  readOnly = false,
  kindLabel = "Kind of Donation",
  quantityLabel = "Quantity (people/lives benefited)",
}: KindAndQuantityFieldsProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
      <label className={labelClass}>
        {kindLabel}
        <input
          type="text"
          name="kind"
          list={datalistId}
          defaultValue={kindDefaultValue}
          required={required}
          readOnly={readOnly}
          placeholder="Food Packets"
          className={fieldClass}
        />
        <datalist id={datalistId}>
          {kinds.map((kind) => (
            <option key={kind} value={kind} />
          ))}
        </datalist>
      </label>
      <label className={labelClass}>
        {quantityLabel}
        <input
          type="number"
          name="quantity"
          min={1}
          defaultValue={quantityDefaultValue}
          required={required}
          readOnly={readOnly}
          className={fieldClass}
        />
      </label>
    </div>
  );
}
