import { NextResponse } from 'next/server';

export async function GET() {
  const imageUrl = 'https://res.cloudinary.com/jh7nqlrd/image/upload/v1791187434/WhatsApp_Image_2026-09-22_at_22.45.49.jpg';
  const res = await fetch(imageUrl);
  const buffer = await res.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': buffer.byteLength.toString(),
      'Cache-Control': 'public, max-age=86400',
    },
    status: 200,
  });
}