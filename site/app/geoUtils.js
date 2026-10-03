/**
 * Normalize state/region strings for comparing buyer (Nominatim) vs shop location.state.
 */
export function normalizeStateKey(s) {
  if (s == null || typeof s !== "string") return "";
  return s
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .replace(/\s+state$/i, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

/** Display labels for Nigeria’s 36 states + FCT. Select `value` is `normalizeStateKey(label)`. */
const NIGERIAN_STATE_LABELS = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Federal Capital Territory",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

export const NIGERIAN_STATE_OPTIONS = NIGERIAN_STATE_LABELS.map((label) => ({
  value: normalizeStateKey(label),
  label,
}));

/**
 * Nigeria ISO 3166-2 codes as returned by Nominatim (ISO3166-2-lvl4) → normalized state key.
 * See https://en.wikipedia.org/wiki/ISO_3166-2:NG
 */
const NG_ISO3166_2_TO_STATE_KEY = {
  "NG-AB": "abia",
  "NG-AD": "adamawa",
  "NG-AK": "akwa ibom",
  "NG-AN": "anambra",
  "NG-BA": "bauchi",
  "NG-BE": "benue",
  "NG-BO": "borno",
  "NG-BY": "bayelsa",
  "NG-CR": "cross river",
  "NG-DE": "delta",
  "NG-EB": "ebonyi",
  "NG-ED": "edo",
  "NG-EK": "ekiti",
  "NG-EN": "enugu",
  "NG-FC": "federal capital territory",
  "NG-GO": "gombe",
  "NG-IM": "imo",
  "NG-JI": "jigawa",
  "NG-KD": "kaduna",
  "NG-KE": "kebbi",
  "NG-KN": "kano",
  "NG-KO": "kogi",
  "NG-KT": "katsina",
  "NG-KW": "kwara",
  "NG-LA": "lagos",
  "NG-NA": "nasarawa",
  "NG-NI": "niger",
  "NG-OG": "ogun",
  "NG-ON": "ondo",
  "NG-OS": "osun",
  "NG-OY": "oyo",
  "NG-PL": "plateau",
  "NG-RI": "rivers",
  "NG-SO": "sokoto",
  "NG-TA": "taraba",
  "NG-YO": "yobe",
  "NG-ZA": "zamfara",
};

function stateKeyFromNigeriaIso3166(code) {
  if (typeof code !== "string") return "";
  const u = code.trim().toUpperCase();
  return NG_ISO3166_2_TO_STATE_KEY[u] || "";
}

/**
 * Pick the best admin area for “state” from a Nominatim reverse JSON body.
 * For Nigeria, ISO3166-2-lvl4 (e.g. NG-AN) is more reliable than `county` (often an LGA).
 */
export function stateKeyFromNominatimData(data) {
  if (!data || typeof data !== "object") return "";
  const a = data.address || {};
  const cc = (a.country_code || "").toString().toLowerCase();

  for (const v of [a.state, a.region]) {
    if (typeof v === "string" && v.trim()) {
      const k = normalizeStateKey(v);
      if (k) return k;
    }
  }

  const isoRaw =
    a["ISO3166-2-lvl4"] ||
    a["iso3166-2-lvl4"] ||
    a.ISO3166_2_lvl4;
  if (typeof isoRaw === "string" && isoRaw.trim()) {
    const fromNg = stateKeyFromNigeriaIso3166(isoRaw);
    if (fromNg) return fromNg;
    const k = normalizeStateKey(isoRaw.replace(/^NG-/i, ""));
    if (k) return k;
  }

  if (cc === "ng") {
    for (const v of [a.state_district, a.province]) {
      if (typeof v === "string" && v.trim()) {
        const k = normalizeStateKey(v);
        if (k) return k;
      }
    }
  }

  for (const v of [a.state_district, a.province, a.county]) {
    if (typeof v === "string" && v.trim()) {
      const k = normalizeStateKey(v);
      if (k) return k;
    }
  }

  return "";
}

/** Levenshtein distance for short typo tolerance (Anmbra vs Anambra). */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + c
      );
    }
  }
  return dp[m][n];
}

/**
 * True if vendor shop state refers to the same area as the buyer’s normalized state key.
 * Handles minor spelling differences and “Lagos” vs “Lagos State”.
 */
export function buyerStateMatchesVendorState(buyerKey, vendorStateRaw) {
  const b = typeof buyerKey === "string" ? buyerKey.trim() : "";
  const v = normalizeStateKey(vendorStateRaw);
  if (!b || !v) return false;
  if (b === v) return true;

  const bCompact = b.replace(/\s/g, "");
  const vCompact = v.replace(/\s/g, "");
  if (bCompact === vCompact) return true;

  const minLen = 4;
  if (b.length >= minLen && v.includes(b)) return true;
  if (v.length >= minLen && b.includes(v)) return true;

  if (
    (b === "fct" && v === "federal capital territory") ||
    (v === "fct" && b === "federal capital territory")
  ) {
    return true;
  }

  const maxLen = Math.max(b.length, v.length);
  if (maxLen >= 5) {
    const dist = levenshtein(b, v);
    if (dist <= 2 && maxLen <= 12) return true;
    if (dist <= 1) return true;
  }

  return false;
}

/** Great-circle distance in km (for throttling geocode when GPS jitters). */
export function haversineKm(a, b) {
  if (
    !a ||
    !b ||
    !Number.isFinite(a.lat) ||
    !Number.isFinite(a.lng) ||
    !Number.isFinite(b.lat) ||
    !Number.isFinite(b.lng)
  ) {
    return Infinity;
  }
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}
