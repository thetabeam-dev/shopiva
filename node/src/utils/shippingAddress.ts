/** Persist checkout address as JSON text. area_2 and zipcode may be empty. */
export function persistShippingAddress(value: unknown): string {
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return JSON.stringify({
      state: String(row.state ?? "").trim(),
      city: String(row.city ?? "").trim(),
      street_address: String(row.street_address ?? row.street ?? "").trim(),
      area_1: String(row.area_1 ?? row.area1 ?? "").trim(),
      area_2: String(row.area_2 ?? row.area2 ?? "").trim(),
      zipcode: String(row.zipcode ?? row.zip ?? "").trim(),
    });
  }
  return String(value ?? "");
}
