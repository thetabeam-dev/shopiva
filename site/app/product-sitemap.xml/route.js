import { NextResponse } from "next/server";
import { query } from "@/app/api/lib/database";
import { SITE_ORIGIN } from "@/lib/siteNavigation";

export const dynamic = "force-dynamic";

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  let urls = [];
  try {
    const products = await query(`
      SELECT s.slug, p.id, p.updated_at
      FROM products p
      INNER JOIN shops s ON s.id = p.shop_id
      WHERE p.is_published = true
        AND s.isactive = true
        AND s.slug IS NOT NULL
        AND btrim(s.slug) <> ''
      ORDER BY p.updated_at DESC NULLS LAST
    `);
    urls = products.rows.map((product) => {
      const loc = `${SITE_ORIGIN}/store/${encodeURIComponent(product.slug)}/${product.id}`;
      const lastmod = product.updated_at
        ? new Date(product.updated_at).toISOString()
        : new Date().toISOString();
      return `  <url><loc>${escapeXml(loc)}</loc><lastmod>${lastmod}</lastmod></url>`;
    });
  } catch (error) {
    console.error("Product sitemap lookup failed:", error);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600",
    },
  });
}
