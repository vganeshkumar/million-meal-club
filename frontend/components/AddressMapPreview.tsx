"use client";

import { useEffect, useState } from "react";
import { geocodePreview, hasStaticMap, staticMapUrl } from "@/lib/staticMap";

// Live map preview shown in the same panel as the address field, both
// when scheduling a new event and when viewing/editing an existing one —
// see specs/features/023-event-location-time-and-sharing/requirements.md.
export function AddressMapPreview({
  address,
  initialLat,
  initialLon,
}: {
  address: string;
  initialLat?: number | null;
  initialLon?: number | null;
}) {
  const hasInitialCoords = initialLat != null && initialLon != null;
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    hasInitialCoords ? { lat: initialLat, lon: initialLon } : null,
  );
  // The address string `coords` is currently accurate for — re-geocode
  // whenever the field's value drifts from this. Left blank when there
  // are no initial coords, so a pre-filled-but-never-geocoded address
  // (e.g. geocoding failed at scheduling time) gets retried on mount.
  const [geocodedFor, setGeocodedFor] = useState(hasInitialCoords ? address : "");

  useEffect(() => {
    if (!hasStaticMap() || !address.trim() || address === geocodedFor) return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      const result = await geocodePreview(address);
      if (!cancelled) {
        setCoords(result);
        setGeocodedFor(address);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [address, geocodedFor]);

  if (!hasStaticMap() || !address.trim() || !coords) return null;

  return (
    <div className="h-40 w-full overflow-hidden rounded-2xl border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={staticMapUrl(coords.lat, coords.lon)}
        alt="Map preview of the entered address"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
