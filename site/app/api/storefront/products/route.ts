import { NextResponse } from "next/server";
import { listHomeProducts } from "@/lib/storefrontProducts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await listHomeProducts();
    return NextResponse.json(
      { products },
      { headers: { "Cache-Control": "public, s-maxage=120" } },
    );
  } catch (error) {
    console.error("Storefront products lookup failed:", error);
    return NextResponse.json({ products: [] }, { status: 200 });
  }
}
