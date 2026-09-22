/**
 * Tunables for chat moderation (single-message + cross-message context).
 * Adjust here without touching detection heuristics.
 */

export const MODERATION_CONFIG = Object.freeze({
  /** Recent outgoing messages considered for cross-message reconstruction. */
  HISTORY_MAX_MESSAGES: 10,

  /** Ignore prior fragments older than this (time decay). */
  CONTEXT_WINDOW_MS: 120_000,

  /** Merged digit-only string length threshold (requires ≥2 contributing messages). */
  MIN_SPLIT_DIGIT_LEN: 7,

  /** Treat long merged digit blobs as higher confidence. */
  STRONG_DIGIT_MERGE_LEN: 10,

  /** Short numeric bursts inside this window contribute “rapid fragment” risk. */
  RAPID_FRAGMENT_WINDOW_MS: 50_000,

  /** Messages longer than this are not counted as “numeric fragments”. */
  RAPID_FRAGMENT_MAX_LEN: 6,

  /** How many rapid numeric touches trigger a violation. */
  RAPID_FRAGMENT_MIN_COUNT: 3,

  /** Context / combined risk must meet this to hard-block when only contextual signals fire. */
  CONTEXT_BLOCK_RISK_SCORE: 75,

  /** Optional local chat compose lock after repeated blocks in one room (client-only). */
  SESSION_BLOCKS_FOR_LOCK: 3,
  CHAT_LOCK_DURATION_MS: 60_000,
});
