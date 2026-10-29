import { NextResponse } from "next/server";
import { listCategoriesWithProducts } from "@/lib/storefrontCategories";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await listCategoriesWithProducts();
    return NextResponse.json(
      { categories },
      { headers: { "Cache-Control": "public, s-maxage=300" } },
    );
  } catch (error) {
    console.error("Storefront categories lookup failed:", error);
    return NextResponse.json({ categories: [] }, { status: 200 });
  }
}
