/**
 * SHOP SERVICE
 * 
 * Handles all business logic related to shop operations:
 * - Shop creation, update, and deletion
 * - Shop policy management
 * - Shop payout account management
 * - Shop data retrieval
 * 
 * @see models/business/shop.ts for database operations
 * @see types/business.ts for type definitions
 */

import { shop } from "../../models/business/shop.js";
import type { NewPayoutAccount, NewShopDocument, ShopDocument, ShopPolicies, TransferRecipientResponse } from "../../types/business.js";
import { paystack } from "../paystack.js";

/**
 * Create a new shop
 */
export async function CreateShopService(payload: NewShopDocument) {
    const result = await shop.createShop(payload);
    if (result == null) {
        throw new Error("Failed to create shop");
    }
    return result;
}

/**
 * Update an existing shop
 */
export async function UpdateShopService(payload: ShopDocument) {
    const result = await shop.updateShop(payload);
    
    if (result === 0) {
        throw new Error("Shop not found or failed to update");
    }

    return result;
}

/**
 * Delete a shop
 */
export async function DeleteShopService(shopId: number) {
    const result = await shop.deleteShop(shopId);
    
    if (result === 0) {
        throw new Error("Shop not found or failed to delete");
    }

    return result;
}

/**
 * Create shop policies
 */
export async function CreateShopPolicyService(payload: ShopPolicies) {
    const result = await shop.createPolicy(payload);
    
    if (result === 0) {
        throw new Error("Failed to create shop policy");
    }

    return result;
}

/**
 * Update shop policies
 */
export async function UpdateShopPolicyService(payload: ShopPolicies) {
    // Note: You may need to add an updatePolicy method in the shop model
    // For now, this is a placeholder that follows the pattern
    const result = await shop.updatePolicy(payload);
    
    if (result === 0) {
        throw new Error("Failed to update shop policy");
    }

    return result;
}

/**
 * Get shop by ID
 */
export async function GetShopService(shopId: number) {
    const result = await shop.getShopById(shopId);

    if (!result || result.length === 0) {
        throw new Error("Shop not found");
    }

    const row = result[0];
    const policyRows = await shop.getShopPoliciesByShopId(shopId);
    const pr = policyRows?.[0] as Record<string, unknown> | undefined;
    const policies =
        pr != null
            ? {
                  deliverypolicy:
                      pr.deliverypolicy ?? pr.deliveryPolicy ?? pr.DeliveryPolicy,
                  refundpolicy:
                      pr.refundpolicy ?? pr.refundPolicy ?? pr.RefundPolicy,
                  custompolicies:
                      pr.custompolicies ??
                      pr.customPolicies ??
                      pr.CustomPolicies,
              }
            : null;

    return { ...row, policies };
}

/**
 * Get all shops owned by a user (by owner id)
 */
export async function GetShopsByOwnerIdService(ownerId: string | number) {
    return shop.getShopsByOwnerId(ownerId);
}

function parseUserLocation(raw: unknown): Record<string, unknown> | null {
    if (raw == null) return null;
    if (typeof raw === "object" && !Array.isArray(raw)) {
        return raw as Record<string, unknown>;
    }
    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw) as unknown;
            if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
        } catch {
            return null;
        }
    }
    return null;
}

/** Map joined shop+owner row to a safe vendor profile (no password / tokens). */
function mapShopOwnerRow(row: Record<string, unknown>) {
    return {
        id: row.id,
        fname: row.fname,
        lname: row.lname,
        email: row.email,
        phone: row.phone ?? null,
        gender: row.gender ?? null,
        role: row.role != null ? String(row.role) : null,
        location: parseUserLocation(row.location),
        preferredLanguage: row.preferredlanguage ?? "en",
        timezone: row.timezone ?? "UTC",
        isEmailVerified: Boolean(row.isemailverified),
        isPhoneVerified: Boolean(row.isphoneverified),
        lastLogin: row.lastlogin != null ? String(row.lastlogin) : null,
        shopId: row.shop_id,
        shopName: row.shop_name,
        shopSlug: row.shop_slug,
    };
}

/**
 * Resolve the vendor (owner) user record for a shop id.
 * @returns owner profile object
 * @throws if shop does not exist
 */
export async function GetShopOwnerByShopIdService(shopId: number) {
    const row = await shop.getShopOwnerByShopId(shopId);
    if (!row) {
        throw new Error("Shop not found");
    }
    return mapShopOwnerRow(row as Record<string, unknown>);
}

/**
 * Check if the authenticated user has at least one shop (for post-auth redirect).
 */
export async function HasShopService(ownerId: number): Promise<boolean> {
    const shops = await shop.getShopsByOwnerId(ownerId);
    return Array.isArray(shops) && shops.length > 0;
}

/**
 * Check if a slug is already taken
 */
export async function GetShopBySlugService(slug: string) {
    return shop.getShopBySlug(slug);
}

/**
 * Check if a shop name already exists (case-insensitive)
 */
export async function GetShopByNameService(name: string) {
    return shop.getShopByName(name);
}

/**
 * Append a policy clause (delivery / refund / custom) for a shop. Token auth; owner must match.
 * Used by site Next.js → POST /shop/patch/:shopId/policy-clause
 */
export async function PatchShopPolicyClauseService(
    shopId: number,
    userId: number,
    body: { target: string; title: string; content: string }
) {
    const row = await GetShopService(shopId);
    const r = row as Record<string, unknown>;
    const ownerId = r.ownerid ?? r.ownerId;
    if (String(ownerId) !== String(userId)) {
        throw new Error("Forbidden");
    }
    const allowed = ["delivery", "refund", "custom"];
    if (!allowed.includes(body.target)) {
        throw new Error("Invalid policy target; use delivery, refund, or custom.");
    }
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!title || !content) {
        throw new Error("Title and content are required.");
    }
    await shop.appendPolicyClause({
        shopId,
        target: body.target as "delivery" | "refund" | "custom",
        title,
        content,
    });
    return { ok: true as const };
}

/**
 * Get shop reviews by shop ID
 */
export async function GetShopReviewsService(shopId: number) {
    const result = await shop.getShopReviewsById(shopId);
    
    return result || [];
}

/**
 * Get shop metrics by shop ID
 */
export async function GetShopMetricsService(shopId: number) {
    const result = await shop.getShopMetricsById(shopId);
    
    return result?.[0] || {};
}

export type ShopMapVendorRow = {
    id: number;
    name: string;
    slug: string;
    logo: string | null;
    lat: number;
    lng: number;
    /** Shop `location.state` when present (for same-state vs buyer highlighting). */
    state: string | null;
    /** Street or full address line from `location.address`. */
    address: string | null;
    /** Town / city from `location.city`. */
    city: string | null;
};

/** Public category discovery (list/browse). Coordinates optional when shop has no geo yet. */
export type ShopDiscoverVendorRow = Omit<ShopMapVendorRow, "lat" | "lng"> & {
    lat: number | null;
    lng: number | null;
    ratingAverage?: number | null;
    reviewCount?: number;
    products?: { thumbnail_url: string }[];
};

/** Map UI category keys (e.g. from mvp_category.json) to common DB forms like health_beauty. */
function categoryMatchValues(category: string): string[] {
    const t = category.trim();
    if (!t) return [];
    const out = new Set<string>();
    out.add(t);
    const underscored = t
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    if (underscored) out.add(underscored);
    return Array.from(out);
}

function parseStateFromLocation(location: unknown): string | null {
    if (location == null || typeof location !== "object") return null;
    const s = (location as { state?: unknown }).state;
    if (typeof s !== "string") return null;
    const t = s.trim();
    return t.length ? t : null;
}

function parseAddressAndCityFromLocation(location: unknown): { address: string | null; city: string | null } {
    if (location == null || typeof location !== "object") return { address: null, city: null };
    const o = location as { address?: unknown; city?: unknown };
    const address = typeof o.address === "string" ? o.address.trim() : "";
    const city = typeof o.city === "string" ? o.city.trim() : "";
    return {
        address: address.length ? address : null,
        city: city.length ? city : null,
    };
}

function parseShopLocationCoords(location: unknown): { lat: number; lng: number } | null {
    if (location == null || typeof location !== "object") return null;
    const loc = location as Record<string, unknown>;
    const coords = loc.coordinates;

    const toValidPair = (latRaw: unknown, lngRaw: unknown): { lat: number; lng: number } | null => {
        const lat = Number(latRaw);
        const lng = Number(lngRaw);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
        return { lat, lng };
    };

    // Most common shape: { coordinates: { lat, lng } }.
    if (coords != null && typeof coords === "object" && !Array.isArray(coords)) {
        const c = coords as Record<string, unknown>;
        const direct = toValidPair(c.lat, c.lng) ?? toValidPair(c.latitude, c.longitude);
        if (direct) return direct;
        // GeoJSON Point: { type: "Point", coordinates: [lng, lat] }
        if (c.type === "Point" && Array.isArray(c.coordinates) && c.coordinates.length >= 2) {
            const geojson = toValidPair(c.coordinates[1], c.coordinates[0]);
            if (geojson) return geojson;
        }
    }

    // Legacy array shape: [lat, lng]
    if (Array.isArray(coords) && coords.length >= 2) {
        const arrPair = toValidPair(coords[0], coords[1]);
        if (arrPair) return arrPair;
    }

    // Legacy top-level shape: { latitude, longitude } or { lat, lng }
    const topLevel = toValidPair(loc.latitude, loc.longitude) ?? toValidPair(loc.lat, loc.lng);
    if (topLevel) return topLevel;

    return null;
}

/**
 * Public discovery: active shops in a category (matches `shops.category`), with optional coordinates.
 * @see GET /discover/vendors
 */
export async function GetShopsForDiscoverByCategoryService(category: string): Promise<ShopDiscoverVendorRow[]> {
    const variants = categoryMatchValues(category);
    const rows = await shop.listShopsForMapByCategory(variants);
    if (!Array.isArray(rows)) return [];
    const out: ShopDiscoverVendorRow[] = [];
    for (const r of rows as Record<string, unknown>[]) {
        const id = Number(r.id);
        const name = typeof r.name === "string" ? r.name : "";
        const slug = typeof r.slug === "string" ? r.slug : "";
        const logo = typeof r.logo === "string" ? r.logo.trim() : "";
        if (!Number.isFinite(id)) continue;
        const coords = parseShopLocationCoords(r.location);
        const { address, city } = parseAddressAndCityFromLocation(r.location);
        const ratingAverageRaw = Number(r.average_rating ?? r.ratingAverage ?? r.averageRating ?? 0);
        const reviewCountRaw = Number(r.review_count ?? r.reviewCount ?? 0);
        const ratingAverage = Number.isFinite(ratingAverageRaw) && ratingAverageRaw > 0 ? ratingAverageRaw : null;
        const reviewCount = Number.isFinite(reviewCountRaw) && reviewCountRaw >= 0 ? Math.floor(reviewCountRaw) : 0;
        const products = Array.isArray(r.products)
            ? r.products.flatMap((item) => {
                if (!item || typeof item !== "object") return [];
                const thumbnail = String((item as { thumbnail_url?: unknown }).thumbnail_url ?? "").trim();
                return thumbnail ? [{ thumbnail_url: thumbnail }] : [];
            })
            : [];
        out.push({
            id,
            name,
            slug,
            logo: logo || null,
            lat: coords?.lat ?? null,
            lng: coords?.lng ?? null,
            state: parseStateFromLocation(r.location),
            address,
            city,
            ratingAverage,
            reviewCount,
            products,
        });
    }
    return out;
}

/**
 * Shops with valid coordinates only (map markers). Subset of {@link GetShopsForDiscoverByCategoryService}.
 */
export async function GetShopsForMapByCategoryService(category: string): Promise<ShopMapVendorRow[]> {
    const rows = await GetShopsForDiscoverByCategoryService(category);
    return rows
        .filter((v): v is ShopMapVendorRow => v.lat != null && v.lng != null)
        .map((v) => ({ ...v, lat: v.lat as number, lng: v.lng as number }));
}

/**
 * Create shop payout account
 */
export async function CreatePayoutAccountService(payload: Partial<NewPayoutAccount>) {

    const recipient_bank_data = {
        name: payload.account_name as unknown as string,
        account_number: payload.account_number as unknown as number,
        bank_code: payload.bank_code as unknown as string
    };

    const {
        data, status, message
    } = await paystack.createRecipient(recipient_bank_data) as unknown as TransferRecipientResponse;

    if(!status) {
        throw new Error(`Failed to create payout account while generating recipient code: ${message}`, );
    }
    const updatedPayoutAccountData = {
        ...payload, 
        provider_recipient_id: data.recipient_code,
        provider_account_id: data.id,
        account_number: typeof payload.account_number === 'string'
            ? Number(payload.account_number)
            : undefined,
        status: 'verified',
        verification_method: 'bank'
    };

    const result = await shop.createPayoutAccount(updatedPayoutAccountData);
    
    if (result === 0) {
        throw new Error("Failed to create payout account");
    }

    return result;
}

/**
 * Update shop payout account
 */
export async function UpdatePayoutAccountService(payload: Partial<NewPayoutAccount>) {

    const recipient_bank_data = {
        name: payload.account_name as unknown as string,
        account_number: payload.account_number as unknown as number,
        bank_code: payload.bank_code as unknown as string
    };

    const {
        data, status, message
    } = await paystack.createRecipient(recipient_bank_data) as unknown as TransferRecipientResponse;

    if(!status) {
        throw new Error(`Failed to create payout account while generating recipient code: ${message}`, );
    }
    const updatedPayoutAccountData = {
        ...payload, 
        provider_recipient_id: data.recipient_code,
        provider_account_id: data.id,
        account_number: typeof payload.account_number === 'string'
            ? Number(payload.account_number)
            : undefined,
        status: 'verified',
        verification_method: 'bank'
    };

    const result = await shop.updatePayoutAccount(updatedPayoutAccountData);
    
    if (result === 0) {
        throw new Error("Payout account not found or failed to update");
    } 

    return result;
}

/**
 * Get primary payout account for a shop
 */
export async function GetPayoutAccountService(shopId: string | number) {
    return shop.getPayoutAccountByShopId(shopId);
}

export async function DeletePayoutAccountService(shopId: string | number) {
    const deleted = await shop.deletePayoutAccountByShopId(shopId);
    if (!deleted) throw new Error("Payout account not found.");
    return { deleted: true as const };
}

export async function VerifyPayoutAccountService(payload: { account_number: string; bank_code: string }) {
    return paystack.verifyAccountNumber(payload);
}

export async function ListBanksService() {
    return paystack.listBanks();
}

export async function GetShopTransactionsService(shopId: string | number) {
    const overviewRow = (await shop.getTransactionOverviewByShopId(shopId)) as Record<string, unknown> | null;
    const ledgerRows = (await shop.getTransactionsByShopId(shopId, 200)) as Array<Record<string, unknown>>;

    const overview = {
        available_balance: Number(overviewRow?.available_balance ?? 0),
        pending_escrow: Number(overviewRow?.pending_escrow ?? 0),
        total_earnings: Number(overviewRow?.total_earnings ?? 0),
        total_withdrawal: Number(overviewRow?.total_withdrawal ?? 0),
        currency: String(overviewRow?.currency ?? "NGN"),
    };

    const transactions = ledgerRows.map((r) => {
        const sourceType = String(r.source_type ?? "");
        const sourceId = r.source_id != null ? String(r.source_id) : "";
        const amount = Number(r.amount ?? 0);
        const direction = String(r.direction ?? "");
        const type = sourceType === "payout" ? "Payout" : sourceType === "refund" ? "Refund" : "Sale";
        const refPrefix = sourceType === "payout" ? "PAYOUT" : sourceType === "refund" ? "REFUND" : "ORD";
        const status = sourceType === "dispute_hold" ? "Pending" : "Completed";
        return {
            date: r.created_at,
            type,
            reference: sourceId ? `${refPrefix}-${sourceId}` : refPrefix,
            amount: direction === "debit" ? -Math.abs(amount) : Math.abs(amount),
            status,
        };
    });

    return { overview, transactions };
}
