import { NextResponse } from "next/server";
import { getStorefrontShopBySlug } from "@/lib/storefrontProducts";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const resolved = params && typeof params.then === "function" ? await params : params;
  const slug = typeof resolved?.slug === "string" ? resolved.slug : "";
  try {
    const shop = await getStorefrontShopBySlug(slug);
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    return NextResponse.json({ shop });
  } catch (error) {
    console.error("Storefront shop lookup failed:", error);
    return NextResponse.json({ error: "Shop not found" }, { status: 500 });
  }
}
