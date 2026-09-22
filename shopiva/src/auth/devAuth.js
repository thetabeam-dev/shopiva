/**
 * Local auth testing helpers. React Native stores sessions in AsyncStorage — there are no browser cookies.
 *
 * - **WIPE_STORAGE_ON_LAUNCH** — clears every `@deedyte/*` key when the app starts (set to `false` again after one run if you only meant to reset once).
 * - **DISABLE_AUTH_STORAGE** — keeps token/user **in memory only** (nothing written to AsyncStorage until you reload). Useful for repeatedly testing login without clearing storage manually. OAuth uses an ephemeral Safari session on iOS when this is on.
 */

/** @type {boolean} */
export const WIPE_STORAGE_ON_LAUNCH = false;

/** @type {boolean} */
export const DISABLE_AUTH_STORAGE = false;
