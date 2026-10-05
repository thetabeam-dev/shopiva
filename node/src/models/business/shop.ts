/**
 * SHOP MODEL
 * 
 * Handles all database operations related to shop:
 * - Shop creation and authentication
 * - Shop information updates (name, title, description, location)
 * - Shop data retrieval and validation
 * 
 * @see types/user.ts for type definitions
 * @see middleware/auth.ts for authentication middleware
 */

import { db } from "../../config/database.js"
import type { NewPayoutAccount, NewShopDocument, ShopDocument, ShopPolicies } from "../../types/business.js";
import { withErrorHandling } from "../../utils/errHandler.js"

export class shop{

    static createShop = withErrorHandling( async (payload: NewShopDocument) => {
        const {
            ownerId, name, description, logo, category, slug, vendortype, location
        } = payload;
        const locationJson = location != null ? JSON.stringify(location) : JSON.stringify({
            address: null, city: null, state: null, country: null, zipcode: null, coordinates: null
        });
        const {
            rows,
            rowCount
        } = await (await db()).query(
            `
                INSERT INTO shops(ownerId, name, slug, description, logo, category, vendortype, location, createdAt, updatedAt)
                VALUES($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW(), NOW())
                RETURNING id, name, slug, status, createdat AS "createdAt"
            `,
            [ownerId, name, slug, description ?? null, logo ?? null, category ?? null, vendortype ?? null, locationJson]
        );

        return rowCount ? rows?.[0] : null;
    });

    static getShopBySlug = withErrorHandling( async (slug: string) => {
        const { rows } = await (await db()).query(
            `SELECT 1 FROM shops WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        return rows;
    });

    static getShopByName = withErrorHandling( async (name: string) => {
        const { rows } = await (await db()).query(
            `SELECT 1 FROM shops WHERE LOWER(name) = LOWER($1) LIMIT 1`,
            [name]
        );
        return rows;
    });

    static deleteShop = withErrorHandling( async (shopId: number) => {
        const { rowCount } = await (await db()).query(
            `DELETE FROM shops WHERE id = $1`,
            [shopId]
        );

        return rowCount;
    });

    static updateShop = withErrorHandling( async (payload: ShopDocument) => {
        const {
            ownerId,
            shopId,
            name,
            slug,
            description,
            logo,
            banner,
            category,
            tags,
            contactEmail,
            contactPhone,
          
            // Vendor Type
            vendorType,
          
            // Location & Social
            location,
            socialLinks,
          
            // Status & Verification
            isActive,
            isVerified,
            status,
            verificationDocuments,
          
        } = payload;

        const {
            rows
        } = await (await db()).query(
            `
               UPDATE shops SET 
                name = $1,
                slug = $2,
                description = $3,
                logo = $4,
                banner = $5,
                category = $6,
                tags = $7,
                contactEmail = $8,
                contactPhone = $9,
                vendorType = $10,
                location = $11,
                socialLinks = $12,
                isActive = $13,
                isVerified = $14,
                status = $15,
                verificationDocuments = $16,
                updatedAt = NOW()
               WHERE id = $17
               RETURNING *
            `,
            [
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
                JSON.stringify(location),
                JSON.stringify(socialLinks),
                isActive,
                isVerified,
                status,
                JSON.stringify(verificationDocuments),
                shopId
            ]
        );

        return rows;
    });

    static  createPolicy = withErrorHandling( async (payload: ShopPolicies) => {
        const {
            shopId, deliveryPolicy, refundPolicy, customPolicies
        } = payload;
        console.log(shopId)
        const { rowCount } = await (await db()).query(
            `
            INSERT INTO shop_policies (
              shopid,
              deliverypolicy,
              refundpolicy,
              custompolicies,
              createdAt,
              updatedAt
            )
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            `,
            [
              shopId,
              JSON.stringify(deliveryPolicy),
              JSON.stringify(refundPolicy),
              JSON.stringify(customPolicies)
            ]
        );
          

        return rowCount;
    })

    static  updatePolicy = withErrorHandling( async (payload: ShopPolicies) => {
        const {
            policyId, deliveryPolicy, refundPolicy, customPolicies
        } = payload;

        const { rows } = await (await db()).query(
            `
              UPDATE shop_policies
              SET
                deliveryPolicy = $1,
                refundPolicy   = $2,
                customPolicies = $3,
                updatedAt      = NOW()
              WHERE id = $4
              RETURNING *
            `,
            [
              JSON.stringify(deliveryPolicy),
              JSON.stringify(refundPolicy),
              JSON.stringify(customPolicies),
              policyId
            ]
        );
          

        return rows;
    })

    static getShopById = withErrorHandling(async (shopId: number) => {

        const {
            rows
        } =  await (await db()).query(
            `
                SELECT * FROM shops WHERE id = $1
            `, [shopId]
        );

        return rows;
    })

    /** Public storefront: active shop row by URL slug. */
    static getStorefrontBySlug = withErrorHandling(async (slug: string) => {
        const { rows } = await (await db()).query(
            `SELECT * FROM shops WHERE slug = $1 AND isactive = true LIMIT 1`,
            [slug]
        );
        return rows[0] ?? null;
    });

    /** One row from shop_policies for dashboard / vendor UI (delivery, refund, custom JSON). */
    static getShopPoliciesByShopId = withErrorHandling(async (shopId: number) => {
        const { rows } = await (await db()).query<{
            deliverypolicy: unknown;
            refundpolicy: unknown;
            custompolicies: unknown;
        }>(
            `SELECT deliverypolicy, refundpolicy, custompolicies FROM shop_policies WHERE shopid = $1 LIMIT 1`,
            [shopId]
        );
        return rows;
    });

    static getShopsByOwnerId = withErrorHandling(async (ownerId: string | number) => {
        const {
            rows
        } = await (await db()).query(
            `SELECT * FROM shops WHERE ownerid = $1 ORDER BY id`,
            [String(ownerId)]
        );
        return rows;
    });

    /** Vendor (shop owner) profile for a shop — joins `users` on `shops.ownerid`. */
    static getShopOwnerByShopId = withErrorHandling(async (shopId: number) => {
        const { rows } = await (await db()).query(
            `
                SELECT
                    u.id,
                    u.fname,
                    u.lname,
                    u.email,
                    u.phone,
                    u.gender,
                    u.role,
                    u.location,
                    u.preferredlanguage,
                    u.timezone,
                    u.isemailverified,
                    u.isphoneverified,
                    u.lastlogin,
                    s.id AS shop_id,
                    s.name AS shop_name,
                    s.slug AS shop_slug
                FROM shops s
                INNER JOIN users u ON u.id = s.ownerid
                WHERE s.id = $1
                LIMIT 1
            `,
            [shopId]
        );
        return rows[0] ?? null;
    });

    static appendPolicyClause = withErrorHandling(
      async (params: {
        shopId: number;
        target: "delivery" | "refund" | "custom";
        title: string;
        content: string;
      }) => {
        const clause = { title: params.title, content: params.content };
        const defaultDelivery = {
          restrictions: null,
          processingTime: null,
          shippingMethods: [],
          domesticShipping: { regions: [], available: true },
          trackingProvided: true,
          interstateShipping: { available: false, countries: [] },
        };
        const defaultRefund = {
          refundMethod: "original_payment",
          returnWindow: 30,
          restockingFee: 0,
          returnConditions: null,
          damagedItemsPolicy: null,
          refundProcessingTime: null,
        };

        const parseJson = (v: unknown) => {
          if (v == null) return null;
          if (typeof v === "object") return v as Record<string, unknown>;
          if (typeof v === "string") {
            try {
              return JSON.parse(v) as Record<string, unknown>;
            } catch {
              return {};
            }
          }
          return {};
        };

        const { rows } = await (await db()).query<{
          id: number;
          deliverypolicy: unknown;
          refundpolicy: unknown;
          custompolicies: unknown;
        }>(
          `SELECT id, deliverypolicy, refundpolicy, custompolicies FROM shop_policies WHERE shopid = $1 LIMIT 1`,
          [params.shopId]
        );

        let deliverypolicy: Record<string, unknown> = { ...defaultDelivery };
        let refundpolicy: Record<string, unknown> = { ...defaultRefund };
        let custompolicies: unknown[] = [];

        if (!rows?.length) {
          if (params.target === "delivery") {
            deliverypolicy = { ...defaultDelivery, clauses: [clause] };
          } else if (params.target === "refund") {
            refundpolicy = { ...defaultRefund, clauses: [clause] };
          } else {
            custompolicies = [clause];
          }
          await (await db()).query(
            `INSERT INTO shop_policies (shopid, deliverypolicy, refundpolicy, custompolicies, createdat, updatedat)
             VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
              params.shopId,
              JSON.stringify(deliverypolicy),
              JSON.stringify(refundpolicy),
              JSON.stringify(custompolicies),
            ]
          );
          return { inserted: true };
        }

        const row = rows[0]!;
        deliverypolicy = { ...defaultDelivery, ...(parseJson(row.deliverypolicy) ?? {}) };
        refundpolicy = { ...defaultRefund, ...(parseJson(row.refundpolicy) ?? {}) };
        const existingCustom = row.custompolicies;
        if (Array.isArray(existingCustom)) {
          custompolicies = [...existingCustom] as unknown[];
        } else if (typeof existingCustom === "string") {
          try {
            const p = JSON.parse(existingCustom);
            custompolicies = Array.isArray(p) ? [...p] : [];
          } catch {
            custompolicies = [];
          }
        } else {
          custompolicies = [];
        }

        if (params.target === "custom") {
          custompolicies = [...custompolicies, clause];
        } else if (params.target === "delivery") {
          const clauses = Array.isArray(deliverypolicy.clauses)
            ? [...(deliverypolicy.clauses as unknown[])]
            : [];
          deliverypolicy.clauses = [...clauses, clause];
        } else {
          const clauses = Array.isArray(refundpolicy.clauses)
            ? [...(refundpolicy.clauses as unknown[])]
            : [];
          refundpolicy.clauses = [...clauses, clause];
        }

        const upd = await (await db()).query(
          `UPDATE shop_policies
           SET deliverypolicy = $1::jsonb,
               refundpolicy = $2::jsonb,
               custompolicies = $3::jsonb,
               updatedat = CURRENT_TIMESTAMP
           WHERE shopid = $4`,
          [
            JSON.stringify(deliverypolicy),
            JSON.stringify(refundpolicy),
            JSON.stringify(custompolicies),
            params.shopId,
          ]
        );
        if ((upd.rowCount ?? 0) === 0) {
          throw new Error(
            "No shop_policies row for this shop; policy was not saved."
          );
        }
        return { updated: true };
      }
    );

    static getShopReviewsById = withErrorHandling(async (shopId: number) => {

        const {
            rows
        } =  await (await db()).query(
            `
                SELECT * FROM shop_reviews WHERE shop_id = $1
            `, [shopId]
        );

        return rows;
    })

    /** Public product page: visible reviews for the shop that sells the product (not hidden). */
    static getStorefrontReviewsByShopId = withErrorHandling(
        async (
            shopId: number
        ): Promise<
            {
                id: number;
                rating: number;
                title: string | null;
                comment: string | null;
                is_verified_purchase: boolean | null;
                created_at: string;
                reviewer_name: string | null;
            }[]
        > => {
            const { rows } = await (await db()).query(
                `SELECT r.id, r.rating, r.title, r.comment, r.is_verified_purchase, r.created_at,
                        TRIM(CONCAT_WS(' ', u.fname, u.lname)) AS reviewer_name
                 FROM shop_reviews r
                 INNER JOIN users u ON u.id = r.reviewer_id
                 WHERE r.shop_id = $1 AND r.is_hidden IS NOT TRUE
                 ORDER BY r.created_at DESC
                 LIMIT 40`,
                [shopId]
            );
            return rows;
        }
    );

    static getShopMetricsById = withErrorHandling(async (shopId: number) => {

        const {
            rows
        } =  await (await db()).query(
            `
                SELECT * FROM shop_review_metrics WHERE shop_id = $1
            `, [shopId]
        );

        return rows;
    })

    static createPayoutAccount = withErrorHandling(async (payload: NewPayoutAccount) => {
        const {
            shopId,
            bank_name,
            bank_code,
            account_name,
            account_number,
            provider_recipient_id,
            provider_account_id,
            verification_method,
            status
        } = payload;
        const {
            rowCount
        } = await (await db()).query(
            `
                INSERT INTO shop_payout_accounts(shop_id, provider, country_code, currency, bank_name, bank_code, account_name, account_number, provider_recipient_id, provider_account_id, status, verification_method, created_at, updated_at)

                VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
            `,
            [
                shopId,
                'paystack',
                'NG',
                'NGN',
                bank_name,
                bank_code,
                account_name,
                account_number,
                provider_recipient_id,
                provider_account_id,
                status,
                verification_method
            ]
        );

        return rowCount;
    })

    static updatePayoutAccount = withErrorHandling(async (payload: NewPayoutAccount) => {
        
        const {
            shopId,
            bank_name,
            bank_code,
            account_name,
            account_number,
            provider_recipient_id,
            provider_account_id,
            verification_method,
            status
        } = payload;
    
        const { rows } = await (await db()).query(
            `
            UPDATE shop_payout_accounts
            SET
                bank_name = $1,
                bank_code = $2,
                account_name = $3,
                account_number = $4,
                provider_recipient_id = $5,
                provider_account_id = $6,
                status = $7,
                verification_method = $8,
                updated_at = NOW()
            WHERE shop_id = $9
            RETURNING *
            `,
            [
                bank_name,
                bank_code,
                account_name,
                account_number,
                provider_recipient_id,
                provider_account_id,
                status,
                verification_method,
                shopId
            ]
        );
    
        return rows;
    });

    static getPayoutAccountByShopId = withErrorHandling(async (shopId: string | number) => {
        const { rows } = await (await db()).query(
            `
            SELECT
                id,
                shop_id,
                provider,
                country_code,
                currency,
                bank_name,
                bank_code,
                account_name,
                account_number,
                provider_recipient_id,
                provider_account_id,
                status,
                verification_method,
                created_at,
                updated_at
            FROM shop_payout_accounts
            WHERE shop_id = $1
            ORDER BY is_primary DESC, id DESC
            LIMIT 1
            `,
            [String(shopId)]
        );

        return rows?.[0] ?? null;
    });

    static deletePayoutAccountByShopId = withErrorHandling(async (shopId: string | number) => {
        const { rowCount } = await (await db()).query(
            `DELETE FROM shop_payout_accounts WHERE shop_id = $1`,
            [String(shopId)]
        );
        return rowCount ?? 0;
    });

    static getTransactionOverviewByShopId = withErrorHandling(async (shopId: string | number) => {
        const { rows } = await (await db()).query(
            `
            SELECT
              sa.available_balance AS available_balance,
              sa.pending_balance AS pending_escrow,
              sa.currency AS currency,
              COALESCE((
                SELECT SUM(l.amount)
                FROM shop_account_ledger l
                INNER JOIN shop_accounts sa2 ON sa2.id = l.shop_account_id
                WHERE sa2.shop_id = $1
                  AND l.direction = 'credit'
                  AND l.source_type IN ('order_payment', 'escrow_release')
              ), 0) AS total_earnings,
              COALESCE((
                SELECT SUM(l.amount)
                FROM shop_account_ledger l
                INNER JOIN shop_accounts sa2 ON sa2.id = l.shop_account_id
                WHERE sa2.shop_id = $1
                  AND l.direction = 'debit'
                  AND l.source_type = 'payout'
              ), 0) AS total_withdrawal
            FROM shop_accounts sa
            WHERE sa.shop_id = $1
            LIMIT 1
            `,
            [String(shopId)]
        );
        return rows?.[0] ?? null;
    });

    static getTransactionsByShopId = withErrorHandling(async (shopId: string | number, limit = 100) => {
        const { rows } = await (await db()).query(
            `
            SELECT
              l.created_at,
              l.source_type,
              l.source_id,
              l.amount,
              l.direction
            FROM shop_account_ledger l
            INNER JOIN shop_accounts sa ON sa.id = l.shop_account_id
            WHERE sa.shop_id = $1
            ORDER BY l.created_at DESC
            LIMIT $2
            `,
            [String(shopId), Number(limit)]
        );
        return rows;
    });

    /**
     * Paystack webhook rows visible to a shop: metadata.shop_id / shop_ids (from checkout),
     * or chat room for this shop's owner with order_id = Paystack charge id.
     * Excludes rows already mirrored in shop_account_ledger (same paystack_charge_id as source_id).
     */
    static getPaystackTransactionsForShopId = withErrorHandling(async (shopId: string | number, limit = 100) => {
        const { rows } = await (await db()).query(
            `
            SELECT
              pt.id,
              pt.created_at,
              pt.paid_at,
              pt.event,
              pt.reference,
              pt.amount,
              pt.currency,
              pt.status,
              pt.paystack_charge_id
            FROM paystack_transactions pt
            WHERE
              (pt.metadata->>'shop_id') = $1
              OR (
                pt.metadata->>'shop_ids' IS NOT NULL
                AND EXISTS (
                  SELECT 1
                  FROM unnest(string_to_array(pt.metadata->>'shop_ids', ',')) AS s
                  WHERE trim(s) = $1
                )
              )
              OR (
                pt.paystack_charge_id IS NOT NULL
                AND EXISTS (
                  SELECT 1
                  FROM chat_rooms cr
                  INNER JOIN chat_room_participants p
                    ON p.room_id = cr.id AND p.role = 'seller'
                  INNER JOIN shops s ON s.id = $1::bigint
                    AND s.ownerid IS NOT NULL
                    AND p.user_id = s.ownerid
                  WHERE cr.order_id = pt.paystack_charge_id
                )
              )
              AND NOT EXISTS (
                SELECT 1
                FROM shop_account_ledger l
                INNER JOIN shop_accounts sa ON sa.id = l.shop_account_id
                WHERE sa.shop_id = $1::bigint
                  AND l.source_id IS NOT NULL
                  AND l.source_id = pt.paystack_charge_id
              )
            ORDER BY COALESCE(pt.paid_at, pt.created_at) DESC NULLS LAST, pt.id DESC
            LIMIT $2
            `,
            [String(shopId), Number(limit)]
        );
        return rows;
    });

    /**
     * Active shops matching any of the given category strings (public vendor discovery / optional map).
     * Location JSON is parsed in the service layer.
     */
    static listShopsForMapByCategory = withErrorHandling(async (categoryVariants: string[], excludeOwnerId?: number) => {
        const variants = categoryVariants.length ? categoryVariants : null;
        const { rows } = await (await db()).query(
            `
            SELECT
              s.id,
              s.name,
              s.slug,
              s.location,
              m.average_rating,
              m.review_count,
              COALESCE((
                SELECT json_agg(json_build_object('thumbnail_url', thumb.thumbnail_url))
                FROM (
                  SELECT p.thumbnail_url
                  FROM products p
                  WHERE p.shop_id = s.id
                    AND p.is_published = true
                    AND p.thumbnail_url IS NOT NULL
                    AND btrim(p.thumbnail_url) <> ''
                  ORDER BY p.created_at DESC NULLS LAST
                  LIMIT 4
                ) thumb
              ), '[]'::json) AS products
            FROM shops s
            LEFT JOIN shop_review_metrics m ON m.shop_id = s.id
            WHERE (
                $1::text[] IS NULL
                OR EXISTS (
                    SELECT 1
                    FROM UNNEST($1::text[]) AS u(v)
                    WHERE regexp_replace(lower(trim(s.category)), '[^a-z0-9]+', '_', 'g') =
                          regexp_replace(lower(trim(v)), '[^a-z0-9]+', '_', 'g')
                       OR regexp_replace(lower(trim(s.category)), '[^a-z0-9]+', '_', 'g') LIKE
                          ('%' || regexp_replace(lower(trim(v)), '[^a-z0-9]+', '_', 'g') || '%')
                )
            )
              AND ($2::integer IS NULL OR s.ownerid <> $2)
                AND EXISTS (
                  SELECT 1
                  FROM products p
                  WHERE p.shop_id = s.id
                )
              AND s.isactive = true
              AND s.status IN ('active', 'pending_approval')
            ORDER BY s.name ASC
            `,
            [variants, excludeOwnerId ?? null]
        );
        return rows;
    });

}

