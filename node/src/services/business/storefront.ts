import { shop as shopModel } from "../../models/business/shop.js";
import {
  product as productModel,
  inventory as inventoryModel,
  type ProductRow,
  type InventoryRow,
} from "../../models/business/product.js";
import { GetProductWithInventoryService } from "./product.js";
import { buildStorefrontListingProducts, buildStorefrontProductDetail } from "./storefrontProductDto.js";
import {
  GetShippingFeeModelService,
  GetShippingMultiItemDiscountService,
  GetShippingZonesByShopService,
} from "./shipping.js";

export async function GetStorefrontShopByIdService(shopId: number) {
  const rows = await shopModel.getShopById(shopId);
  const row = Array.isArray(rows) ? rows[0] : rows;
  const slug = String((row as { slug?: unknown } | undefined)?.slug ?? "").trim();
  if (!slug) return null;
  return GetStorefrontShopBySlugService(slug);
}

export async function GetStorefrontShopBySlugService(slug: string) {
  const row = await shopModel.getStorefrontBySlug(slug);
  if (!row) return null;
  const shopId = (row as { id: number }).id;
  let shopPolicies: {
    deliverypolicy: unknown;
    refundpolicy: unknown;
    custompolicies: unknown;
  } | null = null;
  let shopReviewMetrics: Record<string, unknown> | null = null;
  if (shopId != null && Number.isFinite(Number(shopId))) {
    const sid = Number(shopId);
    const policyRows = await shopModel.getShopPoliciesByShopId(sid);
    const pr = policyRows?.[0];
    if (pr) {
      shopPolicies = {
        deliverypolicy: parseJsonbPolicyField(pr.deliverypolicy),
        refundpolicy: parseJsonbPolicyField(pr.refundpolicy),
        custompolicies: parseJsonbPolicyField(pr.custompolicies),
      };
    }

    const metricRows = await shopModel.getShopMetricsById(sid);
    shopReviewMetrics = (metricRows?.[0] as Record<string, unknown> | undefined) ?? null;
    if (shopReviewMetrics) {
      row.average_rating = Number(shopReviewMetrics.average_rating ?? row.average_rating ?? 0);
      row.review_count = Number(shopReviewMetrics.review_count ?? row.review_count ?? 0);
    }
  }
  const reviews = shopId != null && Number.isFinite(Number(shopId))
    ? await shopModel.getStorefrontReviewsByShopId(Number(shopId))
    : [];
  return { shop: row, shopPolicies, shopReviewMetrics, reviews };
}

export async function GetStorefrontProductsByShopIdService(shopId: number) {
  const products = await productModel.listPublishedByShopId(shopId);
  const ids = products.map((p: { id: number }) => p.id);
  const inventoryRows = ids.length ? await inventoryModel.getByProductIds(ids) : [];
  return buildStorefrontListingProducts(products as ProductRow[], inventoryRows as InventoryRow[]);
}

type HomeFeedRow = ProductRow & {
  feed_shop_id?: unknown;
  feed_shop_slug?: unknown;
  feed_shop_name?: unknown;
  feed_shop_rating?: unknown;
  feed_shop_review_count?: unknown;
  feed_sold?: unknown;
};

/**
 * Paginated buyer home catalog (cross-shop).
 */
export async function GetStorefrontHomeProductsService(limit = 40, offset = 0) {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const rows = (await productModel.listPublishedHomeFeed(safeLimit + 1, safeOffset)) as HomeFeedRow[];
  const hasMore = rows.length > safeLimit;
  const page = hasMore ? rows.slice(0, safeLimit) : rows;
  const ids = page
    .map((p: HomeFeedRow) => Number(p.id))
    .filter((id: number) => Number.isFinite(id) && id > 0);
  const inventoryRows = ids.length ? await inventoryModel.getByProductIds(ids) : [];
  const listed = buildStorefrontListingProducts(page as ProductRow[], inventoryRows as InventoryRow[]);
  const byId = new Map(page.map((row: HomeFeedRow) => [String(row.id), row]));
  const products = listed.map((item) => {
    const row = byId.get(String(item.id));
    const shopId = Number(row?.feed_shop_id ?? row?.shop_id) || 0;
    return {
      ...item,
      thumbnail: item.thumbnail || String(row?.thumbnail_url ?? "").trim(),
      sold: Number(row?.feed_sold) || 0,
      featured: Boolean(row?.is_featured),
      is_featured: Boolean(row?.is_featured),
      compareAtPrice: item.maxPrice > item.minPrice ? item.maxPrice : 0,
      shop: {
        id: shopId,
        slug: String(row?.feed_shop_slug ?? "").trim(),
        name: String(row?.feed_shop_name ?? "").trim(),
        ratingAverage: Number(row?.feed_shop_rating) || 0,
        average_rating: Number(row?.feed_shop_rating) || 0,
        reviewCount: Number(row?.feed_shop_review_count) || 0,
        review_count: Number(row?.feed_shop_review_count) || 0,
      },
    };
  });
  return {
    products,
    hasMore,
    nextOffset: safeOffset + products.length,
  };
}

/** JSONB columns are usually objects; normalize string payloads for consistent clients. */
function parseJsonbPolicyField(v: unknown): unknown {
  if (v == null) return null;
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as unknown;
    } catch {
      return v;
    }
  }
  return v;
}

export async function GetStorefrontProductService(productId: number) {
  const data = await GetProductWithInventoryService(productId);
  const productRow = data.product as ProductRow;
  const inventoryRows = data.inventory as InventoryRow[];
  const productDto = buildStorefrontProductDetail(productRow, inventoryRows);
  const shopId = productRow.shop_id;
  let shopSlug = "";
  let shopName = "";
  let shopPolicies: {
    deliverypolicy: unknown;
    refundpolicy: unknown;
    custompolicies: unknown;
  } | null = null;
  let productReviews: unknown[] = [];
  let reviewMetrics: Record<string, unknown> | null = null;
  if (shopId != null && Number.isFinite(Number(shopId))) {
    const sid = Number(shopId);
    const policyRows = await shopModel.getShopPoliciesByShopId(sid);
    const pr = policyRows?.[0];
    if (pr) {
      shopPolicies = {
        deliverypolicy: parseJsonbPolicyField(pr.deliverypolicy),
        refundpolicy: parseJsonbPolicyField(pr.refundpolicy),
        custompolicies: parseJsonbPolicyField(pr.custompolicies),
      };
    }
    const shopRows = await shopModel.getShopById(sid);
    const shopRow = shopRows?.[0] as { slug?: unknown; name?: unknown } | undefined;
    shopSlug = typeof shopRow?.slug === "string" ? shopRow.slug.trim() : "";
    shopName = typeof shopRow?.name === "string" ? shopRow.name.trim() : "";
  }
  productDto.slug = shopSlug;
  productDto.shopName = shopName;
  productReviews = await productModel.getProductReviewsByProductId(productId);
  const metricRows = await productModel.getProductReviewMetricsByProductId(productId);
  reviewMetrics = (metricRows as Record<string, unknown> | undefined) ?? null;
  return { product: productDto, shopPolicies, productReviews, reviewMetrics };
}

export type StorefrontDeliveryLocation = {
  key: string;
  name: string;
  fee: number;
  zoneId: string;
  zoneName: string;
  discountPercent: number;
};

export type StorefrontShopDelivery = {
  shopId: number;
  method: { title: string; description: string };
  discountPercent: number;
  locations: StorefrontDeliveryLocation[];
};

function displayDeliveryLocationName(raw: string): string {
  const t = String(raw ?? "").trim();
  const lower = t.toLowerCase();
  if (
    lower === "fct abuja" ||
    lower === "abuja (fct)" ||
    lower === "federal capital territory" ||
    lower === "fct" ||
    lower === "abuja"
  ) {
    return "Abuja (FCT)";
  }
  return t.replace(/\s+state$/i, "").trim() || t;
}

function deliveryLocationKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Public buyer-facing delivery zones + first-item fees for a shop. */
export async function GetStorefrontShopDeliveryService(
  shopId: number
): Promise<StorefrontShopDelivery | null> {
  if (!Number.isFinite(shopId) || shopId <= 0) {
    throw new Error("Invalid shop id");
  }

  const rows = await shopModel.getShopById(shopId);
  const shop = Array.isArray(rows) ? rows[0] : rows;
  if (!shop || (shop as { isactive?: boolean }).isactive === false) {
    return null;
  }

  const [zones, feeModel, multiItem] = await Promise.all([
    GetShippingZonesByShopService(shopId),
    GetShippingFeeModelService(shopId).catch(() => null),
    GetShippingMultiItemDiscountService(shopId).catch(() => null),
  ]);

  const fallbackDiscount = Number(
    feeModel?.discount_percent ?? multiItem?.discount_percent ?? 50
  );

  const seen = new Set<string>();
  const locations: StorefrontDeliveryLocation[] = [];
  for (const zone of zones) {
    const fee = Math.max(0, Math.round(Number(zone.base_fee) || 0));
    const discountPercent = Number.isFinite(Number(zone.discount_percent))
      ? Number(zone.discount_percent)
      : fallbackDiscount;
    const rawLocations = Array.isArray(zone.locations) ? zone.locations : [];
    for (const loc of rawLocations) {
      const name = displayDeliveryLocationName(String(loc ?? ""));
      if (!name) continue;
      const key = deliveryLocationKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      locations.push({
        key,
        name,
        fee,
        zoneId: String(zone.zone_id ?? ""),
        zoneName: String(zone.name ?? "").trim() || name,
        discountPercent,
      });
    }
  }

  locations.sort((a, b) => a.name.localeCompare(b.name));

  return {
    shopId,
    method: {
      title: "Vendor delivery",
      description: "Delivered directly by the vendor.",
    },
    discountPercent: fallbackDiscount,
    locations,
  };
}
