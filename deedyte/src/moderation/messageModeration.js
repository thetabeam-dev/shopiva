/**
 * Chat message moderation: single-message + cross-message (split contact) detection.
 * Pure functions — no UI. Run on send only (not per keystroke).
 */

import { MODERATION_CONFIG } from './moderationConfig';

/** @typedef {'low' | 'medium' | 'high'} ViolationSeverity */
/** @typedef {'allow' | 'block' | 'warn'} ModerationAction */
/** @typedef {'low' | 'medium' | 'high' | 'critical'} RiskLevel */

/**
 * @typedef {Object} ViolationDetail
 * @property {string} type
 * @property {ViolationSeverity} severity
 * @property {number} weight
 */

/**
 * @typedef {Object} ScanResult
 * @property {boolean} isAllowed
 * @property {string[]} violations Stable machine ids for analytics / copy / server parity.
 * @property {number} [severityScore] Sum of rule weights for this scan.
 * @property {ViolationSeverity} [maxSeverity]
 * @property {ModerationAction} [recommendedAction]
 * @property {ViolationDetail[]} [details]
 * @property {RiskLevel} [riskLevel] Cross-scan / composite risk bucket.
 * @property {number} [riskScore] 0–∞ composite score (thresholds in moderationConfig).
 * @property {boolean} [fromContextScan] True when produced by `scanConversationContext`.
 */

export const VIOLATION_TYPES = Object.freeze({
  PHONE_NUMBER: 'phone_number',
  EMAIL_ADDRESS: 'email_address',
  EXTERNAL_LINK: 'external_link',
  SHORT_LINK: 'short_link',
  SOCIAL_MEDIA_REFERENCE: 'social_media_reference',
  SOCIAL_HANDLE: 'social_handle',
  OFF_PLATFORM_INTENT: 'off_platform_intent',
  OBFUSCATED_PHONE: 'obfuscated_phone',
  /** Merged timeline shows contact-shaped content that the latest message alone does not. */
  CROSS_MESSAGE_CONTACT_RECONSTRUCTION: 'cross_message_contact_reconstruction',
  /** Several messages concatenate into a long digit / phone-like blob. */
  SPLIT_DIGIT_SEQUENCE: 'split_digit_sequence',
  /** Many tiny numeric messages in a short window (evasion tactic). */
  RAPID_NUMERIC_FRAGMENTS: 'rapid_numeric_fragments',
  /** Composite contextual score crossed block threshold (silent analysis / bonus). */
  CONTEXT_RISK_ELEVATED: 'context_risk_elevated',
});

/** Violation types that indicate sharing or moving contact off-platform. */
const CONTACT_VIOLATIONS = new Set([
  VIOLATION_TYPES.PHONE_NUMBER,
  VIOLATION_TYPES.EMAIL_ADDRESS,
  VIOLATION_TYPES.EXTERNAL_LINK,
  VIOLATION_TYPES.SHORT_LINK,
  VIOLATION_TYPES.OBFUSCATED_PHONE,
]);

/** @type {Record<string, { weight: number; severity: ViolationSeverity }>} */
const TYPE_META = {
  [VIOLATION_TYPES.PHONE_NUMBER]: { weight: 100, severity: 'high' },
  [VIOLATION_TYPES.EMAIL_ADDRESS]: { weight: 100, severity: 'high' },
  [VIOLATION_TYPES.EXTERNAL_LINK]: { weight: 85, severity: 'high' },
  [VIOLATION_TYPES.SHORT_LINK]: { weight: 85, severity: 'high' },
  [VIOLATION_TYPES.SOCIAL_MEDIA_REFERENCE]: { weight: 55, severity: 'medium' },
  [VIOLATION_TYPES.SOCIAL_HANDLE]: { weight: 40, severity: 'medium' },
  [VIOLATION_TYPES.OFF_PLATFORM_INTENT]: { weight: 65, severity: 'medium' },
  [VIOLATION_TYPES.OBFUSCATED_PHONE]: { weight: 90, severity: 'high' },
  [VIOLATION_TYPES.CROSS_MESSAGE_CONTACT_RECONSTRUCTION]: { weight: 100, severity: 'high' },
  [VIOLATION_TYPES.SPLIT_DIGIT_SEQUENCE]: { weight: 90, severity: 'high' },
  [VIOLATION_TYPES.RAPID_NUMERIC_FRAGMENTS]: { weight: 70, severity: 'high' },
  [VIOLATION_TYPES.CONTEXT_RISK_ELEVATED]: { weight: 60, severity: 'medium' },
};

const SEVERITY_ORDER = { low: 1, medium: 2, high: 3 };

const SPOKEN_DIGIT_MAP = [
  ['zero', '0'],
  ['oh', '0'],
  ['one', '1'],
  ['two', '2'],
  ['three', '3'],
  ['four', '4'],
  ['five', '5'],
  ['six', '6'],
  ['seven', '7'],
  ['eight', '8'],
  ['nine', '9'],
];

const RE_EMAIL = /\b[a-z0-9][a-z0-9._%+-]*@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\b/i;
const RE_URL =
  /\b(?:https?:\/\/|www\.)(?:[^\s<>()]+|\((?:[^\s()<>]+|(?:\([^\s()<>]+\)))*\))+/i;
const RE_SHORT_LINK =
  /\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rb\.gy|cutt\.ly|short\.link|wa\.me|t\.me)\/[^\s]+/i;
const RE_PHONE_NG =
  /\b(?:\+?234[\s\-/]?|0)(?:7[0-9]|8[01]|9[01])\d{1}[\s\-/]?\d{3}[\s\-/]?\d{4}\b/;
const RE_PHONE_INTL_PLUS = /\+(?:[1-9]\d{0,2})[\s\-]?(?:\d[\s\-]?){8,14}\d\b/;
const RE_PHONE_GROUPED = /\b(?:\(\d{3}\)|\d{3})[\s.\-]?\d{3}[\s.\-]?\d{4}\b/;
const RE_DIGIT_RUN_SPACED = /\b\d(?:[\s.\-_/]+\d){5,}\b/;
const RE_SOCIAL_WORD =
  /\b(?:whatsapp|wa\b|telegram|instagram|insta\b|facebook|fb\b|messenger|twitter|x\.com|tiktok|snapchat|discord|signal|viber|linkedin|youtube\.com|youtu\.be)\b/i;
const RE_AT_HANDLE = /@[a-z0-9_]{2,30}\b/i;
const RE_OFF_PLATFORM_INTENT = new RegExp(
  [
    '\\bdm\\s+me\\b',
    '\\bpm\\s+me\\b',
    '\\bmessage\\s+me\\s+on\\b',
    '\\bwhatsapp\\s+me\\b',
    '\\bcall\\s+me\\b',
    '\\breach\\s+me\\s+at\\b',
    '\\bcontact\\s+me\\b',
    '\\btext\\s+me\\b',
    '\\badd\\s+me\\s+on\\b',
    '\\bhit\\s+me\\s+up\\b',
    '\\bmy\\s+(?:number|phone|whatsapp|wa|telegram|email)\\b',
    '\\b(?:ping|hmu)\\s+me\\b',
    '\\b(?:send|shoot)\\s+me\\s+(?:a\\s+)?(?:text|dm)\\b',
  ].join('|'),
  'i',
);

/** Loose NG digit prefix after full normalization (merged fragments). */
const RE_NG_DIGIT_PREFIX = /^(?:\+?234|0)(?:7[0-9]|8[01]|9[01])/;

function collapseDigitSeparators(s) {
  return s.replace(/(\d)(?:[\s.\-_/]+(?=\d))+/g, '$1');
}

function normalizeSpokenDigits(s) {
  let out = s.toLowerCase();
  for (const [word, digit] of SPOKEN_DIGIT_MAP) {
    out = out.replace(new RegExp(`\\b${word}\\b`, 'gi'), digit);
  }
  return out;
}

/** Lowercase → spoken digits → collapse digit separators (shared pipeline for context). */
export function normalizeContextCorpus(s) {
  return collapseDigitSeparators(normalizeSpokenDigits(String(s ?? '').toLowerCase()));
}

function addViolation(type, seen, details) {
  if (seen.has(type)) return;
  seen.add(type);
  const meta = TYPE_META[type];
  if (meta) {
    details.push({ type, severity: meta.severity, weight: meta.weight });
  } else {
    details.push({ type, severity: 'medium', weight: 50 });
  }
}

function finalizeScan(seen, details) {
  const violations = Array.from(seen);
  if (violations.length === 0) {
    return {
      isAllowed: true,
      violations: [],
      severityScore: 0,
      maxSeverity: /** @type {ViolationSeverity} */ ('low'),
      recommendedAction: /** @type {ModerationAction} */ ('allow'),
      details: [],
      riskLevel: /** @type {RiskLevel} */ ('low'),
      riskScore: 0,
    };
  }
  let severityScore = 0;
  let maxSev = /** @type {ViolationSeverity} */ ('low');
  for (const d of details) {
    severityScore += d.weight;
    if (SEVERITY_ORDER[d.severity] > SEVERITY_ORDER[maxSev]) maxSev = d.severity;
  }
  const riskScore = severityScore;
  const riskLevel = computeRiskLevel(riskScore, violations);
  return {
    isAllowed: false,
    violations,
    severityScore,
    maxSeverity: maxSev,
    recommendedAction: 'block',
    details,
    riskLevel,
    riskScore,
  };
}

/** @param {number} riskScore @param {string[]} violations */
function computeRiskLevel(riskScore, violations) {
  const criticalTypes = new Set([
    VIOLATION_TYPES.CROSS_MESSAGE_CONTACT_RECONSTRUCTION,
    VIOLATION_TYPES.SPLIT_DIGIT_SEQUENCE,
    VIOLATION_TYPES.PHONE_NUMBER,
    VIOLATION_TYPES.EMAIL_ADDRESS,
  ]);
  if (riskScore >= 220 || violations.some((v) => criticalTypes.has(v))) return 'critical';
  if (riskScore >= 140) return 'high';
  if (riskScore >= 85) return 'medium';
  return 'low';
}

/**
 * Single-message scan (regex + keyword). Prefer this name in new code.
 * @param {string} message
 * @returns {ScanResult}
 */
export function scanMessage(message) {
  const raw = typeof message === 'string' ? message : String(message ?? '');
  const trimmed = raw.trim();
  const empty = finalizeScan(new Set(), []);
  if (!trimmed) return empty;

  const seen = new Set();
  /** @type {ViolationDetail[]} */
  const details = [];

  if (RE_EMAIL.test(trimmed)) {
    addViolation(VIOLATION_TYPES.EMAIL_ADDRESS, seen, details);
  }
  if (RE_SHORT_LINK.test(trimmed)) {
    addViolation(VIOLATION_TYPES.SHORT_LINK, seen, details);
  } else if (RE_URL.test(trimmed)) {
    addViolation(VIOLATION_TYPES.EXTERNAL_LINK, seen, details);
  }

  const collapsed = collapseDigitSeparators(trimmed);
  const hasStructuredPhone =
    RE_PHONE_NG.test(trimmed) ||
    RE_PHONE_INTL_PLUS.test(trimmed) ||
    RE_PHONE_GROUPED.test(trimmed) ||
    RE_PHONE_NG.test(collapsed) ||
    RE_PHONE_INTL_PLUS.test(collapsed) ||
    RE_PHONE_GROUPED.test(collapsed);

  if (hasStructuredPhone) {
    addViolation(VIOLATION_TYPES.PHONE_NUMBER, seen, details);
  }
  if (RE_DIGIT_RUN_SPACED.test(trimmed) && !hasStructuredPhone) {
    addViolation(VIOLATION_TYPES.OBFUSCATED_PHONE, seen, details);
  }

  const spoken = normalizeSpokenDigits(trimmed);
  const spokenCollapsed = collapseDigitSeparators(spoken);
  if (spoken !== trimmed.toLowerCase()) {
    const spokenLooksPhone =
      RE_PHONE_NG.test(spokenCollapsed) ||
      RE_PHONE_INTL_PLUS.test(spokenCollapsed) ||
      RE_PHONE_GROUPED.test(spokenCollapsed);
    if (spokenLooksPhone) {
      addViolation(VIOLATION_TYPES.PHONE_NUMBER, seen, details);
    } else if (/\b\d{10,15}\b/.test(spokenCollapsed)) {
      addViolation(VIOLATION_TYPES.OBFUSCATED_PHONE, seen, details);
    }
  }

  if (RE_SOCIAL_WORD.test(trimmed)) {
    addViolation(VIOLATION_TYPES.SOCIAL_MEDIA_REFERENCE, seen, details);
  }
  if (RE_AT_HANDLE.test(trimmed)) {
    addViolation(VIOLATION_TYPES.SOCIAL_HANDLE, seen, details);
  }
  if (RE_OFF_PLATFORM_INTENT.test(trimmed)) {
    addViolation(VIOLATION_TYPES.OFF_PLATFORM_INTENT, seen, details);
  }

  const out = finalizeScan(seen, details);
  return out.isAllowed ? { ...out, riskLevel: 'low', riskScore: 0 } : out;
}

/** @deprecated Use {@link scanMessage}; kept for backward compatibility. */
export function scanAndValidateMessage(message) {
  return scanMessage(message);
}

/**
 * True if the message is mostly digits / separators (rapid fragment heuristic).
 * @param {string} text
 */
function isNumericFragment(text) {
  const t = String(text ?? '').trim();
  if (!t || t.length > MODERATION_CONFIG.RAPID_FRAGMENT_MAX_LEN) return false;
  const digits = (t.match(/\d/g) ?? []).length;
  return digits >= 1 && digits / Math.max(1, t.length) >= 0.34;
}

/**
 * Count rapid numeric fragments in a sliding time window ending at `now`.
 * @param {Array<{ text: string; sentAt: number }>} timeline Oldest → newest.
 * @param {number} now
 */
function countRapidNumericFragments(timeline, now) {
  const win = MODERATION_CONFIG.RAPID_FRAGMENT_WINDOW_MS;
  let c = 0;
  for (let i = timeline.length - 1; i >= 0; i--) {
    const { text, sentAt } = timeline[i];
    if (now - sentAt > win) break;
    if (isNumericFragment(text)) c += 1;
  }
  return c;
}

/**
 * Cross-message scan: merges recent user texts, normalizes, and scores split-contact tactics.
 *
 * @param {string} currentMessage Text about to be sent.
 * @param {string[]} previousMessages Older → newer prior texts from the same user in this room.
 * @param {{
 *   now?: number;
 *   messageTimestamps?: number[];
 *   contextWindowMs?: number;
 *   sessionBlockCount?: number;
 * }} [options] `messageTimestamps[i]` aligns with `previousMessages[i]` (ms since epoch).
 * @returns {ScanResult & { fromContextScan?: boolean }}
 */
export function scanConversationContext(currentMessage, previousMessages, options = {}) {
  const now = options.now ?? Date.now();
  const windowMs = options.contextWindowMs ?? MODERATION_CONFIG.CONTEXT_WINDOW_MS;
  const stamps = options.messageTimestamps;
  const sessionBlocks = Math.max(0, Number(options.sessionBlockCount) || 0);

  const prevRaw = Array.isArray(previousMessages) ? previousMessages : [];
  /** @type {Array<{ text: string; sentAt: number }>} */
  const prevPairs = [];
  for (let i = 0; i < prevRaw.length; i++) {
    const text = String(prevRaw[i] ?? '').trim();
    if (!text) continue;
    const sentAt = stamps && stamps[i] != null ? Number(stamps[i]) : now;
    if (Number.isFinite(sentAt) && now - sentAt <= windowMs) {
      prevPairs.push({ text, sentAt });
    }
  }

  const current = String(currentMessage ?? '').trim();
  const baseAllow = finalizeScan(new Set(), []);
  if (!current) return { ...baseAllow, fromContextScan: true };

  const parts = [...prevPairs.map((p) => p.text), current];
  if (parts.length < 2) {
    return { ...baseAllow, fromContextScan: true };
  }

  const merged = parts.join(' ');
  const mergedNorm = normalizeContextCorpus(merged);
  const digitsOnly = mergedNorm.replace(/\D/g, '');

  const scanMerged = scanMessage(merged);
  const scanCurrent = scanMessage(current);

  const seen = new Set();
  /** @type {ViolationDetail[]} */
  const details = [];

  const mergedContact = scanMerged.violations.filter((v) => CONTACT_VIOLATIONS.has(v));
  const currentContact = scanCurrent.violations.filter((v) => CONTACT_VIOLATIONS.has(v));
  const digitContributors = parts.filter((p) => /\d/.test(p)).length;

  if (mergedContact.length > 0 && currentContact.length === 0) {
    addViolation(VIOLATION_TYPES.CROSS_MESSAGE_CONTACT_RECONSTRUCTION, seen, details);
  }

  const minLen = MODERATION_CONFIG.MIN_SPLIT_DIGIT_LEN;
  const strongLen = MODERATION_CONFIG.STRONG_DIGIT_MERGE_LEN;
  if (digitContributors >= 2 && digitsOnly.length >= minLen) {
    const ngShape =
      RE_PHONE_NG.test(mergedNorm) ||
      RE_PHONE_INTL_PLUS.test(mergedNorm) ||
      RE_PHONE_GROUPED.test(mergedNorm) ||
      RE_NG_DIGIT_PREFIX.test(digitsOnly) ||
      digitsOnly.length >= strongLen;
    if (ngShape) {
      addViolation(VIOLATION_TYPES.SPLIT_DIGIT_SEQUENCE, seen, details);
    }
  }

  const timeline = [...prevPairs, { text: current, sentAt: now }].sort((a, b) => a.sentAt - b.sentAt);
  if (countRapidNumericFragments(timeline, now) >= MODERATION_CONFIG.RAPID_FRAGMENT_MIN_COUNT) {
    addViolation(VIOLATION_TYPES.RAPID_NUMERIC_FRAGMENTS, seen, details);
  }

  /** Prior blocks in this room/session add composite pressure (bonus: lock / admin). */
  const repeatBoost = Math.min(4, sessionBlocks) * 22;

  let out = finalizeScan(seen, details);
  if (out.isAllowed) {
    const composite =
      repeatBoost +
      (digitContributors >= 2 && digitsOnly.length >= MODERATION_CONFIG.STRONG_DIGIT_MERGE_LEN ? 55 : 0);
    if (composite >= MODERATION_CONFIG.CONTEXT_BLOCK_RISK_SCORE) {
      addViolation(VIOLATION_TYPES.CONTEXT_RISK_ELEVATED, seen, details);
      out = finalizeScan(seen, details);
    }
  }

  if (!out.isAllowed) {
    const rs = (out.riskScore ?? 0) + repeatBoost;
    return {
      ...out,
      riskScore: rs,
      riskLevel: computeRiskLevel(rs, out.violations),
      fromContextScan: true,
    };
  }

  return { ...baseAllow, fromContextScan: true };
}

/**
 * @param {{ violations: string[]; severityScore?: number; preview?: string; roomId?: string; role?: string; fromContext?: boolean }} payload
 */
export function logMessageModerationAttempt(payload) {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn('[message_moderation]', payload);
  }
}
