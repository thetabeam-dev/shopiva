import { NextResponse } from "next/server";
import { uploadProductsByCategory } from "@/lib/googleMerchant";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
}

function assertUploadSecret(request) {
  const expected = String(process.env.GOOGLE_MERCHANT_UPLOAD_SECRET ?? "").trim();
  if (!expected) return true;
  const header = request.headers.get("x-merchant-upload-secret") || "";
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return header === expected || bearer === expected;
}

export async function POST(request) {
  try {
    if (!assertUploadSecret(request)) return unauthorized();

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const category = body?.category ?? "";
    const limit = body?.limit;

    const result = await uploadProductsByCategory({ category, limit });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Merchant upload failed:", error);
    if (error?.code === "MERCHANT_CONFIG") {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 503 }
      );
    }
    const message =
      error?.response?.data?.error?.message ||
      error?.message ||
      "Unable to upload products to Google Merchant.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
