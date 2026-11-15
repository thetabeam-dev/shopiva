import { NextResponse } from "next/server";
import { listMerchantCategories } from "@/lib/googleMerchant";
import { SITE_ORIGIN } from "@/lib/siteNavigation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await listMerchantCategories();
    return NextResponse.json({
      ok: true,
      feedUrl: `${SITE_ORIGIN}/feeds/google-products.xml`,
      uploadUrl: `${SITE_ORIGIN}/api/merchant/products/upload`,
      categories,
    });
  } catch (error) {
    console.error("Merchant categories failed:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to list merchant categories." },
      { status: 500 }
    );
  }
}
