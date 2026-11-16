import { NextResponse } from "next/server";
import { query } from "@/app/api/lib/database";
import {
  assertMerchantAdmin,
  merchantErrorResponse,
} from "@/lib/integrations/google-merchant/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** List local Merchant sync rows. */
export async function GET(request) {
  const auth = assertMerchantAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = String(searchParams.get("status") || "").trim();
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit")) || 50, 1),
      500
    );

    const params = [];
    let where = "";
    if (status) {
      params.push(status);
      where = `WHERE sync_status = $${params.length}`;
    }
    params.push(limit);

    const result = await query(
      `
      SELECT
        id, product_id, shop_id, offer_id,
        google_product_name, google_product_input_name,
        data_source_id, sync_status, google_approval_status,
        last_synced_at, last_error, diagnostics, updated_at
      FROM google_merchant_product_sync
      ${where}
      ORDER BY updated_at DESC NULLS LAST
      LIMIT $${params.length}
      `,
      params
    );

    return NextResponse.json({
      ok: true,
      count: result.rows.length,
      products: result.rows,
    });
  } catch (error) {
    console.error("[google-merchant] list sync products failed", error);
    return merchantErrorResponse(error);
  }
}
