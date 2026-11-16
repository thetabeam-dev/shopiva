import { NextResponse } from "next/server";
import {
  assertMerchantAdmin,
  merchantErrorResponse,
} from "@/lib/integrations/google-merchant/admin-auth";
import { getGoogleProductDiagnostics } from "@/lib/integrations/google-merchant/diagnostics";
import {
  deleteGoogleProduct,
  getGoogleProductStatus,
  syncGoogleProduct,
} from "@/lib/integrations/google-merchant/product-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request, { params }) {
  const auth = assertMerchantAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const productId = params?.productId;
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get("refresh") === "1";
    const diagnosticsOnly = searchParams.get("diagnostics") === "1";

    const status = await getGoogleProductStatus(productId, { refresh });

    if (diagnosticsOnly && status.sync?.offer_id) {
      const diagnostics = await getGoogleProductDiagnostics(status.sync.offer_id);
      return NextResponse.json({ ok: true, productId: Number(productId), diagnostics });
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error("[google-merchant] product status failed", error);
    return merchantErrorResponse(error);
  }
}

export async function POST(request, { params }) {
  const auth = assertMerchantAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const productId = params?.productId;
    const result = await syncGoogleProduct(productId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[google-merchant] product sync failed", error);
    return merchantErrorResponse(error);
  }
}

export async function DELETE(request, { params }) {
  const auth = assertMerchantAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const productId = params?.productId;
    const result = await deleteGoogleProduct(productId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[google-merchant] product delete failed", error);
    return merchantErrorResponse(error);
  }
}
