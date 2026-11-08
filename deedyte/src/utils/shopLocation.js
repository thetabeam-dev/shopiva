export function shopRecordHasLocation(shop) {
  let loc = shop?.location ?? shop?.Location;
  if (typeof loc === 'string') {
    try {
      loc = JSON.parse(loc);
    } catch {
      return false;
    }
  }
  if (!loc || typeof loc !== 'object') return false;
  return Boolean(String(loc.city ?? '').trim() && String(loc.state ?? '').trim());
}

export function shopLocationReady(_coords, city, stateName) {
  return Boolean(String(city ?? '').trim() && String(stateName ?? '').trim());
}
