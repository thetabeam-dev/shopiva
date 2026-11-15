import "server-only";
import { NextResponse } from "next/server";

/**
 * Protect Merchant admin routes with GOOGLE_MERCHANT_UPLOAD_SECRET
 * (same secret used by legacy /api/merchant/products/upload).
 * If unset, allows in non-production only.
 */
export function assertMerchantAdmin(request) {
  const expected = String(
    process.env.GOOGLE_MERCHANT_UPLOAD_SECRET ||
      process.env.GOOGLE_MERCHANT_ADMIN_SECRET ||
      ""
  ).trim();

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        response: NextResponse.json(
          {
            ok: false,
            error:
              "Set GOOGLE_MERCHANT_UPLOAD_SECRET (or GOOGLE_MERCHANT_ADMIN_SECRET) to protect admin routes.",
          },
          { status: 503 }
        ),
      };
    }
    return { ok: true };
  }

  const header = request.headers.get("x-merchant-upload-secret") || "";
  const adminHeader = request.headers.get("x-merchant-admin-secret") || "";
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const provided = header || adminHeader || bearer;

  if (provided !== expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      ),
    };
  }
  return { ok: true };
}

export function merchantErrorResponse(error) {
  const status =
    error?.status && error.status >= 400 && error.status < 600
      ? error.status
      : error?.code === "MERCHANT_CONFIG" || error?.code === "MERCHANT_DISABLED"
        ? 503
        : 500;
  return NextResponse.json(
    {
      ok: false,
      error: error?.message || "Merchant request failed",
      code: error?.code || undefined,
    },
    { status }
  );
}
