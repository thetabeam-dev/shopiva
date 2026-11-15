import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Pure duplicate-prevention logic mirrored from ensurePrimaryDataSource matching.
 */
function findExistingPrimary(existing, { feedLabel, targetCountry }) {
  return existing.find((ds) => {
    const display = String(ds.displayName || "").toLowerCase();
    const isApi = String(ds.input || "").toUpperCase() === "API";
    const isPrimary = Boolean(ds.primaryProductDataSource);
    const countries = ds.primaryProductDataSource?.countries || [];
    const label = String(ds.primaryProductDataSource?.feedLabel || "");
    return (
      isApi &&
      isPrimary &&
      (display.includes("deedyte") ||
        label === feedLabel ||
        countries.includes(targetCountry))
    );
  });
}

describe("data source duplicate prevention", () => {
  it("reuses an existing DeeDyte API primary source", () => {
    const existing = [
      {
        name: "accounts/1/dataSources/9",
        dataSourceId: "9",
        displayName: "Other",
        input: "FILE",
        primaryProductDataSource: { countries: ["NG"], feedLabel: "NG" },
      },
      {
        name: "accounts/1/dataSources/42",
        dataSourceId: "42",
        displayName: "DeeDyte Primary API Products",
        input: "API",
        primaryProductDataSource: { countries: ["NG"], feedLabel: "NG" },
      },
    ];
    const match = findExistingPrimary(existing, {
      feedLabel: "NG",
      targetCountry: "NG",
    });
    assert.equal(match.dataSourceId, "42");
  });

  it("returns undefined when no primary API source matches", () => {
    const match = findExistingPrimary(
      [{ input: "API", displayName: "Unrelated", primaryProductDataSource: null }],
      { feedLabel: "NG", targetCountry: "NG" }
    );
    assert.equal(match, undefined);
  });
});
