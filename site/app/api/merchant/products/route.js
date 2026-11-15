import { NextResponse } from "next/server";
import { listMerchantProducts } from "@/lib/googleMerchant";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "";
    const limit = searchParams.get("limit");
    const products = await listMerchantProducts({ category, limit });
    return NextResponse.json({
      ok: true,
      category: category.trim().toLowerCase() || null,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Merchant products list failed:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to list merchant products." },
      { status: 500 }
    );
  }
}
