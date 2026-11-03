export type ShopSetupFault =
  | "no_products"
  | "shipping_not_configured"
  | "coordinates_not_set";

export type ShopSetupAuditFlags = {
  noProducts: boolean;
  shippingNotConfigured: boolean;
  coordinatesNotSet: boolean;
};

export function parseShopLocationCoords(
  location: unknown,
): { lat: number; lng: number } | null {
  if (location == null || typeof location !== "object") return null;
  const loc = location as Record<string, unknown>;
  const coords = loc.coordinates;

  const toValidPair = (
    latRaw: unknown,
    lngRaw: unknown,
  ): { lat: number; lng: number } | null => {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  };

  if (coords != null && typeof coords === "object" && !Array.isArray(coords)) {
    const coordinateObject = coords as Record<string, unknown>;
    const direct =
      toValidPair(coordinateObject.lat, coordinateObject.lng) ??
      toValidPair(coordinateObject.latitude, coordinateObject.longitude);
    if (direct) return direct;

    if (
      coordinateObject.type === "Point" &&
      Array.isArray(coordinateObject.coordinates) &&
      coordinateObject.coordinates.length >= 2
    ) {
      const geoJson = toValidPair(
        coordinateObject.coordinates[1],
        coordinateObject.coordinates[0],
      );
      if (geoJson) return geoJson;
    }
  }

  if (Array.isArray(coords) && coords.length >= 2) {
    const arrayPair = toValidPair(coords[0], coords[1]);
    if (arrayPair) return arrayPair;
  }

  return (
    toValidPair(loc.latitude, loc.longitude) ??
    toValidPair(loc.lat, loc.lng)
  );
}

export function getShopSetupFaults(
  flags: ShopSetupAuditFlags,
): ShopSetupFault[] {
  const faults: ShopSetupFault[] = [];
  if (flags.noProducts) faults.push("no_products");
  if (flags.shippingNotConfigured) {
    faults.push("shipping_not_configured");
  }
  if (flags.coordinatesNotSet) faults.push("coordinates_not_set");
  return faults;
}

export function shopSetupFaultInstructions(
  faults: readonly ShopSetupFault[],
): string[] {
  const instructions: string[] = [];
  if (faults.includes("no_products")) {
    instructions.push("upload at least one product");
  }
  if (faults.includes("shipping_not_configured")) {
    instructions.push("set your shipping zones and prices");
  }
  if (faults.includes("coordinates_not_set")) {
    instructions.push("add your shop coordinates");
  }
  return instructions;
}
