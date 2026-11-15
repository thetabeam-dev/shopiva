import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isProductEligibleForMerchant,
  validateMerchantProductAttributes,
} from "../validation.js";

describe("validateMerchantProductAttributes", () => {
  it("requires core Shopping attributes", () => {
    const result = validateMerchantProductAttributes({}, { offerId: "" });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /offerId/i.test(e)));
    assert.ok(result.errors.some((e) => /title/i.test(e)));
  });

  it("accepts a complete attribute set", () => {
    const result = validateMerchantProductAttributes(
      {
        title: "Leather bag",
        description: "Handmade",
        link: "https://www.deedyte.com/1",
        imageLink: "https://cdn.deedyte.com/a.jpg",
        availability: "IN_STOCK",
        condition: "NEW",
        price: { amountMicros: "5000000000", currencyCode: "NGN" },
      },
      { offerId: "deedyte-s1-p1" }
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.errors, []);
  });
});

describe("isProductEligibleForMerchant", () => {
  it("rejects unpublished products", () => {
    const result = isProductEligibleForMerchant({
      is_published: false,
      thumbnail_url: "https://cdn.deedyte.com/x.jpg",
      name: "Item",
      shop_slug: "shop",
      price: 10,
      shop_isactive: true,
    });
    assert.equal(result.eligible, false);
    assert.ok(result.reasons.some((r) => /not published/i.test(r)));
  });

  it("accepts published products with image and price", () => {
    const result = isProductEligibleForMerchant({
      is_published: true,
      thumbnail_url: "https://cdn.deedyte.com/x.jpg",
      name: "Item",
      shop_slug: "shop",
      price: 2500,
      shop_isactive: true,
      status: "active",
    });
    assert.equal(result.eligible, true);
  });
});
