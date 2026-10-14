/** When true, {@link notifyUnauthorized} is a no-op (e.g. cold bootstrap or sign-out). */
let suppress401 = false;

export function setUnauthorized401Suppressed(suppressed) {
  suppress401 = suppressed;
}

/** @type {null | (() => void | Promise<void>)} */
let onUnauthorized = null;

/**
 * @param {null | (() => void | Promise<void>)} fn
 */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

let signingOut = false;

export function notifyUnauthorized() {
  if (suppress401 || signingOut) return;
  const fn = onUnauthorized;
  if (!fn) return;
  signingOut = true;
  void Promise.resolve(fn())
    .catch(() => {})
    .finally(() => {
      signingOut = false;
    });
}
