import { NextResponse } from "next/server";
import {
  listFeedProductRows,
  mapRowToFeedFields,
} from "@/lib/googleMerchant";
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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "";

    const rows = await listFeedProductRows({ category, limit: 5000 });
    const items = rows
      .map((row) => {
        const fields = mapRowToFeedFields(row);
        if (!fields) return "";
        const productType = fields.productType;
        return `    <item>
      <g:id>${escapeXml(fields.id)}</g:id>
      <title>${escapeXml(fields.title)}</title>
      <description>${escapeXml(fields.description)}</description>
      <link>${escapeXml(fields.link)}</link>
      <g:image_link>${escapeXml(fields.image)}</g:image_link>
      <g:price>${fields.price} NGN</g:price>
      <g:availability>in stock</g:availability>
      <g:condition>new</g:condition>
      <g:brand>${escapeXml(fields.brand)}</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
${productType ? `      <g:product_type>${escapeXml(productType)}</g:product_type>\n` : ""}    </item>`;
      })
      .filter(Boolean);

    const channelTitle = category
      ? `DeeDyte Products — ${category}`
      : "DeeDyte Products";

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
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
