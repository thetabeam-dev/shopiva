/**
 * TomTom key from https://developer.tomtom.com/
 * Maps Display API and Search API must be enabled for this key.
 */
export const TOMTOM_API_KEY = 'Kbl8c3V1lykC94Kh40bBjxckSvc8JmYM';

const placeCache = new Map();

export function tomtomTileUrl() {
  return `https://api.tomtom.com/map/1/tile/basic/main/{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}&tileSize=256`;
}

function parseResult(row) {
  const address = row?.address && typeof row.address === 'object' ? row.address : {};
  const position = row?.position && typeof row.position === 'object' ? row.position : {};
  return {
    latitude: Number(position.lat),
    longitude: Number(position.lon),
    city: String(address.municipality ?? address.municipalitySubdivision ?? '').trim(),
    state: String(address.countrySubdivision ?? '').trim(),
    country: String(address.country ?? '').trim() || 'Nigeria',
  };
}

export async function suggestPlaces(input, signal) {
  if (!TOMTOM_API_KEY) {
    throw new Error('Add your TomTom API key in src/utils/tomtom.js.');
  }
  const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(input)}.json?key=${encodeURIComponent(TOMTOM_API_KEY)}&countrySet=NG&limit=6&typeahead=true&language=en-US`;
  const res = await fetch(url, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.detailedError?.message || data?.errorText || 'Location suggestions are unavailable.');
  }
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map((row) => {
    const id = String(row?.id ?? '');
    if (id) placeCache.set(id, row);
    const address = row?.address && typeof row.address === 'object' ? row.address : {};
    const name = String(row?.poi?.name ?? address.freeformAddress ?? '').trim();
    const subtitle = String(address.freeformAddress ?? '').trim();
    return {
      key: id,
      placeId: id,
      label: name || subtitle,
      subtitle: name && subtitle && name !== subtitle ? subtitle : String(address.countrySubdivision ?? '').trim(),
    };
  }).filter((item) => item.placeId);
}

export async function placeDetails(placeId) {
  const cached = placeCache.get(String(placeId));
  if (cached) return parseResult(cached);
  if (!TOMTOM_API_KEY) {
    throw new Error('Add your TomTom API key in src/utils/tomtom.js.');
  }
  const url = `https://api.tomtom.com/search/2/place.json?entityId=${encodeURIComponent(placeId)}&key=${encodeURIComponent(TOMTOM_API_KEY)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.detailedError?.message || 'Could not load that place.');
  }
  const row = Array.isArray(data?.results) ? data.results[0] : null;
  if (!row) throw new Error('Could not load that place.');
  return parseResult(row);
}
