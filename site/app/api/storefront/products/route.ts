import { NextResponse } from "next/server";
import { listHomeProducts } from "@/lib/storefrontProducts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 40);
    const offset = Number(searchParams.get("offset") ?? 0);
    const { products, hasMore, nextOffset } = await listHomeProducts({ limit, offset });
    return NextResponse.json(
      { products, hasMore, nextOffset },
      { headers: { "Cache-Control": "public, s-maxage=120" } },
    );
  } catch (error) {
    console.error("Storefront products lookup failed:", error);
    return NextResponse.json(
      { products: [], hasMore: false, nextOffset: 0 },
      { status: 200 },
    );
  }
}
