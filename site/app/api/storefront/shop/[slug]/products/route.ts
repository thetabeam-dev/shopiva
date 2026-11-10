import { NextResponse } from "next/server";
import { listStorefrontProductsByShopSlug } from "@/lib/storefrontProducts";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const resolved = params && typeof params.then === "function" ? await params : params;
  const slug = typeof resolved?.slug === "string" ? resolved.slug : "";
  try {
    const { shop, products } = await listStorefrontProductsByShopSlug(slug);
    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }
    return NextResponse.json({ shop, products });
  } catch (error) {
    console.error("Storefront shop products lookup failed:", error);
    return NextResponse.json({ error: "Could not load products." }, { status: 500 });
  }
}
