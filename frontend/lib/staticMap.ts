// No Google Maps API key is provisioned (same situation as OAuth
// credentials) — locations render as a static map image via Geoapify's
// free-tier Static Maps API instead of an interactive Google Map. Until
// NEXT_PUBLIC_GEOAPIFY_API_KEY is set, hasStaticMap() is false and callers
// fall back to plain address text (same "not configured" pattern as
// Google/Facebook sign-in — see frontend/lib/auth.ts). See
// specs/features/023-event-location-time-and-sharing/design.md.

const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY ?? "";

export function hasStaticMap(): boolean {
  return GEOAPIFY_API_KEY !== "";
}

export function staticMapUrl(lat: number, lon: number): string {
  return (
    "https://maps.geoapify.com/v1/staticmap" +
    "?style=osm-carto&width=600&height=300" +
    `&center=lonlat:${lon},${lat}&zoom=16` +
    `&marker=lonlat:${lon},${lat};color:%23d97b29;size:large` +
    `&apiKey=${GEOAPIFY_API_KEY}`
  );
}

export function directionsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

// Client-side geocode for a live map preview while scheduling/editing an
// event — the backend geocodes independently on save (its own
// GEOAPIFY_API_KEY, see app/services/geocode.py), so this is purely for
// immediate visual feedback in the form and never persisted directly.
export async function geocodePreview(
  address: string,
): Promise<{ lat: number; lon: number } | null> {
  if (!hasStaticMap() || !address.trim()) return null;
  try {
    const resp = await fetch(
      "https://api.geoapify.com/v1/geocode/search" +
        `?text=${encodeURIComponent(address)}&limit=1&apiKey=${GEOAPIFY_API_KEY}`,
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const props = data.features?.[0]?.properties;
    if (typeof props?.lat !== "number" || typeof props?.lon !== "number") {
      return null;
    }
    return { lat: props.lat, lon: props.lon };
  } catch {
    return null;
  }
}

export function formatTimeRange(
  start?: string,
  end?: string,
): string | null {
  if (!start || !end) return null;
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function formatTime(time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const period = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}
