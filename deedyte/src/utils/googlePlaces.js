const GOOGLE_MAPS_KEY = 'AIzaSyBu01frNxi974hzrPfLAsvl1i2bnMahkz8';

function part(components, type) {
  const row = Array.isArray(components)
    ? components.find((item) => Array.isArray(item?.types) && item.types.includes(type))
    : null;
  return String(row?.longText ?? row?.long_name ?? '').trim();
}

export async function suggestPlaces(input, signal) {
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
    },
    body: JSON.stringify({
      input,
      includedRegionCodes: ['ng'],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || 'Location suggestions are unavailable.';
    throw new Error(message);
  }
  const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
  return suggestions.slice(0, 6).map((item) => {
    const prediction = item?.placePrediction ?? {};
    return {
      key: String(prediction.placeId ?? ''),
      placeId: String(prediction.placeId ?? ''),
      label: String(prediction.structuredFormat?.mainText?.text || prediction.text?.text || ''),
      subtitle: String(prediction.structuredFormat?.secondaryText?.text || ''),
    };
  }).filter((item) => item.placeId);
}

export async function placeDetails(placeId) {
  const id = encodeURIComponent(placeId);
  const res = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
      'X-Goog-FieldMask': 'location,addressComponents',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Could not load that place.');
  }
  const latitude = Number(data?.location?.latitude);
  const longitude = Number(data?.location?.longitude);
  const components = data?.addressComponents;
  const city = part(components, 'locality') || part(components, 'administrative_area_level_2');
  const state = part(components, 'administrative_area_level_1');
  const country = part(components, 'country') || 'Nigeria';
  return { latitude, longitude, city, state, country };
}
