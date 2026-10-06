import { NextResponse } from "next/server";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";
  const slug = searchParams.get("slug") || "";
  const productId = parseInt(id, 10);

  if (!BACKEND_URL || !Number.isFinite(productId)) {
    return NextResponse.json(
      { success: false, error: "Product id is required." },
      { status: 400 }
    );
  }

  try {
    const [prodRes, shopRes] = await Promise.all([
      fetch(`${BACKEND_URL}/storefront/product/${productId}`, { cache: "no-store" }),
      slug
        ? fetch(`${BACKEND_URL}/storefront/shop/${encodeURIComponent(slug)}`, { cache: "no-store" })
        : Promise.resolve(null),
    ]);

    if (!prodRes.ok) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: prodRes.status }
      );
    }

    const prod = await prodRes.json().catch(() => ({}));
    const shop = shopRes && shopRes.ok ? await shopRes.json().catch(() => ({})) : {};
    if (!prod?.product) {
      return NextResponse.json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...prod.product,
          productReviews: Array.isArray(prod.productReviews) ? prod.productReviews : [],
          reviewMetrics: prod.reviewMetrics ?? null,
          shopName: shop?.shop?.name ? String(shop.shop.name) : "",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("product details:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
