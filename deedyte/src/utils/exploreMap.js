import { normalizeVendorState, vendorStateRaw } from '../pages/customer/Vendors';

export function shopCover(vendor) {
  return String(vendor?.logo ?? '').trim();
}

export function vendorCoordinate(vendor) {
  const latitude = Number(vendor?.lat);
  const longitude = Number(vendor?.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function storedUserCoordinate(user) {
  const loc = user?.raw?.location;
  if (!loc || typeof loc !== 'object' || Array.isArray(loc)) return null;
  const coords = loc.coordinates && typeof loc.coordinates === 'object' ? loc.coordinates : loc;
  const latitude = Number(coords.latitude ?? coords.lat);
  const longitude = Number(coords.longitude ?? coords.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

export function shopPlace(vendor) {
  const city = String(vendor?.city ?? '').trim();
  const state = normalizeVendorState(vendorStateRaw(vendor));
  if (city && state) return `${city}, ${state}`;
  if (state) return state;
  if (city) return city;
  return String(vendor?.address ?? '').trim();
}
