import { NextResponse } from "next/server";
import {
  assertMerchantAdmin,
  merchantErrorResponse,
} from "@/lib/integrations/google-merchant/admin-auth";
import { getMerchantAccountInfo } from "@/lib/integrations/google-merchant/account";
import { getMerchantConfig } from "@/lib/integrations/google-merchant/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const auth = assertMerchantAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const cfg = getMerchantConfig();
    const account = await getMerchantAccountInfo();
    return NextResponse.json({
      ok: true,
      enabled: cfg.enabled,
      credentialsConfigured: Boolean(
        cfg.credentialsPath || (cfg.serviceAccountEmail && cfg.privateKey)
      ),
      dataSourceIdConfigured: Boolean(cfg.dataSourceId),
      ...account,
    });
  } catch (error) {
    console.error("[google-merchant] account check failed", error);
    return merchantErrorResponse(error);
  }
}
