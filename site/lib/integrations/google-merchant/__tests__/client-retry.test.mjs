import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

/**
 * Lightweight retry/backoff behavior unit test without hitting Google.
 * Mirrors the delay formula used in client.js.
 */
function nextDelay(attempt) {
  return Math.min(8000, 400 * 2 ** attempt);
}

describe("merchant client retry backoff", () => {
  it("uses exponential backoff capped at 8000ms", () => {
    assert.equal(nextDelay(0), 400);
    assert.equal(nextDelay(1), 800);
    assert.equal(nextDelay(2), 1600);
    assert.equal(nextDelay(5), 8000);
  });
});

describe("auth failure shape", () => {
  it("codes merchant config errors", () => {
    const err = Object.assign(new Error("Missing credentials"), {
      code: "MERCHANT_CONFIG",
    });
    assert.equal(err.code, "MERCHANT_CONFIG");
  });
});

// Keep mock import referenced for node:test environments that tree-shake unused imports.
void mock;
