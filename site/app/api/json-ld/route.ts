import { NextResponse } from "next/server";
import { query } from "@/app/api/lib/database";

export const dynamic = "force-dynamic";

function productImageUrl(thumbnail: unknown): string {
  const value = String(thumbnail ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://cdn.deedyte.com/images/${value.replace(/^\//, "")}`;
}

function productPrice(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "0.00";
  return amount.toFixed(2);
}

export async function GET() {
  try {
    const result = await query(`
      SELECT
        p.id,
        p.name,
        p.thumbnail_url,
        s.slug AS shop_slug,
        MIN(i.price) AS price
      FROM products p
      INNER JOIN inventory i ON i.product_id = p.id
      INNER JOIN shops s ON s.id = p.shop_id
      WHERE p.is_published = true
      GROUP BY p.id, s.slug
      ORDER BY MAX(p.created_at) DESC
      LIMIT 10
    `);

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "No active products found" },
        { status: 404 },
      );
    }

    const productData = result.rows.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Products",
        name: item.name,
        image: productImageUrl(item.thumbnail_url),
        url: `https://www.deedyte.com/store/${encodeURIComponent(String(item.shop_slug))}/product/${item.id}`,
        offers: {
          "@type": "Offer",
          price: productPrice(item.price),
          priceCurrency: "NGN",
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
        },
      },
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Trending Products",
          description: "Discover trending Products on DeeDyte",
          numberOfItems: result.rows.length,
          url: "https://www.deedyte.com/vendors",
          itemListElement: productData,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=3600",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching products:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
