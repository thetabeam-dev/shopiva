/** @type {null | ((token: string, user: object | null, options?: { forceHome?: boolean; fromSignup?: boolean }) => Promise<void>)} */
let signInHandler = null;

/**
 * @param {null | ((token: string, user: object | null, options?: { forceHome?: boolean; fromSignup?: boolean }) => Promise<void>)} fn
 */
export function registerAuthSignInHandler(fn) {
  signInHandler = fn;
}

/**
 * Persist session and enter the signed-in app stack (same as after login / OAuth).
 * @param {string} token
 * @param {object | null} user
 * @param {{ forceHome?: boolean; fromSignup?: boolean }} [options] - `fromSignup` shows “Almost there” when profile is incomplete; login should omit it.
 */
export async function completeAuthAndGoHome(token, user, options) {
  if (!signInHandler) {
    throw new Error('Auth is not ready yet. Try again in a moment.');
  }
  await signInHandler(token, user ?? null, options);
}
