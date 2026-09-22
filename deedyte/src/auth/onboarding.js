import { hasVendorShop } from '../api/shop';

/**
 * Post-signup onboarding: “Almost there” profile (phone, gender, location).
 * Shown only after creating an account (not after login). Guests never see it (`isGuest`).
 */

/**
 * @param {object | null | undefined} user – from login or `GET /user/authorization`
 * @returns {boolean}
 */
export function isProfileOnboardingDone(user) {
  if (!user || typeof user !== 'object') return false;
  const digits = String(
    /** @type {{ phone?: unknown }} */ (user).phone ?? '',
  ).replace(/\D/g, '');
  const phoneOk = digits.length >= 10;
  const genderVal = /** @type {{ gender?: unknown }} */ (user).gender;
  const genderOk =
    genderVal != null &&
    String(genderVal).trim().length > 0 &&
    String(genderVal).trim().toLowerCase() !== 'null';
  const loc = /** @type {{ location?: unknown }} */ (user).location;
  let locOk = false;
  if (loc != null && typeof loc === 'object' && !Array.isArray(loc)) {
    const o = /** @type {Record<string, unknown>} */ (loc);
    const city = o.city != null ? String(o.city).trim() : '';
    const state = o.state != null ? String(o.state).trim() : '';
    const country = o.country != null ? String(o.country).trim() : '';
    locOk = city.length > 0 || state.length > 0 || country.length > 0;
  }
  return phoneOk && genderOk && locOk;
}

/**
 * Where to land after a successful `signIn` thunk.
 * Login / OAuth / session restore → always `home` (profile can be finished later).
 * Signup → “Almost there” when profile fields are still incomplete.
 * @param {object | null | undefined} user
 * @param {{ fromSignup?: boolean }} [opts]
 * @returns {'home' | 'OnboardingProfile'}
 */
export function resolvePostAuthRoute(user, opts = {}) {
  const fromSignup = Boolean(opts.fromSignup);
  if (!fromSignup) {
    return 'home';
  }
  if (!user || typeof user !== 'object') {
    return 'OnboardingProfile';
  }
  if (isProfileOnboardingDone(user)) {
    return 'home';
  }
  return 'OnboardingProfile';
}

/**
 * @param {object | null | undefined} user
 * @param {{
 *   fromSignup?: boolean;
 *   preferredRole?: string | null;
 *   preAuthChoice?: string | null;
 * }} [opts]
 * @returns {Promise<'home' | 'OnboardingProfile' | 'Shop-Onboarding'>}
 */
export async function resolveInitialAppRoute(user, opts = {}) {
  const fromSignup = Boolean(opts.fromSignup);
  const wantsVendor =
    opts.preferredRole === 'vendor' || opts.preAuthChoice === 'vendor';

  if (fromSignup && !isProfileOnboardingDone(user)) {
    return 'OnboardingProfile';
  }

  // Vendor login (existing account): shop setup when no shop yet.
  // Vendor signup always passes through OnboardingProfile above first.
  if (!fromSignup && wantsVendor) {
    try {
      const hasShop = await hasVendorShop();
      if (!hasShop) return 'Shop-Onboarding';
    } catch {
      return 'Shop-Onboarding';
    }
  }

  if (fromSignup) {
    return resolvePostAuthRoute(user, { fromSignup: true });
  }

  return 'home';
}
