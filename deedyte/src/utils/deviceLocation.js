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

export class LocationError extends Error {
  /**
   * @param {'denied' | 'blocked' | 'services_off' | 'timeout' | 'unavailable' | 'cancelled'} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'LocationError';
    this.code = code;
  }
}

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

if (Platform.OS === 'android') {
  Geolocation.setRNConfiguration({
    skipPermissionRequests: true,
    locationProvider: 'auto',
  });
}

function androidPermissionGranted(result) {
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function androidLocationGranted(interactive) {
  const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
  try {
    if (
      (await PermissionsAndroid.check(fine)) ||
      (await PermissionsAndroid.check(coarse))
    ) {
      return 'granted';
    }
  } catch {
    /* continue to request */
  }
  let result;
  try {
    result = await PermissionsAndroid.requestMultiple([fine, coarse]);
  } catch {
    const single = await PermissionsAndroid.request(fine, PERMISSION_RATIONALE);
    result = { [fine]: single };
  }
  const fineStatus = result[fine];
  const coarseStatus = result[coarse];
  if (androidPermissionGranted(fineStatus) || androidPermissionGranted(coarseStatus)) {
    return 'granted';
  }
  if (
    fineStatus === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
    coarseStatus === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
  ) {
    if (interactive) openAppLocationSettings();
    return 'blocked';
  }
  return 'denied';
}

function iosLocationGranted(interactive) {
  return new Promise((resolve) => {
    const geo = /** @type {{ requestAuthorization?: Function }} */ (Geolocation);
    let settled = false;
    let denied = false;
    const finish = (status) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(status);
    };
    const started = Date.now();
    const timer = setTimeout(() => finish(denied ? 'denied' : 'granted'), 8000);
    Geolocation.getCurrentPosition(
      () => finish('granted'),
      (err) => {
        if (Number(err?.code) === 1) {
          denied = true;
          return;
        }
        finish('granted');
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 },
    );
    if (typeof geo.requestAuthorization !== 'function') return;
    geo.requestAuthorization(
      () => finish('granted'),
      () => {
        denied = true;
        const blocked = Date.now() - started < 400;
        if (interactive && blocked) openAppLocationSettings();
        finish(blocked ? 'blocked' : 'denied');
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
        setTimeout(() => resolve(null), 2500);
      }),
    ]);
    if (servicesOn === false) {
      if (interactive) openDeviceLocationSettings();
      return false;
    }
  } catch {
    // Continue to the permission prompt if the services check is unavailable.
  }

  try {
    const status = Platform.OS === 'android'
      ? await androidLocationGranted(interactive)
      : await iosLocationGranted(interactive);
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function deviceLocationServicesOn() {
  try {
    return await Promise.race([
      DeviceInfo.isLocationEnabled(),
      new Promise((resolve) => {
        setTimeout(() => resolve(null), 2500);
      }),
    ]);
  } catch {
    return null;
  }
}

/**
 * One GPS attempt. Rejects with LocationError instead of opening settings in a loop.
 * @param {{ isCancelled?: () => boolean }} [options]
 * @returns {Promise<{ latitude: number; longitude: number }>}
 */
export async function readExactLocation(options = {}) {
  if (options.isCancelled?.()) {
    throw new LocationError('cancelled', 'Location lookup was cancelled.');
  }
  const servicesOn = await deviceLocationServicesOn();
  if (options.isCancelled?.()) {
    throw new LocationError('cancelled', 'Location lookup was cancelled.');
  }
  if (servicesOn === false) {
    throw new LocationError(
      'services_off',
      'Turn on location on this device, then try again. You can also enter the address manually.',
    );
  }

  let access = 'denied';
  if (Platform.OS === 'android') {
    access = await androidLocationGranted(false);
  } else {
    access = await iosLocationGranted(false);
  }
  if (options.isCancelled?.()) {
    throw new LocationError('cancelled', 'Location lookup was cancelled.');
  }
  if (access === 'blocked') {
    throw new LocationError(
      'blocked',
      'Location access is turned off for Deedyte. Allow it in settings, or enter the address manually.',
    );
  }
  if (access !== 'granted') {
    throw new LocationError(
      'denied',
      'Location permission was denied. You can enter the address manually.',
    );
  }
  return getCurrentCoordinates({ exact: true, isCancelled: options.isCancelled });
}

/**
 * @param {{
 *   enableHighAccuracy: boolean;
 *   timeout: number;
 *   maximumAge: number;
 *   isCancelled?: () => boolean;
 * }} geoOptions
 * @returns {Promise<{ latitude: number; longitude: number }>}
 */
function getPositionOnce(geoOptions) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handler(value);
    };
    const timer = setTimeout(() => {
      finish(
        reject,
        new LocationError(
          'timeout',
          'We could not get your location in time. Enter your city and state manually.',
        ),
      );
    }, geoOptions.timeout + 1500);
    Geolocation.getCurrentPosition(
      (pos) => {
        if (geoOptions.isCancelled?.()) {
          finish(reject, new LocationError('cancelled', 'Location lookup was cancelled.'));
          return;
        }
        const latitude = Number(pos?.coords?.latitude);
        const longitude = Number(pos?.coords?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          finish(
            reject,
            new LocationError('unavailable', 'We could not get your location. Enter your city and state manually.'),
          );
          return;
        }
        finish(resolve, { latitude, longitude });
      },
      (err) => {
        if (geoOptions.isCancelled?.()) {
          finish(reject, new LocationError('cancelled', 'Location lookup was cancelled.'));
          return;
        }
        const code = Number(err?.code);
        if (code === 1) {
          finish(
            reject,
            new LocationError('denied', 'Location permission was denied. You can enter the address manually.'),
          );
          return;
        }
        if (code === 3) {
          finish(
            reject,
            new LocationError(
              'timeout',
              'We could not get your location in time. Enter your city and state manually.',
            ),
          );
          return;
        }
        finish(
          reject,
          new LocationError('unavailable', 'We could not get your location. Enter your city and state manually.'),
        );
      },
      {
        enableHighAccuracy: geoOptions.enableHighAccuracy,
        timeout: geoOptions.timeout,
        maximumAge: geoOptions.maximumAge,
      },
    );
  });
}

/**
 * Android GPS-only fixes are often slow or timeout indoors. Use last-known / network
 * first, then a longer fused high-accuracy attempt.
 * @param {{ exact?: boolean; isCancelled?: () => boolean }} options
 */
async function getAndroidCoordinates(options) {
  try {
    return await getPositionOnce({
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: 5 * 60 * 1000,
      isCancelled: options.isCancelled,
    });
  } catch (error) {
    if (error instanceof LocationError && (error.code === 'denied' || error.code === 'cancelled')) {
      throw error;
    }
  }
  return getPositionOnce({
    enableHighAccuracy: Boolean(options.exact),
    timeout: options.exact ? 20000 : 12000,
    maximumAge: options.exact ? 30000 : 120000,
    isCancelled: options.isCancelled,
  });
}

/**
 * @param {{ exact?: boolean; isCancelled?: () => boolean }} [options]
 * @returns {Promise<{ latitude: number; longitude: number }>}
 */
export function getCurrentCoordinates(options = {}) {
  if (Platform.OS === 'android') {
    return getAndroidCoordinates(options);
  }
  return getPositionOnce({
    enableHighAccuracy: Boolean(options.exact),
    timeout: options.exact ? 15000 : 10000,
    maximumAge: options.exact ? 15000 : 120000,
    isCancelled: options.isCancelled,
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
  if (!city && !state) {
    throw new Error('We could not get your location. Enter your city and state manually.');
  }
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
