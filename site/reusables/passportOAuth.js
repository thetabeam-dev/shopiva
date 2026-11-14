/**
 * Start backend Passport OAuth (Google / Facebook / Apple) for the Next.js site.
 * Returns to `/auth/oauth/callback` with a JWT — same find-or-create path as the mobile app.
 *
 * Temporarily disconnected on site login/signup/modal — keep helpers for re-enable.
 */

const START_PATHS = {
  google: "/api/oauth/google",
  facebook: "/api/oauth/facebook",
  apple: "/api/oauth/apple",
};

/**
 * @returns {string}
 */
export function backendBaseUrl() {
  return String(process.env.NEXT_PUBLIC_BACKEND_URL || "")
    .trim()
    .replace(/\/$/, "");
}

/**
 * @param {'google' | 'facebook' | 'apple'} provider
 * @param {{
 *   role?: 'customer' | 'entrepreneur',
 *   next?: string,
 * }} [opts]
 */
export function startPassportOAuth(provider, opts = {}) {
  // Passport OAuth temporarily disconnected on the site.
  throw new Error("Passport sign-in is temporarily disabled");
  /*
  const path = START_PATHS[String(provider || "").toLowerCase()];
  const base = backendBaseUrl();
  if (!path || !base) {
    throw new Error(
      !base
        ? "NEXT_PUBLIC_BACKEND_URL is not set"
        : `Unknown OAuth provider: ${provider}`,
    );
  }

  const role = opts.role === "entrepreneur" ? "entrepreneur" : "customer";
  const nextRaw = String(opts.next || "").trim();
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/auth")
      ? nextRaw
      : "";

  const returnTo = `${window.location.origin}/auth/oauth/callback`;
  const params = new URLSearchParams({
    return_to: returnTo,
    role,
  });
  if (next) params.set("next", next);

  window.location.assign(`${base}${path}?${params.toString()}`);
  */
}

/**
 * @param {string} [code]
 * @returns {string}
 */
export function passportOAuthErrorMessage(code) {
  if (!code) return "Sign-in failed.";
  const map = {
    google_not_configured: "Google sign-in is not configured on the API server.",
    facebook_not_configured: "Facebook sign-in is not configured on the API server.",
    apple_not_configured: "Sign in with Apple is not configured yet.",
    oauth_failed: "Sign-in was cancelled or failed.",
  };
  return map[code] ?? code;
}
