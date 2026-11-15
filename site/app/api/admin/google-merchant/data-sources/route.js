import { NextResponse } from "next/server";
import {
  assertMerchantAdmin,
  merchantErrorResponse,
} from "@/lib/integrations/google-merchant/admin-auth";
import {
  ensurePrimaryDataSource,
  listDataSources,
} from "@/lib/integrations/google-merchant/data-source";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const auth = assertMerchantAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const dataSources = await listDataSources();
    return NextResponse.json({
      ok: true,
      count: dataSources.length,
      dataSources: dataSources.map((ds) => ({
        name: ds.name || null,
        dataSourceId: ds.dataSourceId || null,
        displayName: ds.displayName || null,
        input: ds.input || null,
        primaryProductDataSource: ds.primaryProductDataSource || null,
      })),
    });
  } catch (error) {
    console.error("[google-merchant] list data sources failed", error);
    return merchantErrorResponse(error);
  }
}

export async function POST(request) {
  const auth = assertMerchantAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await ensurePrimaryDataSource();
    return NextResponse.json({
      ok: true,
      ...result,
      hint:
        result.created || result.source === "existing"
          ? `Set GOOGLE_MERCHANT_DATA_SOURCE_ID=${result.dataSourceId} in your server env for stable reuse.`
          : undefined,
    });
  } catch (error) {
    console.error("[google-merchant] ensure data source failed", error);
    return merchantErrorResponse(error);
  }
}
