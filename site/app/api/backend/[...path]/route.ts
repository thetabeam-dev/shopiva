import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

type Ctx = { params: { path: string[] } };

async function proxy(request: NextRequest, { params }: Ctx) {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: "Backend URL is not configured." },
      { status: 500 }
    );
  }

  const path = Array.isArray(params?.path) ? params.path.join("/") : "";
  if (!path) {
    return NextResponse.json({ error: "Backend path is required." }, { status: 400 });
  }

  const url = `${BACKEND_URL}/${path}${request.nextUrl.search || ""}`;
  const token =
    request.cookies.get("user_secret")?.value;

  const headers = new Headers();
  const incomingAuth = request.headers.get("authorization");
  if (incomingAuth) {
    headers.set("authorization", incomingAuth);
  } else if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);

  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await request.text() : undefined;

  const upstream = await fetch(url, {
    method,
    headers,
    body,
  });

  const bytes = await upstream.arrayBuffer();
  const out = new NextResponse(bytes, { status: upstream.status });
  const upstreamContentType = upstream.headers.get("content-type");
  if (upstreamContentType) out.headers.set("content-type", upstreamContentType);
  return out;
}

export async function GET(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
