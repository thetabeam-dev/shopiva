export const NIGERIA_GEO_ZONES = [
  {
    name: "North Central",
    states: [
      "Benue State",
      "FCT Abuja",
      "Kogi State",
      "Kwara State",
      "Nasarawa State",
      "Niger State",
      "Plateau State",
    ],
  },
  {
    name: "North East",
    states: [
      "Adamawa State",
      "Bauchi State",
      "Borno State",
      "Gombe State",
      "Taraba State",
      "Yobe State",
    ],
  },
  {
    name: "North West",
    states: [
      "Jigawa State",
      "Kaduna State",
      "Kano State",
      "Katsina State",
      "Kebbi State",
      "Sokoto State",
      "Zamfara State",
    ],
  },
  {
    name: "South East",
    states: ["Abia State", "Anambra State", "Ebonyi State", "Enugu State", "Imo State"],
  },
  {
    name: "South South",
    states: [
      "Akwa Ibom State",
      "Bayelsa State",
      "Cross River State",
      "Delta State",
      "Edo State",
      "Rivers State",
    ],
  },
  {
    name: "South West",
    states: [
      "Ekiti State",
      "Lagos State",
      "Ogun State",
      "Ondo State",
      "Osun State",
      "Oyo State",
    ],
  },
] as const;

export function findGeoZoneByName(name: string | undefined | null) {
  const key = String(name ?? "").trim().toLowerCase();
  if (!key) return null;
  return NIGERIA_GEO_ZONES.find((zone) => zone.name.toLowerCase() === key) ?? null;
}

export function assertValidShippingZone(name: string, locations: unknown) {
  const geo = findGeoZoneByName(name);
  if (!geo) {
    throw new Error(
      "Choose a Nigerian geo-political zone (North Central, North East, North West, South East, South South, or South West).",
    );
  }
  if (!Array.isArray(locations) || locations.length === 0) {
    throw new Error("Select at least one state in this geo-political zone.");
  }
  const allowed = new Set(geo.states as readonly string[]);
  const invalid = locations
    .map((loc) => String(loc ?? "").trim())
    .filter((loc) => loc && !allowed.has(loc));
  if (invalid.length > 0) {
    throw new Error(
      `These locations are not in ${geo.name}: ${invalid.join(", ")}.`,
    );
  }
  return geo;
}
