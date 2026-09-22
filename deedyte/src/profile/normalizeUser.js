/**
 * Maps API `/user/authorization` user payloads to a stable shape for the client.
 * Backend fields may vary slightly — keep accessors defensive.
 */

/**
 * @param {unknown} g
 * @returns {'male' | 'female' | null}
 */
export function normalizeGenderValue(g) {
  const s = String(g ?? '')
    .trim()
    .toLowerCase();
  if (s === 'male' || s === 'm') return 'male';
  if (s === 'female' || s === 'f') return 'female';
  return null;
}

/**
 * @param {'male' | 'female' | null} v
 * @returns {string | undefined}
 */
export function genderToApi(v) {
  if (v === 'male' || v === 'female') return v;
  return undefined;
}

/**
 * @param {unknown} roleRaw
 * @returns {boolean}
 */
export function isVendorAccountRole(roleRaw) {
  const r = String(roleRaw ?? '')
    .trim()
    .toLowerCase();
  return r === 'vendor' || r === 'entrepreneur';
}

/**
 * Strict vendor role (e.g. Shop info). Excludes `entrepreneur` and other roles.
 * @param {unknown} roleRaw
 * @returns {boolean}
 */
export function isVendorRole(roleRaw) {
  return String(roleRaw ?? '')
    .trim()
    .toLowerCase() === 'vendor';
}

/**
 * @param {string} line
 * @returns {{ city?: string; state?: string; country?: string }}
 */
export function parseLocationString(line) {
  const t = line.trim();
  if (!t) return {};
  const parts = t.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) return { city: parts[0] };
  if (parts.length === 2) return { city: parts[0], state: parts[1] };
  return {
    city: parts[0],
    state: parts[1],
    country: parts.slice(2).join(', '),
  };
}

/**
 * @param {Record<string, unknown>} raw
 */
export function normalizeUser(raw) {
  const idRaw = raw.id ?? raw.user_id ?? raw.uid;
  const id = typeof idRaw === 'number' ? idRaw : parseInt(String(idRaw), 10);

  const email = String(raw.email ?? '').trim();
  const fromEmail = email.includes('@') ? email.split('@')[0] : '';
  const nameFromFnameLname = [String(raw.fname ?? '').trim(), String(raw.lname ?? '').trim()]
    .filter(Boolean)
    .join(' ')
    .trim();
  /** Profile name only — never username or email local-part (use on Edit Profile for vendors). */
  const profileName =
    String(raw.name ?? '').trim() ||
    String(raw.full_name ?? '').trim() ||
    String(raw.fullName ?? '').trim() ||
    nameFromFnameLname;
  const displayName = String(
    profileName || String(raw.username ?? '').trim() || fromEmail || 'Shopper',
  ).trim();

  const phone = String(raw.phone ?? raw.phone_number ?? raw.mobile ?? '').trim();

  const av = raw.avatar ?? raw.photo ?? raw.picture ?? raw.avatar_url ?? raw.image_url;
  let avatarUrl = null;
  if (av != null && String(av).trim() !== '') {
    const s = String(av).trim();
    avatarUrl = s.startsWith('http') ? s : null;
  }

  const roleSource =
    raw.role ??
    raw.Role ??
    raw.userRole ??
    raw.user_role ??
    raw.accountType ??
    raw.account_type;
  const roleRaw = String(roleSource ?? 'customer')
    .trim()
    .toLowerCase();
  const roleLabel = roleRaw === 'entrepreneur' || roleRaw === 'vendor' ? 'Seller' : 'Customer';

  const gender = normalizeGenderValue(raw.gender);
  // const devicetoken = String(raw.devicetoken);

  const loc = raw.location;
  let locationObj = { city: '', state: '', country: '' };
  let locationDisplay = '';

  if (loc != null && typeof loc === 'object' && !Array.isArray(loc)) {
    const o = /** @type {Record<string, unknown>} */ (loc);
    locationObj = {
      city: String(o.city ?? '').trim(),
      state: String(o.state ?? '').trim(),
      country: String(o.country ?? '').trim(),
    };
    locationDisplay = [locationObj.city, locationObj.state, locationObj.country]
      .filter(Boolean)
      .join(', ');
  } else if (typeof loc === 'string' && loc.trim()) {
    locationDisplay = loc.trim();
    locationObj = parseLocationString(locationDisplay);
  }

  return {
    id: Number.isFinite(id) && id > 0 ? id : 0,
    displayName,
    profileName,
    email,
    phone,
    avatarUrl,
    gender,
    locationDisplay,
    locationObj,
    roleLabel,
    roleRaw,
    raw,
    // devicetoken
  };
}
