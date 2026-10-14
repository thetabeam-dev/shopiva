export function shopRecordHasLocation(shop) {
  const loc = shop?.location ?? shop?.Location;
  if (!loc || typeof loc !== 'object') return false;
  const coords = loc.coordinates;
  const lat = Number(coords?.lat ?? coords?.latitude);
  const lng = Number(coords?.lng ?? coords?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return true;
  return Boolean(String(loc.city ?? '').trim() && String(loc.state ?? '').trim());
}

export function shopLocationReady(coords, city, stateName) {
  if (coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)) {
    return true;
  }
  return Boolean(String(city ?? '').trim() && String(stateName ?? '').trim());
}
