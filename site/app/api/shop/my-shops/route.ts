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

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(
  /\/$/,
  ""
);

/**
 * Lists shops for the signed-in entrepreneur.
 * Node backend: GET /shop/owner/:id (not /shop/my-shops).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("entrepreneur_secret")?.value;
    if (!token) {
      return NextResponse.json(
        { error: "You must be signed in to view your shops." },
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
    const decoded = jwt.verify(token, secret) as { id?: number };
    const ownerId = decoded?.id;
    if (ownerId == null) {
      return NextResponse.json({ error: "Invalid token." }, { status: 401 });
    }

    const shopsRes = await fetch(`${BACKEND_URL}/shop/owner/${ownerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const parsed = await readUpstreamJson(shopsRes);
    const parseErr = upstreamJsonError(parsed);
    if (parseErr) {
      return NextResponse.json({ error: parseErr }, { status: 502 });
    }
    const data = upstreamData(parsed);
    if (!shopsRes.ok) {
      return NextResponse.json(
        {
          error:
            (data.error as string | undefined) ||
            (data.message as string | undefined) ||
            "Failed to fetch shops",
        },
        { status: shopsRes.status === 401 ? 401 : 502 }
      );
    }
    const shopsRaw = data.shops ?? data.data ?? data.result ?? data;
    const shops = Array.isArray(shopsRaw) ? shopsRaw : [];
    return NextResponse.json({ shops });
  } catch (err) {
    if (err instanceof Error && err.name === "JsonWebTokenError") {
      return NextResponse.json(
        { error: "Invalid or expired session." },
        { status: 401 }
      );
    }
    console.error("My shops API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load shops." },
      { status: 500 }
    );
  }
}
