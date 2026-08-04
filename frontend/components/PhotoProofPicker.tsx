"use client";

import { useEffect, useMemo, useState } from "react";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS = 5;

/** Multi-photo picker with a chosen "cover" photo, shared by the donor's
 * own proof-submission form and the volunteer's submit-on-behalf-of-donor
 * form. See specs/features/025-multi-photo-proof-with-cover/design.md. */
export function PhotoProofPicker({
  files,
  onFilesChange,
  coverIndex,
  onCoverIndexChange,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  coverIndex: number;
  onCoverIndexChange: (index: number) => void;
}) {
  const [error, setError] = useState("");

  const previews = useMemo(
    () => files.map((f) => URL.createObjectURL(f)),
    [files],
  );
  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  function handleAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;

    const oversize = picked.some((f) => f.size > MAX_UPLOAD_BYTES);
    if (oversize) {
      setError("Each photo must be under 10MB.");
    } else {
      setError("");
    }

    const accepted = picked.filter((f) => f.size <= MAX_UPLOAD_BYTES);
    const merged = [...files, ...accepted].slice(0, MAX_PHOTOS);
    if (files.length + accepted.length > MAX_PHOTOS) {
      setError((prev) =>
        prev
          ? `${prev} Only ${MAX_PHOTOS} photos are allowed — extra photos were skipped.`
          : `Only ${MAX_PHOTOS} photos are allowed — extra photos were skipped.`,
      );
    }
    onFilesChange(merged);
  }

  function handleRemove(index: number) {
    const next = files.filter((_, i) => i !== index);
    onFilesChange(next);
    if (index === coverIndex) {
      onCoverIndexChange(0);
    } else if (index < coverIndex) {
      onCoverIndexChange(coverIndex - 1);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Photo Proof
        <input
          type="file"
          name="photo"
          accept="image/*"
          multiple
          required={files.length === 0}
          onChange={handleAdd}
          className="px-1 py-2.5 text-sm"
        />
      </label>
      <p className="m-0 text-xs text-muted-2">
        Up to {MAX_PHOTOS} photos. Pick one as the cover — that&apos;s the
        photo shown wherever this delivery appears.
      </p>
      {error && <p className="m-0 text-xs text-red-700">{error}</p>}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {files.map((file, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`relative h-20 w-20 overflow-hidden rounded-xl border ${
                  i === coverIndex
                    ? "border-2 border-[var(--accent-green)]"
                    : "border-border"
                }`}
              >
                {previews[i] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previews[i]}
                    alt={`Photo ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute top-0.5 right-0.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-none bg-ink/70 text-xs leading-none text-ink-fg"
                >
                  ×
                </button>
                {i === coverIndex && (
                  <span className="absolute bottom-0 left-0 w-full bg-[var(--accent-green)] py-0.5 text-center text-[10px] font-bold text-ink-fg">
                    Cover
                  </span>
                )}
              </div>
              {i !== coverIndex && (
                <button
                  type="button"
                  onClick={() => onCoverIndexChange(i)}
                  className="cursor-pointer border-none bg-transparent p-0 text-[11px] font-bold text-muted-2 underline"
                >
                  Set as cover
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
