import { NextResponse } from 'next/server';

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
const BACKEND_PATH = '/admin/email-automation/shops-without-products';

async function proxy(request, method) {
  if (!BACKEND_URL) {
    return NextResponse.json({ success: false, error: 'Backend URL is not configured.' }, { status: 503 });
  }

  try {
    const incomingUrl = new URL(request.url);
    const targetUrl = new URL(`${BACKEND_URL}${BACKEND_PATH}`);
    if (method === 'GET') targetUrl.search = incomingUrl.search;

    const headers = new Headers();
    let body;
    if (method === 'POST') {
      headers.set('content-type', 'application/json');
      body = await request.text();
    }

    const response = await fetch(targetUrl, { method, headers, body, cache: 'no-store' });
    const payload = await response.text();
    return new NextResponse(payload, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
    });
  } catch (error) {
    console.error('Vendor activation backend request failed:', error);
    return NextResponse.json({ success: false, error: 'Unable to contact the admin API.' }, { status: 502 });
  }
}

export async function GET(request) {
  return proxy(request, 'GET');
}

export async function POST(request) {
  return proxy(request, 'POST');
}
