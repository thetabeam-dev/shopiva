import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

/**
 * @returns {Promise<boolean>}
 */
export async function requestLocationPermission() {
  if (Platform.OS === 'android') {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location permission',
          message:
            'Deedyte uses your location once to fill your address. You can edit the fields or type them manually if you prefer.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
          buttonNeutral: 'Cancel',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }
  // iOS: permission prompt runs when getCurrentPosition is called (requires Info.plist string).
  return true;
}

/**
 * @returns {Promise<{ latitude: number; longitude: number }>}
 */
export function getCurrentCoordinates() {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        reject(err instanceof Error ? err : new Error(String(err?.message ?? err)));
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 60000,
      },
    );
  });
}

/**
 * @param {unknown} data
 * @returns {{ street: string; town: string; city: string; state: string; country: string; zip: string }}
 */
function parseBigDataCloudResponse(data) {
  const city = String(data?.city ?? '').trim();
  const locality = String(data?.locality ?? '').trim();
  const state = String(data?.principalSubdivision ?? '').trim();

  const streetNum = String(data?.streetNumber ?? '').trim();
  const streetName = String(data?.streetName ?? data?.street ?? '').trim();
  let street = [streetNum, streetName].filter(Boolean).join(' ').trim();

  let town = '';
  if (locality) {
    const locLower = locality.toLowerCase();
    const cityLower = city.toLowerCase();
    const stateLower = state.toLowerCase();
    if (locLower !== cityLower && locLower !== stateLower) {
      town = locality;
    }
  }

  const admin = data?.localityInfo?.administrative;
  if (Array.isArray(admin)) {
    const cityLower = city.toLowerCase();
    const stateLower = state.toLowerCase();
    const countryLower = String(data?.countryName ?? '').trim().toLowerCase();

    if (!town) {
      for (let i = admin.length - 1; i >= 0; i -= 1) {
        const entry = admin[i];
        const name = String(entry?.name ?? '').trim();
        if (!name) continue;
        const nameLower = name.toLowerCase();
        if (
          nameLower === cityLower ||
          nameLower === stateLower ||
          nameLower === countryLower
        ) {
          continue;
        }
        const level = Number(entry?.adminLevel);
        if (level >= 5 && level <= 8) {
          town = name;
          break;
        }
      }
    }

    if (!street) {
      const informative = data?.localityInfo?.informative;
      if (Array.isArray(informative)) {
        const namedRoad = informative.find((item) => {
          const desc = String(item?.description ?? '').toLowerCase();
          return desc.includes('road') || desc.includes('street');
        });
        if (namedRoad?.name) {
          street = String(namedRoad.name).trim();
        }
      }
    }
  }

  const country = String(data?.countryName ?? '').trim() || 'Nigeria';
  const zip = String(data?.postcode ?? '').trim();
  return {
    street,
    town,
    city: city || locality,
    state,
    country,
    zip,
  };
}

/**
 * OpenStreetMap Nominatim — better street / suburb detail when BigDataCloud omits them.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<{ street: string; town: string; city: string; state: string; country: string; zip: string }>}
 */
async function reverseGeocodeNominatim(latitude, longitude) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
    String(latitude),
  )}&lon=${encodeURIComponent(String(longitude))}&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Deedyte/1.0 (device-location; contact: app-support@deedyte.local)',
    },
  });
  if (!res.ok) {
    throw new Error(`Geocode failed (${res.status})`);
  }
  const data = await res.json();
  const addr = data?.address;
  if (!addr || typeof addr !== 'object') {
    return { street: '', town: '', city: '', state: '', country: '' };
  }

  const house = String(addr.house_number ?? '').trim();
  const road = String(addr.road ?? addr.pedestrian ?? addr.footway ?? '').trim();
  const street = [house, road].filter(Boolean).join(' ').trim() || road;

  const town = String(
    addr.suburb ??
      addr.neighbourhood ??
      addr.quarter ??
      addr.city_district ??
      addr.county ??
      '',
  ).trim();

  const city = String(
    addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? '',
  ).trim();

  const state = String(addr.state ?? addr.region ?? '').trim();
  const country = String(addr.country ?? '').trim();
  const zip = String(addr.postcode ?? '').trim();

  return { street, town, city, state, country, zip };
}

/**
 * Prefer the first non-empty value from each source.
 * @param {string} primary
 * @param {string} fallback
 */
function pickField(primary, fallback) {
  const a = String(primary ?? '').trim();
  if (a) return a;
  return String(fallback ?? '').trim();
}

/**
 * Reverse geocode via HTTPS APIs (no API key). Merges BigDataCloud + Nominatim for
 * street, town, city, state, and country.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<{ street: string; town: string; city: string; state: string; country: string; zip: string }>}
 */
export async function reverseGeocodeToPlace(latitude, longitude) {
  const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
    latitude,
  )}&longitude=${encodeURIComponent(longitude)}&localityLanguage=en`;

  const [bdcResult, nomResult] = await Promise.allSettled([
    fetch(bdcUrl).then(async (res) => {
      if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
      return res.json();
    }),
    reverseGeocodeNominatim(latitude, longitude),
  ]);

  const bdc =
    bdcResult.status === 'fulfilled'
      ? parseBigDataCloudResponse(bdcResult.value)
      : { street: '', town: '', city: '', state: '', country: '', zip: '' };

  const nom =
    nomResult.status === 'fulfilled'
      ? nomResult.value
      : { street: '', town: '', city: '', state: '', country: '', zip: '' };

  const city = pickField(bdc.city, nom.city);
  const state = pickField(bdc.state, nom.state);
  const country = pickField(bdc.country, nom.country) || 'Nigeria';

  let town = pickField(bdc.town, nom.town);
  if (town) {
    const townLower = town.toLowerCase();
    if (townLower === city.toLowerCase() || townLower === state.toLowerCase()) {
      town = pickField('', nom.town);
      if (town.toLowerCase() === city.toLowerCase()) town = '';
    }
  }

  return {
    street: pickField(bdc.street, nom.street),
    town,
    city,
    state,
    country,
    zip: pickField(bdc.zip, nom.zip),
  };
}
