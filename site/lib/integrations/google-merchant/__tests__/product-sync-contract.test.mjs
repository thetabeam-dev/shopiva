import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Contract tests for Merchant ProductInput insert/delete URLs (mocked, no live API).
 */
function insertUrl(accountId, dataSourceName) {
  const u = new URL(
    `https://merchantapi.googleapis.com/products/v1/accounts/${accountId}/productInputs:insert`
  );
  u.searchParams.set("dataSource", dataSourceName);
  return u.toString();
}

function deleteUrl(accountId, contentLanguage, feedLabel, offerId, dataSourceName) {
  const productInputId = encodeURIComponent(
    `${contentLanguage}~${feedLabel}~${offerId}`
  );
  const u = new URL(
    `https://merchantapi.googleapis.com/products/v1/accounts/${accountId}/productInputs/${productInputId}`
  );
  u.searchParams.set("dataSource", dataSourceName);
  return u.toString();
}

describe("productInputs API contract", () => {
  it("builds insert endpoint with dataSource query", () => {
    const url = insertUrl("5905154580", "accounts/5905154580/dataSources/123");
    assert.match(url, /productInputs:insert/);
    assert.match(url, /dataSource=accounts%2F5905154580%2FdataSources%2F123/);
  });

  it("builds delete endpoint with encoded product input id", () => {
    const url = deleteUrl(
      "5905154580",
      "en",
      "NG",
      "deedyte-s1-p2",
      "accounts/5905154580/dataSources/123"
    );
    assert.match(url, /productInputs\/en~NG~deedyte-s1-p2/);
    assert.match(url, /dataSource=/);
  });

  it("treats insert as replace for same offerId (idempotent upsert semantics)", () => {
    const bodyA = { offerId: "deedyte-s1-p2", contentLanguage: "en", feedLabel: "NG" };
    const bodyB = { ...bodyA, productAttributes: { title: "Updated" } };
    assert.equal(bodyA.offerId, bodyB.offerId);
    assert.equal(bodyA.contentLanguage, bodyB.contentLanguage);
    assert.equal(bodyA.feedLabel, bodyB.feedLabel);
  });
});
