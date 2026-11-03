import { NextResponse } from "next/server";
import { query } from "@/app/api/lib/database";
import { SITE_ORIGIN } from "@/lib/siteNavigation";

export const dynamic = "force-dynamic";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function productImageUrl(thumbnail) {
  const value = String(thumbnail ?? "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://cdn.deedyte.com/images/${value.replace(/^\//, "")}`;
}

function productPrice(value) {
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
        p.description,
        p.thumbnail_url,
        p.category,
        s.name AS shop_name,
        s.slug AS shop_slug,
        MIN(i.price) AS price
      FROM products p
      INNER JOIN inventory i ON i.product_id = p.id
      INNER JOIN shops s ON s.id = p.shop_id
      WHERE p.is_published = true
        AND s.isactive = true
        AND s.slug IS NOT NULL
        AND btrim(s.slug) <> ''
      GROUP BY p.id, s.name, s.slug
      ORDER BY MAX(p.updated_at) DESC NULLS LAST
      LIMIT 5000
    `);

    const items = result.rows
      .map((row) => {
        const image = productImageUrl(row.thumbnail_url);
        if (!image) return "";
        const link = `${SITE_ORIGIN}/store/${encodeURIComponent(row.shop_slug)}/${row.id}`;
        const title = String(row.name ?? "Product").slice(0, 150);
        const description = String(row.description ?? title)
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 5000) || title;
        const brand = String(row.shop_name ?? "DeeDyte").slice(0, 70);
        const productType = String(row.category ?? "").trim();
        return `    <item>
      <g:id>${escapeXml(row.id)}</g:id>
      <title>${escapeXml(title)}</title>
      <description>${escapeXml(description)}</description>
      <link>${escapeXml(link)}</link>
      <g:image_link>${escapeXml(image)}</g:image_link>
      <g:price>${productPrice(row.price)} NGN</g:price>
      <g:availability>in stock</g:availability>
      <g:condition>new</g:condition>
      <g:brand>${escapeXml(brand)}</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
${productType ? `      <g:product_type>${escapeXml(productType)}</g:product_type>\n` : ""}    </item>`;
      })
      .filter(Boolean);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>DeeDyte Products</title>
    <link>${SITE_ORIGIN}/</link>
    <description>DeeDyte marketplace product feed for Google Merchant Center</description>
${items.join("\n")}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("Google product feed failed:", error);
    return new NextResponse("Unable to build product feed.", { status: 500 });
  }
}
