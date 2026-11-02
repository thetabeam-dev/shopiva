/**
 * Server-side parity with app moderation — single-message + cross-message context.
 */

import { MODERATION_CONFIG } from "./moderationConfig.js";

export type ViolationSeverity = "low" | "medium" | "high";
export type ModerationAction = "allow" | "block" | "warn";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export type ViolationDetail = {
  type: string;
  severity: ViolationSeverity;
  weight: number;
};

export type ScanResult = {
  isAllowed: boolean;
  violations: string[];
  severityScore?: number;
  maxSeverity?: ViolationSeverity;
  recommendedAction?: ModerationAction;
  details?: ViolationDetail[];
  riskLevel?: RiskLevel;
  riskScore?: number;
  fromContextScan?: boolean;
};

export const VIOLATION_TYPES = Object.freeze({
  PHONE_NUMBER: "phone_number",
  EMAIL_ADDRESS: "email_address",
  EXTERNAL_LINK: "external_link",
  SHORT_LINK: "short_link",
  SOCIAL_MEDIA_REFERENCE: "social_media_reference",
  SOCIAL_HANDLE: "social_handle",
  OFF_PLATFORM_INTENT: "off_platform_intent",
  OBFUSCATED_PHONE: "obfuscated_phone",
  CROSS_MESSAGE_CONTACT_RECONSTRUCTION: "cross_message_contact_reconstruction",
  SPLIT_DIGIT_SEQUENCE: "split_digit_sequence",
  RAPID_NUMERIC_FRAGMENTS: "rapid_numeric_fragments",
  CONTEXT_RISK_ELEVATED: "context_risk_elevated",
});

const CONTACT_VIOLATIONS = new Set<string>([
  VIOLATION_TYPES.PHONE_NUMBER,
  VIOLATION_TYPES.EMAIL_ADDRESS,
  VIOLATION_TYPES.EXTERNAL_LINK,
  VIOLATION_TYPES.SHORT_LINK,
  VIOLATION_TYPES.OBFUSCATED_PHONE,
]);

const TYPE_META: Record<string, { weight: number; severity: ViolationSeverity }> =
  {
    [VIOLATION_TYPES.PHONE_NUMBER]: { weight: 100, severity: "high" },
    [VIOLATION_TYPES.EMAIL_ADDRESS]: { weight: 100, severity: "high" },
    [VIOLATION_TYPES.EXTERNAL_LINK]: { weight: 85, severity: "high" },
    [VIOLATION_TYPES.SHORT_LINK]: { weight: 85, severity: "high" },
    [VIOLATION_TYPES.SOCIAL_MEDIA_REFERENCE]: { weight: 55, severity: "medium" },
    [VIOLATION_TYPES.SOCIAL_HANDLE]: { weight: 40, severity: "medium" },
    [VIOLATION_TYPES.OFF_PLATFORM_INTENT]: { weight: 65, severity: "medium" },
    [VIOLATION_TYPES.OBFUSCATED_PHONE]: { weight: 90, severity: "high" },
    [VIOLATION_TYPES.CROSS_MESSAGE_CONTACT_RECONSTRUCTION]: {
      weight: 100,
      severity: "high",
    },
    [VIOLATION_TYPES.SPLIT_DIGIT_SEQUENCE]: { weight: 90, severity: "high" },
    [VIOLATION_TYPES.RAPID_NUMERIC_FRAGMENTS]: { weight: 70, severity: "high" },
    [VIOLATION_TYPES.CONTEXT_RISK_ELEVATED]: { weight: 60, severity: "medium" },
  };

const SEVERITY_ORDER: Record<ViolationSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const SPOKEN_DIGIT_MAP: ReadonlyArray<[string, string]> = [
  ["zero", "0"],
  ["oh", "0"],
  ["one", "1"],
  ["two", "2"],
  ["three", "3"],
  ["four", "4"],
  ["five", "5"],
  ["six", "6"],
  ["seven", "7"],
  ["eight", "8"],
  ["nine", "9"],
];

const RE_EMAIL =
  /\b[a-z0-9][a-z0-9._%+-]*@[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\b/i;
const RE_URL =
  /\b(?:https?:\/\/|www\.)(?:[^\s<>()]+|\((?:[^\s()<>]+|(?:\([^\s()<>]+\)))*\))+/i;
const RE_SHORT_LINK =
  /\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rb\.gy|cutt\.ly|short\.link|wa\.me|t\.me)\/[^\s]+/i;
const RE_PHONE_NG =
  /\b(?:\+?234[\s\-/]?|0)(?:7[0-9]|8[01]|9[01])\d{1}[\s\-/]?\d{3}[\s\-/]?\d{4}\b/;
const RE_PHONE_INTL_PLUS =
  /\+(?:[1-9]\d{0,2})[\s\-]?(?:\d[\s\-]?){8,14}\d\b/;
const RE_PHONE_GROUPED =
  /\b(?:\(\d{3}\)|\d{3})[\s.\-]?\d{3}[\s.\-]?\d{4}\b/;
const RE_DIGIT_RUN_SPACED = /\b\d(?:[\s.\-_/]+\d){5,}\b/;
const RE_SOCIAL_WORD =
  /\b(?:whatsapp|whats?\s*app|what[\s.\-_]*sapp|wa\b|telegram|instagram|insta\b|facebook|fb\b|messenger|twitter|x\.com|tiktok|snapchat|discord|signal|viber|linkedin|youtube\.com|youtu\.be)\b/i;
const RE_AT_HANDLE = /@[a-z0-9_]{2,30}\b/i;
const RE_OFF_PLATFORM_INTENT = new RegExp(
  [
    "\\bdm\\s+me\\b",
    "\\bpm\\s+me\\b",
    "\\bmessage\\s+me\\s+on\\b",
    "\\bwhatsapp\\s+me\\b",
    "\\bcall\\s+me\\b",
    "\\breach\\s+me\\s+at\\b",
    "\\bcontact\\s+me\\b",
    "\\btext\\s+me\\b",
    "\\badd\\s+me\\s+on\\b",
    "\\bhit\\s+me\\s+up\\b",
    "\\bmy\\s+(?:number|phone|whatsapp|wa|telegram|email)\\b",
    "\\b(?:ping|hmu)\\s+me\\b",
    "\\b(?:send|shoot)\\s+me\\s+(?:a\\s+)?(?:text|dm)\\b",
  ].join("|"),
  "i",
);
const RE_NG_DIGIT_PREFIX = /^(?:\+?234|0)(?:7[0-9]|8[01]|9[01])/;

function collapseDigitSeparators(s: string): string {
  return s.replace(/(\d)(?:[\s.\-_/]+(?=\d))+/g, "$1");
}

/** Treat emoji, punctuation, and invisible chars between digits as separators. */
function collapseObfuscation(s: string): string {
  return String(s ?? "")
    .replace(/[\u200B-\u200D\uFEFF\u2060\uFE0F]/g, "")
    .replace(/(\d)(?:[^0-9A-Za-z]+)(?=\d)/g, "$1");
}

function digitBlob(value: string): string {
  return collapseObfuscation(value).replace(/\D/g, "");
}

function looksLikePhone(value: string): boolean {
  const digits = digitBlob(value);
  return (
    RE_PHONE_NG.test(value) ||
    RE_PHONE_INTL_PLUS.test(value) ||
    RE_PHONE_GROUPED.test(value) ||
    (digits.length >= 10 &&
      digits.length <= 15 &&
      /(?:234|0)(?:7[0-9]|8[01]|9[01])\d{8}/.test(digits))
  );
}

/** Start of an NG mobile number sent in pieces, e.g. "070 😍😍 613". */
function looksLikePhoneFragment(value: string): boolean {
  const digits = digitBlob(value);
  if (digits.length < 6 || digits.length > 15) return false;
  return RE_NG_DIGIT_PREFIX.test(digits);
}

function normalizeSpokenDigits(s: string): string {
  let out = s.toLowerCase();
  for (const [word, digit] of SPOKEN_DIGIT_MAP) {
    out = out.replace(new RegExp(`\\b${word}\\b`, "gi"), digit);
  }
  return out;
}

export function normalizeContextCorpus(s: string): string {
  return collapseObfuscation(
    collapseDigitSeparators(
      normalizeSpokenDigits(String(s ?? "").toLowerCase()),
    ),
  );
}

function addViolation(
  type: string,
  seen: Set<string>,
  details: ViolationDetail[],
): void {
  if (seen.has(type)) return;
  seen.add(type);
  const meta = TYPE_META[type];
  if (meta) {
    details.push({ type, severity: meta.severity, weight: meta.weight });
  } else {
    details.push({ type, severity: "medium", weight: 50 });
  }
}

function computeRiskLevel(riskScore: number, violations: string[]): RiskLevel {
  const criticalTypes = new Set<string>([
    VIOLATION_TYPES.CROSS_MESSAGE_CONTACT_RECONSTRUCTION,
    VIOLATION_TYPES.SPLIT_DIGIT_SEQUENCE,
    VIOLATION_TYPES.PHONE_NUMBER,
    VIOLATION_TYPES.EMAIL_ADDRESS,
  ]);
  if (riskScore >= 220 || violations.some((v) => criticalTypes.has(v))) {
    return "critical";
  }
  if (riskScore >= 140) return "high";
  if (riskScore >= 85) return "medium";
  return "low";
}

function finalizeScan(seen: Set<string>, details: ViolationDetail[]): ScanResult {
  const violations = Array.from(seen);
  if (violations.length === 0) {
    return {
      isAllowed: true,
      violations: [],
      severityScore: 0,
      maxSeverity: "low",
      recommendedAction: "allow",
      details: [],
      riskLevel: "low",
      riskScore: 0,
    };
  }
  let severityScore = 0;
  let maxSev: ViolationSeverity = "low";
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
    recommendedAction: "block",
    details,
    riskLevel,
    riskScore,
  };
}

export function scanMessage(message: string | null | undefined): ScanResult {
  const trimmed = String(message ?? "").trim();
  const empty = finalizeScan(new Set(), []);
  if (!trimmed) return empty;

  const seen = new Set<string>();
  const details: ViolationDetail[] = [];

  if (RE_EMAIL.test(trimmed)) {
    addViolation(VIOLATION_TYPES.EMAIL_ADDRESS, seen, details);
  }
  if (RE_SHORT_LINK.test(trimmed)) {
    addViolation(VIOLATION_TYPES.SHORT_LINK, seen, details);
  } else if (RE_URL.test(trimmed)) {
    addViolation(VIOLATION_TYPES.EXTERNAL_LINK, seen, details);
  }

  const collapsed = collapseDigitSeparators(trimmed);
  const deobfuscated = collapseObfuscation(trimmed);
  const hasStructuredPhone =
    looksLikePhone(trimmed) ||
    looksLikePhone(collapsed) ||
    looksLikePhone(deobfuscated);

  if (hasStructuredPhone) {
    addViolation(VIOLATION_TYPES.PHONE_NUMBER, seen, details);
  }
  if (
    !hasStructuredPhone &&
    (looksLikePhoneFragment(trimmed) ||
      looksLikePhoneFragment(collapsed) ||
      looksLikePhoneFragment(deobfuscated) ||
      RE_DIGIT_RUN_SPACED.test(trimmed) ||
      RE_DIGIT_RUN_SPACED.test(deobfuscated))
  ) {
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
    } else if (
      looksLikePhoneFragment(spokenCollapsed) ||
      /\b\d{10,15}\b/.test(spokenCollapsed)
    ) {
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
  return out.isAllowed ? { ...out, riskLevel: "low", riskScore: 0 } : out;
}

/** @deprecated Use scanMessage */
export function scanAndValidateMessage(message: string | null | undefined): ScanResult {
  return scanMessage(message);
}

function isNumericFragment(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  const compact = collapseObfuscation(t).replace(/\s+/g, "");
  if (!compact || compact.length > MODERATION_CONFIG.RAPID_FRAGMENT_MAX_LEN) {
    return false;
  }
  const digits = (compact.match(/\d/g) ?? []).length;
  return digits >= 1 && digits / Math.max(1, compact.length) >= 0.34;
}

/** 080😍😍 / 326😍😍 — short digit-only chunks used to drip a phone number. */
function isShortDigitFragment(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t || /[a-zA-Z]/.test(t)) return false;
  const digits = digitBlob(t);
  return digits.length >= 2 && digits.length <= 4;
}

function assembledDigits(parts: string[]): string {
  return parts.map((part) => digitBlob(part)).join("");
}

function looksLikeAssembledNgNumber(digits: string): boolean {
  if (digits.length < 6 || digits.length > 15) return false;
  return (
    RE_NG_DIGIT_PREFIX.test(digits) ||
    /(?:234|0)(?:7[0-9]|8[01]|9[01])/.test(digits)
  );
}

function countRapidNumericFragments(
  timeline: Array<{ text: string; sentAt: number }>,
  now: number,
): number {
  const win = MODERATION_CONFIG.RAPID_FRAGMENT_WINDOW_MS;
  let c = 0;
  for (let i = timeline.length - 1; i >= 0; i--) {
    const entry = timeline[i];
    if (!entry) continue;
    if (now - entry.sentAt > win) break;
    if (isNumericFragment(entry.text)) c += 1;
  }
  return c;
}

export type ConversationContextOptions = {
  now?: number;
  messageTimestamps?: number[];
  contextWindowMs?: number;
  sessionBlockCount?: number;
};

export function scanConversationContext(
  currentMessage: string,
  previousMessages: string[],
  options: ConversationContextOptions = {},
): ScanResult {
  const now = options.now ?? Date.now();
  const windowMs = options.contextWindowMs ?? MODERATION_CONFIG.CONTEXT_WINDOW_MS;
  const stamps = options.messageTimestamps;
  const sessionBlocks = Math.max(0, Number(options.sessionBlockCount) || 0);

  const prevRaw = Array.isArray(previousMessages) ? previousMessages : [];
  const prevPairs: Array<{ text: string; sentAt: number }> = [];
  for (let i = 0; i < prevRaw.length; i++) {
    const text = String(prevRaw[i] ?? "").trim();
    if (!text) continue;
    const sentAt = stamps && stamps[i] != null ? Number(stamps[i]) : now;
    if (Number.isFinite(sentAt) && now - sentAt <= windowMs) {
      prevPairs.push({ text, sentAt });
    }
  }

  const current = String(currentMessage ?? "").trim();
  const baseAllow = finalizeScan(new Set(), []);
  if (!current) return { ...baseAllow, fromContextScan: true };

  const parts = [...prevPairs.map((p) => p.text), current];
  if (parts.length < 2) return { ...baseAllow, fromContextScan: true };

  const merged = parts.join(" ");
  const mergedNorm = normalizeContextCorpus(merged);
  const digitsOnly = assembledDigits(parts);

  const scanMerged = scanMessage(merged);
  const scanCurrent = scanMessage(current);

  const seen = new Set<string>();
  const details: ViolationDetail[] = [];

  const mergedContact = scanMerged.violations.filter((v) =>
    CONTACT_VIOLATIONS.has(v),
  );
  const currentContact = scanCurrent.violations.filter((v) =>
    CONTACT_VIOLATIONS.has(v),
  );
  const digitContributors = parts.filter((p) => /\d/.test(p)).length;

  if (mergedContact.length > 0 && currentContact.length === 0) {
    addViolation(
      VIOLATION_TYPES.CROSS_MESSAGE_CONTACT_RECONSTRUCTION,
      seen,
      details,
    );
  }

  const minLen = MODERATION_CONFIG.MIN_SPLIT_DIGIT_LEN;
  const strongLen = MODERATION_CONFIG.STRONG_DIGIT_MERGE_LEN;
  const shortFragments = parts.filter(isShortDigitFragment).length;
  if (digitContributors >= 2 && digitsOnly.length >= minLen) {
    const ngShape =
      looksLikeAssembledNgNumber(digitsOnly) ||
      RE_PHONE_NG.test(mergedNorm) ||
      RE_PHONE_INTL_PLUS.test(mergedNorm) ||
      RE_PHONE_GROUPED.test(mergedNorm) ||
      digitsOnly.length >= strongLen ||
      (shortFragments >= 2 && looksLikeAssembledNgNumber(digitsOnly));
    if (ngShape) {
      addViolation(VIOLATION_TYPES.SPLIT_DIGIT_SEQUENCE, seen, details);
    }
  }

  const timeline = [...prevPairs, { text: current, sentAt: now }].sort(
    (a, b) => a.sentAt - b.sentAt,
  );
  if (
    countRapidNumericFragments(timeline, now) >=
    MODERATION_CONFIG.RAPID_FRAGMENT_MIN_COUNT
  ) {
    addViolation(VIOLATION_TYPES.RAPID_NUMERIC_FRAGMENTS, seen, details);
  }

  const repeatBoost = Math.min(4, sessionBlocks) * 22;

  let out = finalizeScan(seen, details);
  if (out.isAllowed) {
    const composite =
      repeatBoost +
      (digitContributors >= 2 &&
      digitsOnly.length >= MODERATION_CONFIG.STRONG_DIGIT_MERGE_LEN
        ? 55
        : 0);
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

export function logModerationBlock(params: {
  userId: number;
  roomId: string;
  violations: string[];
  severityScore?: number;
  riskScore?: number;
  preview: string;
  context?: boolean;
}): void {
  console.warn(
    "[message_moderation]",
    JSON.stringify({
      ...params,
      preview: params.preview.slice(0, 120),
    }),
  );
}
