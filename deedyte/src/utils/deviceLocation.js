import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import DeviceInfo from 'react-native-device-info';

const PERMISSION_RATIONALE = {
  title: 'Location permission',
  message:
    'Deedyte uses your location to fill your address. Allow location access to continue, or enter the address manually.',
  buttonPositive: 'Allow',
  buttonNegative: 'Deny',
  buttonNeutral: 'Cancel',
};

function openAppLocationSettings() {
  Alert.alert(
    'Location permission',
    'Location access is off for Deedyte. Open settings and allow location so we can use your current location.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open settings', onPress: () => Linking.openSettings() },
    ],
  );
}

function openDeviceLocationSettings() {
  Alert.alert(
    'Device location',
    'Turn on location on this device, then try again.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Open settings',
        onPress: () => {
          if (Platform.OS === 'android') {
            Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings());
            return;
          }
          Linking.openSettings();
        },
      },
    ],
  );
}

async function androidLocationGranted(interactive) {
  const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  if (await PermissionsAndroid.check(fine)) return true;
  const result = await PermissionsAndroid.request(fine, PERMISSION_RATIONALE);
  if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
  if (interactive && result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) openAppLocationSettings();
  return false;
}

function iosLocationGranted(interactive) {
  return new Promise((resolve) => {
    const geo = /** @type {{ requestAuthorization?: Function }} */ (Geolocation);
    if (typeof geo.requestAuthorization !== 'function') {
      resolve(true);
      return;
    }
    let settled = false;
    const finish = (granted) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(granted);
    };
    const timer = setTimeout(() => finish(false), 8000);
    geo.requestAuthorization(
      () => finish(true),
      () => {
        if (interactive) openAppLocationSettings();
        finish(false);
      },
    );
  });
}

/**
 * Confirms device location is on, then asks for app access again if it was denied.
 * @param {{ interactive?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
export async function requestLocationPermission(options = {}) {
  const interactive = options.interactive !== false;
  try {
    const servicesOn = await Promise.race([
      DeviceInfo.isLocationEnabled(),
      new Promise((resolve) => {
        setTimeout(() => resolve(false), 4000);
      }),
    ]);
    if (!servicesOn) {
      if (interactive) openDeviceLocationSettings();
      return false;
    }
  } catch {
    // Continue to the permission prompt if the services check is unavailable.
  }

  try {
    if (Platform.OS === 'android') return await androidLocationGranted(interactive);
    return await iosLocationGranted(interactive);
  } catch {
    return false;
  }
}

/**
 * @returns {Promise<{ latitude: number; longitude: number }>}
 */
export function getCurrentCoordinates() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handler(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new Error('Turn on device location, then try again.'));
    }, 12000);
    Geolocation.getCurrentPosition(
      (pos) => {
        finish(resolve, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      (err) => {
        const code = Number(err?.code);
        if (code === 1) {
          finish(reject, new Error('Location permission was denied. Allow location access and try again.'));
          return;
        }
        if (code === 2 || code === 3) {
          finish(reject, new Error('Turn on device location, then try again.'));
          return;
        }
        finish(reject, err instanceof Error ? err : new Error(String(err?.message ?? 'Could not read your location.')));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
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
 * @returns {Promise<{ street: string; town: string; suburb: string; neighbourhood: string; city: string; state: string; country: string; zip: string }>}
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
    return { street: '', town: '', suburb: '', neighbourhood: '', city: '', state: '', country: '', zip: '' };
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

  return {
    street,
    town,
    suburb: String(addr.suburb ?? addr.city_district ?? '').trim(),
    neighbourhood: String(addr.neighbourhood ?? addr.quarter ?? '').trim(),
    city,
    state,
    country,
    zip,
  };
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
      : { street: '', town: '', suburb: '', neighbourhood: '', city: '', state: '', country: '', zip: '' };

  const nom =
    nomResult.status === 'fulfilled'
      ? nomResult.value
      : { street: '', town: '', suburb: '', neighbourhood: '', city: '', state: '', country: '', zip: '' };

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
    suburb: pickField(nom.suburb, town),
    neighbourhood: pickField(nom.neighbourhood, ''),
    city,
    state,
    country,
    zip: pickField(bdc.zip, nom.zip),
  };
}
