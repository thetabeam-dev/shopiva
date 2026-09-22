/**
 * Browser geolocation + reverse geocode for vendor shop location.
 * Tries Next.js `/api/geocode/reverse` (Google, server-side) first, then OSM Nominatim.
 */

/** @param {number} lat @param {number} lon */
export async function reverseGeocodeNominatim(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Deedyte-Vendor-App/1.0",
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const a = data.address || {};
  return {
    address: data.display_name || null,
    city: a.city || a.town || a.village || a.municipality || null,
    state: a.state || a.region || null,
    country: a.country || null,
    zipcode: a.postcode || null,
    postal_code: a.postcode || null,
    area: a.suburb || a.neighbourhood || null,
    road: a.road || null,
    street: a.road || null,
    coordinates: { lat: Number(lat), lng: Number(lon) },
  };
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{ address: string | null, city: string | null, state: string | null, country: string | null, zipcode: string | null, postal_code: string | null, area: string | null, street: string | null, coordinates: { lat: number, lng: number } }>}
 */
export async function resolveVendorLocationFromCoords(lat, lng) {
  const coord = { lat: Number(lat), lng: Number(lng) };
  if (!Number.isFinite(coord.lat) || !Number.isFinite(coord.lng)) {
    throw new Error("invalid_coords");
  }

  try {
    const res = await fetch("/api/geocode/reverse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: coord.lat, lng: coord.lng }),
    });
    if (res.ok) {
      const data = await res.json();
      if (!data.error && (data.address || data.city || data.state || data.country)) {
        return {
          address: data.address ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          country: data.country ?? null,
          zipcode: data.zipcode ?? null,
          postal_code: data.zipcode ?? null,
          area: null,
          street: null,
          coordinates: coord,
        };
      }
    }
  } catch {
    /* try Nominatim */
  }

  const n = await reverseGeocodeNominatim(coord.lat, coord.lng);
  if (n) return n;

  return {
    address: null,
    city: null,
    state: null,
    country: null,
    zipcode: null,
    postal_code: null,
    area: null,
    street: null,
    coordinates: coord,
  };
}

/**
 * Resolves when the device provides a GPS fix (same strategy as shop create flow).
 * @returns {Promise<GeolocationCoordinates>}
 */
export function requestDeviceGeolocationCoordinates() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(Object.assign(new Error("unsupported"), { code: "unsupported" }));
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      reject(Object.assign(new Error("insecure"), { code: "insecure" }));
      return;
    }

    const WATCH_TIMEOUT_MS = 40000;
    let resolved = false;
    let timeoutId = null;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (resolved) return;
        resolved = true;
        navigator.geolocation.clearWatch(watchId);
        if (timeoutId != null) clearTimeout(timeoutId);
        resolve(position.coords);
      },
      (err) => {
        if (resolved) return;
        if (err.code === 1) {
          resolved = true;
          navigator.geolocation.clearWatch(watchId);
          if (timeoutId != null) clearTimeout(timeoutId);
          reject(Object.assign(new Error("denied"), { code: 1 }));
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 300000 }
    );
    timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      navigator.geolocation.clearWatch(watchId);
      reject(Object.assign(new Error("timeout"), { code: 2 }));
    }, WATCH_TIMEOUT_MS);
  });
}

export function deviceLocationErrorMessage(err) {
  const code = err && err.code;
  if (code === "insecure") {
    return "Location needs HTTPS. Use a secure URL (or localhost), then try again.";
  }
  if (code === "unsupported") {
    return "Location is not supported in this browser.";
  }
  if (code === 1 || err?.message === "denied") {
    return "Location was denied. Allow location for this site in your browser or device settings, then try again.";
  }
  if (code === 2 || err?.message === "timeout") {
    return "Could not determine your position. Move to a clearer signal, enable location services, and try again.";
  }
  return "Could not get your location. Please try again.";
}
