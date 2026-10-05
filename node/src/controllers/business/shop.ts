/**
 * SHOP CONTROLLER
 * 
 * Handles all HTTP request/response operations for shop endpoints:
 * - Shop CRUD operations
 * - Shop policy management
 * - Shop data retrieval
 * 
 * @see services/business/shop.ts for business logic
 * @see routes/business/shop.ts for route definitions
 */

import type { Request, Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import {
    CreateShopService,
    UpdateShopService,
    DeleteShopService,
    CreateShopPolicyService,
    UpdateShopPolicyService,
    GetShopService,
    GetShopReviewsService,
    GetShopMetricsService,
    CreatePayoutAccountService,
    UpdatePayoutAccountService,
    GetPayoutAccountService,
    DeletePayoutAccountService,
    VerifyPayoutAccountService,
    ListBanksService,
    GetShopsByOwnerIdService,
    HasShopService,
    GetShopBySlugService,
    GetShopByNameService,
    PatchShopPolicyClauseService,
    GetShopTransactionsService,
    GetShopsForDiscoverByCategoryService,
    GetShopOwnerByShopIdService,
} from "../../services/business/shop.js";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NAME_MAX = 255;
const SLUG_MAX = 255;
const DESCRIPTION_MAX = 5000;

function slugify(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, SLUG_MAX) || "shop";
}

/**
 * Create a new shop (token-based: ownerId from JWT). For use by the site frontend.
 * POST /shop/create
 */
export async function CreateShopByTokenController(req: Request, res: Response) {
    try {
        const user = (req as AuthRequest).user;
        if (!user?.id) {
            res.status(401).json({ success: false, error: "Unauthorized. Please sign in to create a shop." });
            return;
        }
        const { name, slug: bodySlug, description, vendorType: vendorTypeBody, category: categoryBody, location: locationPayload } = req.body;
        const nameStr = typeof name === "string" ? name.trim() : "";
        let slug = typeof bodySlug === "string" ? bodySlug.trim().toLowerCase() : "";
        if (!nameStr) {
            res.status(400).json({ success: false, error: "Shop name is required." });
            return;
        }
        if (nameStr.length > NAME_MAX) {
            res.status(400).json({ success: false, error: `Shop name must be ${NAME_MAX} characters or less.` });
            return;
        }
        if (!slug) slug = slugify(nameStr);
        if (slug.length < 1 || slug.length > SLUG_MAX) {
            res.status(400).json({ success: false, error: `Slug must be between 1 and ${SLUG_MAX} characters.` });
            return;
        }
        if (!SLUG_REGEX.test(slug)) {
            res.status(400).json({ success: false, error: "Slug can only contain lowercase letters, numbers, and hyphens." });
            return;
        }

        /**
         * Category is required: matches `shops.category VARCHAR(100)` and the values
         * shipped in the client's mvp_category.json (e.g. "fashion"). Stored lowercased
         * so downstream filters (e.g. /discover/vendors?category=) match.
         */
        const categoryStr = typeof categoryBody === "string" ? categoryBody.trim().toLowerCase() : "";
        if (!categoryStr) {
            res.status(400).json({ success: false, error: "Category is required." });
            return;
        }
        if (categoryStr.length > 100) {
            res.status(400).json({ success: false, error: "Category must be 100 characters or less." });
            return;
        }
        const existingName = await GetShopByNameService(nameStr);
        if (existingName?.length > 0) {
            res.status(409).json({ success: false, error: "A shop with this name already exists. Please choose another name." });
            return;
        }
        const existingSlug = await GetShopBySlugService(slug);
        if (existingSlug?.length > 0) {
            res.status(409).json({ success: false, error: "This shop URL is already taken. Please choose another." });
            return;
        }
        const descriptionStr =
            typeof description === "string" ? description.trim().slice(0, DESCRIPTION_MAX) : null;
        const allowedVendorTypes = ["manufacturer", "reseller", "dropshipper"] as const;
        const vendorType =
            typeof vendorTypeBody === "string" && allowedVendorTypes.includes(vendorTypeBody as typeof allowedVendorTypes[number])
                ? (vendorTypeBody as typeof allowedVendorTypes[number])
                : "reseller";
        let locationJson: Record<string, unknown> | null = null;
        if (locationPayload != null && typeof locationPayload === "object" && locationPayload.coordinates) {
            const coords = locationPayload.coordinates as { lat?: number; lng?: number };
            const lat = typeof coords?.lat === "number" ? coords.lat : typeof coords?.lat === "string" ? parseFloat(coords.lat) : null;
            const lng = typeof coords?.lng === "number" ? coords.lng : typeof coords?.lng === "string" ? parseFloat(coords.lng) : null;
            if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
                locationJson = {
                    address: typeof locationPayload.address === "string" ? locationPayload.address.slice(0, 500) : null,
                    city: typeof locationPayload.city === "string" ? locationPayload.city.slice(0, 255) : null,
                    state: typeof locationPayload.state === "string" ? locationPayload.state.slice(0, 255) : null,
                    country: typeof locationPayload.country === "string" ? locationPayload.country.slice(0, 255) : null,
                    zipcode: typeof locationPayload.zipcode === "string" ? locationPayload.zipcode.slice(0, 50) : null,
                    coordinates: { lat, lng },
                };
            }
        }
        const created = await CreateShopService({
            ownerId: user.id,
            name: nameStr,
            slug,
            description: descriptionStr ?? null,
            logo: null,
            category: categoryStr,
            vendortype: vendorType,
            location: locationJson ?? null,
        });
        const row = created as Record<string, unknown>;
        res.status(201).json({
            success: true,
            shop: {
                id: row.id,
                name: row.name,
                slug: row.slug,
                status: row.status,
                createdAt: row.createdAt ?? row.createdat,
            },
        });
    } catch (err) {
        const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
        if (code === "23505") {
            res.status(409).json({ success: false, error: "This shop URL is already taken. Please choose another." });
            return;
        }
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : "Could not create shop. Please try again.",
        });
    }
}

/**
 * Create a new shop (legacy: ownerId from path)
 * POST /shop/create/:id
 */
export async function CreateShopController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            // console.log(req.params)
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { name, slug, vendortype, description, logo, category } = req.body;
        const ownerId = req.params.id;

        const result = await CreateShopService({
            ownerId,
            name,
            slug,
            vendortype,
            description,
            logo,
            category,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        res.status(201).json({
            message: "Shop created successfully",
            result
        });
    } catch (err) {
        res.status(400).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

/**
 * Update an existing shop
 * POST /shop/update/:id
 */
export async function UpdateShopController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const {
            name,
            slug,
            description,
            logo,
            banner,
            category,
            tags,
            contactEmail,
            contactPhone,
            vendorType,
            location,
            socialLinks,
            isActive,
            isVerified,
            status,
            verificationDocuments
        } = req.body;

        const result = await UpdateShopService({
            ownerId: req.params.id as unknown as number,
            shopId: req.params.shopId as unknown as number,
            name,
            slug,
            description,
            logo,
            banner,
            category,
            tags,
            contactEmail,
            contactPhone,
            vendorType,
            location,
            socialLinks,
            isActive,
            isVerified,
            status,
            verificationDocuments,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
      
        res.status(200).json({
            message: "Shop updated successfully",
            result
        });
    } catch (err) {
        console.log(err)
        res.status(400).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

/**
 * Delete a shop
 * POST /shop/delete/:id
 */
export async function DeleteShopController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        await DeleteShopService(req.params.shopId as unknown as number);

        res.status(200).json({
            message: "Shop deleted successfully"
        });
    } catch (err) {
        res.status(500).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

/**
 * Create shop policy
 * POST /shop/policy/create/:id
 */
export async function CreateShopPolicyController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { deliveryPolicy, refundPolicy, customPolicies } = req.body;
        const shopId = req.params.shopId as unknown as number;

        const result = await CreateShopPolicyService({
            shopId,
            deliveryPolicy,
            refundPolicy,
            customPolicies,
        });

        res.status(201).json({
            message: "Shop policy created successfully",
            result
        });
    } catch (err) {
        res.status(400).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

/**
 * Update shop policy
 * POST /shop/policy/update/:id
 */
export async function UpdateShopPolicyController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const { deliveryPolicy, refundPolicy, customPolicies } = req.body;
        const policyId = req.params.policyId as unknown as number;

        const result = await UpdateShopPolicyService({
            // id: policyId,
            policyId,
            deliveryPolicy,
            refundPolicy,
            customPolicies
        });

        res.status(200).json({
            message: "Shop policy updated successfully",
            result
        });
    } catch (err) {
        res.status(400).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

/**
 * Create shop payout account
 * POST /shop/payment/:shopId/:id
 */
export async function CreateShopPaymentController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const shopId = req.params.shopId;
        
        if (!shopId) {
            res.status(400).json({ error: "Shop ID required" });
            return;
        }

        const {
            bank_name,
            bank_code,
            account_name,
            account_number,
            verification_method,
            status
        } = req.body;

        const result = await CreatePayoutAccountService({
            shopId,
            bank_name,
            bank_code,
            account_name,
            account_number,
            
            verification_method,
            status
        });

        res.status(201).json({
            message: "Payout account created successfully",
            result
        });
    } catch (err) {
        res.status(400).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

/**
 * Update shop payout account
 * PUT /shop/payment/:shopId/:id
 */
export async function UpdateShopPaymentController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const shopId = req.params.shopId;
        
        if (!shopId) {
            res.status(400).json({ error: "Shop ID required" });
            return;
        }

        const {
            bank_name,
            bank_code,
            account_name,
            account_number,
            provider_recipient_id,
            provider_account_id,
            verification_method,
            status
        } = req.body;

        const result = await UpdatePayoutAccountService({
            shopId,
            bank_name,
            bank_code,
            account_name,
            account_number,
            provider_recipient_id,
            provider_account_id,
            verification_method,
            status
        });

        res.status(200).json({
            message: "Payout account updated successfully",
            result
        });
    } catch (err) {
        res.status(400).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

/**
 * Get shop payout account
 * GET /shop/payment/:shopId/:id
 */
export async function GetShopPaymentController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const shopId = req.params.shopId;
        if (!shopId) {
            res.status(400).json({ error: "Shop ID required" });
            return;
        }

        const payoutAccount = await GetPayoutAccountService(shopId);
        res.status(200).json({
            success: true,
            payoutAccount,
        });
    } catch (err) {
        res.status(500).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

/**
 * Delete shop payout account
 * DELETE /shop/payment/:shopId/:id
 */
export async function DeleteShopPaymentController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const shopId = req.params.shopId;
        if (!shopId) {
            res.status(400).json({ error: "Shop ID required" });
            return;
        }
        await DeletePayoutAccountService(shopId);
        res.status(200).json({ success: true, message: "Payout account deleted." });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "Payout account not found.") {
            res.status(404).json({ success: false, error: msg });
            return;
        }
        res.status(500).json({ success: false, error: msg });
    }
}

/**
 * Verify bank account number via Paystack
 * GET /shop/payment/verify/:id?account_number=...&bank_code=...
 */
export async function VerifyShopPaymentAccountController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const account_number = String(req.query.account_number ?? "").trim();
        const bank_code = String(req.query.bank_code ?? "").trim();
        if (!/^\d{10}$/.test(account_number)) {
            res.status(400).json({ error: "Account number must be 10 digits." });
            return;
        }
        if (!bank_code) {
            res.status(400).json({ error: "Bank code is required." });
            return;
        }
        const result = await VerifyPayoutAccountService({ account_number, bank_code }) as Record<string, unknown>;
        const ok = Boolean(result?.status);
        if (!ok) {
            res.status(400).json({ success: false, error: String(result?.message ?? "Account verification failed.") });
            return;
        }
        const data = (result?.data ?? {}) as Record<string, unknown>;
        res.status(200).json({
            success: true,
            account_name: data?.account_name ?? null,
            account_number: data?.account_number ?? null,
            bank_code: data?.bank_code ?? bank_code,
            bank_name: data?.bank_name ?? null,
            raw: result,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

/**
 * List supported banks from Paystack
 * GET /shop/payment/banks/:id
 */
export async function ListPayoutBanksController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const result = await ListBanksService() as Record<string, unknown>;
        const banks = Array.isArray(result?.data) ? result.data : [];
        res.status(200).json({ success: true, banks });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

/**
 * Get shop transaction overview + table rows
 * GET /shop/:shopId/transactions/:id
 */
export async function GetShopTransactionsController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const shopId = req.params.shopId;
        if (!shopId) {
            res.status(400).json({ error: "Shop ID required" });
            return;
        }
        const data = await GetShopTransactionsService(shopId);
        res.status(200).json({ success: true, ...data });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

/**
 * Get shop details
 * GET /shop/:id
 */
export async function GetShopController(req: Request, res: Response) {
    try {
        if (!req.params?.shopId) {
            res.status(400).json({ error: "Shop ID required" });
            return;
        }

        const shopId = parseInt(req.params.shopId, 10);
        
        if (isNaN(shopId)) {
            res.status(400).json({ error: "Invalid Shop ID" });
            return;
        }

        const shop = await GetShopService(shopId);

        res.status(200).json({
            message: "Shop retrieved successfully",
            shop
        });
    } catch (err) {
        res.status(500).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

/**
 * Get shop reviews
 * GET /shop/reviews/:id
 */
export async function GetShopReviewsController(req: Request, res: Response) {
    try {
        if (!req.params?.shopId) {
            res.status(400).json({ error: "Shop ID required" });
            return;
        }

        const shopId = parseInt(req.params.shopId, 10);
        
        if (isNaN(shopId)) {
            res.status(400).json({ error: "Invalid Shop ID" });
            return;
        }

        const reviews = await GetShopReviewsService(shopId);

        res.status(200).json({
            message: "Shop reviews retrieved successfully",
            reviews
        });
    } catch (err) {
        res.status(500).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

/**
 * Get shop metrics
 * GET /shop/metrics/:id
 */
export async function GetShopMetricsController(req: Request, res: Response) {
    try {
        if (!req.params?.shopId) {
            res.status(400).json({ error: "Shop ID required" });
            return;
        }

        const shopId = parseInt(req.params.shopId, 10);
        
        if (isNaN(shopId)) {
            res.status(400).json({ error: "Invalid Shop ID" });
            return;
        }

        const metrics = await GetShopMetricsService(shopId);

        res.status(200).json({
            message: "Shop metrics retrieved successfully",
            metrics
        });
    } catch (err) {
        res.status(500).json({
            error: err instanceof Error ? err.message : String(err)
        });
    }
}

/**
 * Public vendor discovery by category (no auth). Includes shops without map coordinates.
 * GET /discover/vendors
 * GET /discover/vendors?category=fashion
 */
export async function ListShopsForDiscoverByCategoryController(req: Request, res: Response) {
    try {
        const raw = req.query?.category;
        const category = typeof raw === "string" ? raw.trim() : "";
        if (category.length > 120) {
            res.status(400).json({ error: "Query parameter category is too long." });
            return;
        }
        const ownerId = Number((req as Request & { user?: { id?: unknown } }).user?.id);
        const vendors = await GetShopsForDiscoverByCategoryService(
            category,
            Number.isFinite(ownerId) && ownerId > 0 ? ownerId : undefined,
        );

        res.status(200).json({ vendors });
    } catch (err) {
        res.status(500).json({
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

/**
 * Get vendor (owner) profile for a shop.
 * GET /shop/:shopId/owner
 * Auth: Bearer JWT (`verifyToken`). Returns `{ result: [owner] }` for mobile client.
 */
export async function GetShopOwnerByShopIdController(req: Request, res: Response) {
    try {
        const user = (req as AuthRequest).user;
        if (!user?.id) {
            res.status(401).json({ success: false, error: "Unauthorized" });
            return;
        }
        const shopId = parseInt(String(req.params.shopId ?? ""), 10);
        if (!Number.isFinite(shopId) || shopId < 1) {
            res.status(400).json({ success: false, error: "Invalid shop ID" });
            return;
        }
        const owner = await GetShopOwnerByShopIdService(shopId);
        res.status(200).json({
            success: true,
            message: "Shop owner retrieved successfully",
            result: [owner],
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "Shop not found") {
            res.status(404).json({ success: false, error: msg, result: [] });
            return;
        }
        res.status(500).json({ success: false, error: msg, result: [] });
    }
}

/**
 * Get all shops for an owner (by user id).
 * GET /shop/owner/:id
 */
export async function GetShopsByOwnerController(req: Request, res: Response) {
    try {
        if (!req.params?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const ownerId = req.params.id;
        const shops = await GetShopsByOwnerIdService(ownerId);
        res.status(200).json({ shops });
    } catch (err) {
        res.status(400).json({
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

/**
 * Check if the authenticated user has an existing shop (for post-login/signup redirect).
 * Uses JWT user id from verifyToken. Returns { hasShop: boolean }.
 * GET /shop/has-shop
 */
export async function HasShopController(req: Request, res: Response) {
    try {
        const user = (req as AuthRequest).user;
        if (!user?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const hasShop = await HasShopService(user.id);
        res.status(200).json({ hasShop });
    } catch (err) {
        res.status(500).json({
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

/**
 * Append a delivery / refund / custom policy clause (site frontend).
 * POST /shop/patch/:shopId/policy-clause
 */
export async function PatchShopPolicyClauseController(req: Request, res: Response) {
    try {
        const user = (req as AuthRequest).user;
        if (!user?.id) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const shopId = parseInt(req.params.shopId ?? "", 10);
        if (isNaN(shopId)) {
            res.status(400).json({ error: "Invalid shop ID" });
            return;
        }
        const { target, title, content } = req.body as {
            target?: string;
            title?: string;
            content?: string;
        };
        await PatchShopPolicyClauseService(shopId, user.id, {
            target: target ?? "",
            title: title ?? "",
            content: content ?? "",
        });
        res.status(200).json({ success: true, message: "Policy clause saved" });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "Forbidden") {
            res.status(403).json({ error: msg });
            return;
        }
        if (msg === "Shop not found") {
            res.status(404).json({ error: msg });
            return;
        }
        res.status(400).json({ error: msg });
    }
}

