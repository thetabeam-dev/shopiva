import test from "node:test";
import assert from "node:assert/strict";

const {
  getShopSetupFaults,
  parseShopLocationCoords,
  shopSetupFaultInstructions,
} = await import("../dist/utils/shopSetup.js");

test("parseShopLocationCoords accepts current and legacy coordinate shapes", () => {
  assert.deepEqual(
    parseShopLocationCoords({ coordinates: { lat: 6.5244, lng: 3.3792 } }),
    { lat: 6.5244, lng: 3.3792 },
  );
  assert.deepEqual(
    parseShopLocationCoords({
      coordinates: {
        type: "Point",
        coordinates: [3.3792, 6.5244],
      },
    }),
    { lat: 6.5244, lng: 3.3792 },
  );
  assert.deepEqual(parseShopLocationCoords({ coordinates: [6.5244, 3.3792] }), {
    lat: 6.5244,
    lng: 3.3792,
  });
  assert.equal(parseShopLocationCoords({ coordinates: null }), null);
  assert.equal(
    parseShopLocationCoords({ coordinates: { lat: 120, lng: 3.3792 } }),
    null,
  );
});

test("getShopSetupFaults returns every incomplete setup item", () => {
  const faults = getShopSetupFaults({
    noProducts: true,
    shippingNotConfigured: true,
    coordinatesNotSet: true,
  });

  assert.deepEqual(faults, [
    "no_products",
    "shipping_not_configured",
    "coordinates_not_set",
  ]);
  assert.deepEqual(shopSetupFaultInstructions(faults), [
    "upload at least one product",
    "set your shipping zones and prices",
    "add your shop coordinates",
  ]);
});

test("getShopSetupFaults returns no faults for a complete shop", () => {
  assert.deepEqual(
    getShopSetupFaults({
      noProducts: false,
      shippingNotConfigured: false,
      coordinatesNotSet: false,
    }),
    [],
  );
});
