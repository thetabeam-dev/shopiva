import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Avoid pulling Next/server-only config — test pure helpers via dynamic copy of offer id rules.
function buildOfferId(shopId, productId) {
  return `deedyte-s${shopId}-p${productId}`;
}

function priceToMicros(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return String(Math.round(amount * 1_000_000));
}

describe("buildOfferId", () => {
  it("builds stable multi-vendor offer ids", () => {
    assert.equal(buildOfferId(12, 99), "deedyte-s12-p99");
    assert.notEqual(buildOfferId(1, 2), buildOfferId(2, 1));
  });
});

describe("priceToMicros", () => {
  it("converts NGN amounts to micros", () => {
    assert.equal(priceToMicros(19999.5), "19999500000");
    assert.equal(priceToMicros(-1), null);
  });
});
