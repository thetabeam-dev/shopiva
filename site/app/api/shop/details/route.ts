import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../../lib/jwt";
import {
  readUpstreamJson,
  upstreamData,
  upstreamJsonError,
} from "../../lib/upstreamJson";

/** Cookie + JWT — never static at build time */
export const dynamic = "force-dynamic";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("entrepreneur_secret")?.value;
    if (!token) {
      return NextResponse.json(
        { error: "You must be signed in to view shop details." },
        { status: 401 }
      );
    }
    if (!BACKEND_URL) {
      return NextResponse.json(
        { error: "Backend URL is not configured." },
        { status: 500 }
      );
    }
    const secret = getJwtSecret();
    if (!secret) {
      return NextResponse.json(
        { error: "Server auth misconfiguration." },
        { status: 500 }
      );
    }
    const decoded = jwt.verify(token, secret) as { id: number; email?: string };
    const ownerId = decoded?.id;
    if (ownerId == null) {
      return NextResponse.json(
        { error: "Invalid token." },
        { status: 401 }
      );
    }

    const shopsRes = await fetch(`${BACKEND_URL}/shop/owner/${ownerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const shopsParsed = await readUpstreamJson(shopsRes);
    const shopsParseErr = upstreamJsonError(shopsParsed);
    if (shopsParseErr) {
      return NextResponse.json({ error: shopsParseErr }, { status: 502 });
    }
    const shopsBody = upstreamData(shopsParsed);
    if (!shopsRes.ok) {
      return NextResponse.json(
        {
          error:
            (shopsBody.error as string | undefined) ||
            (shopsBody.message as string | undefined) ||
            "Failed to fetch shops",
        },
        { status: shopsRes.status === 401 ? 401 : 502 }
      );
    }
    const shopsRaw = shopsBody.shops ?? shopsBody.data ?? shopsBody.result ?? shopsBody;
    const shops = Array.isArray(shopsRaw) ? shopsRaw : [];
    if (shops.length === 0) {
      return NextResponse.json({ shop: null });
    }

    const first = shops[0] as Record<string, unknown>;
    const shopId = first?.id ?? first?.shop_id ?? first?.shopId;
    if (shopId == null) {
      return NextResponse.json({ shop: null });
    }
    const shopRes = await fetch(`${BACKEND_URL}/shop/${shopId}/${ownerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const shopParsed = await readUpstreamJson(shopRes);
    const shopParseErr = upstreamJsonError(shopParsed);
    if (shopParseErr) {
      return NextResponse.json({ error: shopParseErr }, { status: 502 });
    }
    const shopBody = upstreamData(shopParsed);
    if (!shopRes.ok) {
      return NextResponse.json(
        {
          error:
            (shopBody.error as string | undefined) ||
            (shopBody.message as string | undefined) ||
            "Failed to fetch shop",
        },
        { status: shopRes.status === 401 ? 401 : 502 }
      );
    }
    const shop = shopBody.shop;
    return NextResponse.json({ shop: shop ?? null });
  } catch (err) {
    if (err instanceof Error && err.name === "JsonWebTokenError") {
      return NextResponse.json(
        { error: "Invalid or expired session." },
        { status: 401 }
      );
    }
    console.error("Shop details API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load shop details." },
      { status: 500 }
    );
  }
}
