import { NextResponse } from "next/server";
import {
  assertMerchantAdmin,
  merchantErrorResponse,
} from "@/lib/integrations/google-merchant/admin-auth";
import {
  enqueueGoogleProductSync,
  syncAllEligibleProducts,
  syncGoogleProduct,
} from "@/lib/integrations/google-merchant/product-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST body:
 * { mode: "one"|"all"|"enqueue", productId?: number, action?: "sync"|"delete", limit?: number, async?: boolean }
 */
export async function POST(request) {
  const auth = assertMerchantAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const mode = String(body.mode || "one").toLowerCase();
    const productId = body.productId ?? body.product_id;
    const action = String(body.action || "sync").toLowerCase();
    const asyncMode = Boolean(body.async);

    if (mode === "all") {
      const summary = await syncAllEligibleProducts({ limit: body.limit });
      return NextResponse.json({ ok: true, mode: "all", ...summary });
    }

    if (mode === "enqueue" || asyncMode) {
      if (productId == null) {
        return NextResponse.json(
          { ok: false, error: "productId is required" },
          { status: 400 }
        );
      }
      const enqueueOpts = {
        shopId: body.shopId ?? body.shop_id,
        offerId: body.offerId ?? body.offer_id,
      };
      enqueueGoogleProductSync(
        productId,
        action === "delete" ? "delete" : "sync",
        enqueueOpts
      );
      return NextResponse.json({
        ok: true,
        mode: "enqueue",
        productId: Number(productId),
        action,
        queued: true,
      });
    }

    if (productId == null) {
      return NextResponse.json(
        { ok: false, error: "productId is required for mode=one" },
        { status: 400 }
      );
    }

    if (action === "delete") {
      const { deleteGoogleProduct } = await import(
        "@/lib/integrations/google-merchant/product-sync"
      );
      const result = await deleteGoogleProduct(productId, {
        shopId: body.shopId ?? body.shop_id,
        offerId: body.offerId ?? body.offer_id,
      });
      return NextResponse.json({ ok: true, mode: "one", action: "delete", ...result });
    }

    const result = await syncGoogleProduct(productId);
    return NextResponse.json({ ok: true, mode: "one", action: "sync", ...result });
  } catch (error) {
    console.error("[google-merchant] sync failed", error);
    return merchantErrorResponse(error);
  }
}
