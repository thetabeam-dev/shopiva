/**
 * Storefront product shapes for listing + PDP (see mobile contract).
 */
import type { InventoryRow, ProductRow } from "../../models/business/product.js";

export type StorefrontListingProduct = {
  id: string;
  name: string;
  thumbnail: string;
  hasVariants: boolean;
  minPrice: number;
  maxPrice: number;
  /** MVP client filters (not part of the minimal 6-field contract but required by the app grid). */
  gender: string;
  subCategory: string;
  type: string;
};

export type StorefrontVariantDto = {
  id: string;
  attributes: Record<string, string>;
  price: number;
  stock: number;
};

/** DB / drivers may return `specifications` as a JSON string — normalize before reading `.variants`. */
function coerceSpecifications(specifications: unknown): Record<string, unknown> {
  if (specifications == null) return {};
  if (typeof specifications === "string") {
    const s = specifications.trim();
    if (!s) return {};
    try {
      const v = JSON.parse(s) as unknown;
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof specifications === "object" && !Array.isArray(specifications)) {
    return specifications as Record<string, unknown>;
  }
  return {};
}

function parseSpecVariants(specifications: unknown): unknown[] {
  const root = coerceSpecifications(specifications);
  if (!Object.keys(root).length) return [];
  const raw = root.variants;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return Object.keys(raw as Record<string, unknown>)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (raw as Record<string, unknown>)[k])
      .filter((x) => x != null);
  }
  return [];
}

function attrKeyFromLabel(label: string): string {
  const s = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return s || "option";
}

function attributesFromSpecVariant(spec: unknown): Record<string, string> {
  if (!spec || typeof spec !== "object") return {};
  const details = (spec as { details?: unknown }).details;
  if (!Array.isArray(details) || details.length === 0) return {};
  const out: Record<string, string> = {};
  for (const d of details) {
    if (!d || typeof d !== "object") continue;
    const r = d as Record<string, unknown>;
    const label = String(r.label ?? "").trim();
    const value = String(r.value ?? "").trim();
    if (!value) continue;
    const key = label ? attrKeyFromLabel(label) : "option";
    out[key] = value;
  }
  return out;
}

/** Per-option price from `specifications.variants[]` when it differs from the single inventory row. */
function priceFromSpecVariant(spec: unknown, inventoryFallback: number): number {
  if (!spec || typeof spec !== "object") return inventoryFallback;
  const s = spec as Record<string, unknown>;
  for (const key of [
    "price",
    "unitPrice",
    "unit_price",
    "amount",
    "selling_price",
    "sellingPrice",
    "sale_price",
    "salePrice",
  ]) {
    if (!(key in s)) continue;
    const n = Number(s[key]);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  const details = s.details;
  if (Array.isArray(details)) {
    for (const d of details) {
      if (!d || typeof d !== "object") continue;
      const r = d as Record<string, unknown>;
      const label = String(r.label ?? "")
        .trim()
        .toLowerCase();
      if (!label || !/(price|amount|cost|unit\s*price)/i.test(label)) continue;
      const rawVal = r.value;
      const asNum =
        typeof rawVal === "number" && Number.isFinite(rawVal)
          ? rawVal
          : Number(String(rawVal ?? "").replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(asNum) && asNum >= 0) return asNum;
    }
  }
  return inventoryFallback;
}

function availableStock(inv: InventoryRow): number {
  const qty = Number(inv.quantity) || 0;
  const reserved = Number(inv.reserved_quantity) || 0;
  const track = inv.track_inventory !== false;
  if (!track) return Math.max(0, qty);
  return Math.max(0, qty - reserved);
}

function inferListingFilters(p: ProductRow): { gender: string; subCategory: string; type: string } {
  const subRaw = String(p.subcategory ?? "").trim().toLowerCase();
  const catRaw = String(p.category ?? "").trim().toLowerCase();
  const subCategory = subRaw || catRaw || "general";
  const tags = Array.isArray(p.tags) ? p.tags.map((t) => String(t).toLowerCase()) : [];
  const type = tags[0] || subCategory;
  let gender = "Male";
  const brand = String(p.brand ?? "").toLowerCase();
  if (brand.includes("female") || tags.some((t) => t.includes("female"))) gender = "Female";
  else if (brand.includes("male") || tags.some((t) => t.includes("male"))) gender = "Male";
  return { gender, subCategory, type };
}

function groupInventoryByProductId(rows: InventoryRow[]): Map<number, InventoryRow[]> {
  const m = new Map<number, InventoryRow[]>();
  for (const r of rows) {
    const pid = r.product_id;
    const arr = m.get(pid) ?? [];
    arr.push(r);
    m.set(pid, arr);
  }
  for (const [, arr] of m) {
    arr.sort((a, b) => a.id - b.id);
  }
  return m;
}

export function buildStorefrontListingProducts(
  products: ProductRow[],
  inventoryRows: InventoryRow[]
): StorefrontListingProduct[] {
  const byPid = groupInventoryByProductId(inventoryRows);
  const out: StorefrontListingProduct[] = [];
  for (const p of products) {
    const inv = byPid.get(p.id) ?? [];
    const prices = inv.map((i) => Number(i.price)).filter((x) => Number.isFinite(x));
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const specCount = parseSpecVariants(coerceSpecifications(p.specifications)).length;
    const hasVariants = inv.length > 1 || (inv.length === 1 && specCount > 1);
    const imgs = Array.isArray(p.images) ? p.images : [];
    const thumbnail = typeof imgs[0] === "string" ? imgs[0].trim() : "";
    const f = inferListingFilters(p);
    out.push({
      id: String(p.id),
      name: String(p.name ?? "").trim() || "Product",
      thumbnail,
      hasVariants,
      minPrice,
      maxPrice,
      gender: f.gender,
      subCategory: f.subCategory,
      type: f.type,
    });
  }
  return out;
}

function findSpecForInventory(specs: unknown[], invId: number, invIndex: number, inventoryRowCount: number): unknown | null {
  const linked = specs.find((s) => {
    if (!s || typeof s !== "object") return false;
    const link = Number((s as Record<string, unknown>).inventory_id ?? (s as Record<string, unknown>).inventoryId);
    return Number.isFinite(link) && link > 0 && link === invId;
  });
  if (linked) return linked;
  if (inventoryRowCount === 1 && specs.length) return specs[0] ?? null;
  return specs[invIndex] ?? null;
}

export function buildStorefrontProductDetail(
  product: ProductRow,
  inventory: InventoryRow[]
): Record<string, unknown> {
  const images = Array.isArray(product.images) ? product.images.map((x) => String(x).trim()).filter(Boolean) : [];
  const invRows = inventory
    .filter((r) => r.product_id === product.id)
    .sort((a, b) => a.id - b.id);
  const specs = parseSpecVariants(coerceSpecifications(product.specifications));

  const base = {
    id: String(product.id),
    shop_id: product.shop_id,
    name: String(product.name ?? "").trim() || "Product",
    description: typeof product.description === "string" ? product.description : "",
    images,
    /** Used by storefront controller; must reflect DB or PDP always 404s. */
    is_published: Boolean(product.is_published),
  };

  if (invRows.length === 0) {
    return {
      ...base,
      hasVariants: false,
      price: 0,
      stock: 0,
      inventoryId: null as string | null,
    };
  }

  /**
   * One inventory row but multiple variant rows in `specifications.variants` (common when vendors
   * define options in JSON before duplicating SKUs). Expose the same inventory id for each option
   * so the storefront can render pickers; add-to-cart still uses the single SKU row.
   */
  if (invRows.length === 1 && specs.length > 1) {
    const inv = invRows[0]!;
    const stock = availableStock(inv);
    const invPrice = Number(inv.price) || 0;
    const variants: StorefrontVariantDto[] = specs.map((spec, index) => {
      let attributes = attributesFromSpecVariant(spec);
      if (!Object.keys(attributes).length) {
        attributes = { option: `Option ${index + 1}` };
      }
      const rowPrice = priceFromSpecVariant(spec, invPrice);
      return {
        id: String(inv.id),
        attributes,
        price: rowPrice,
        stock,
      };
    });
    return {
      ...base,
      hasVariants: true,
      variants,
      price: invPrice,
      stock,
      inventoryId: String(inv.id),
      allowBackorder: Boolean(inv.allow_backorder),
    };
  }

  if (invRows.length === 1) {
    const inv = invRows[0]!;
    const stock = availableStock(inv);
    return {
      ...base,
      hasVariants: false,
      price: Number(inv.price) || 0,
      stock,
      inventoryId: String(inv.id),
      allowBackorder: Boolean(inv.allow_backorder),
    };
  }

  const variants: StorefrontVariantDto[] = invRows.map((inv, index) => {
    const spec = findSpecForInventory(specs, inv.id, index, invRows.length);
    let attributes = attributesFromSpecVariant(spec);
    if (!Object.keys(attributes).length) {
      attributes = { option: `Option ${index + 1}` };
    }
    const invPrice = Number(inv.price) || 0;
    const rowPrice = spec ? priceFromSpecVariant(spec, invPrice) : invPrice;
    return {
      id: String(inv.id),
      attributes,
      price: rowPrice,
      stock: availableStock(inv),
    };
  });

  return {
    ...base,
    hasVariants: true,
    variants,
  };
}
