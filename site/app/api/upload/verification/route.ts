import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import { getJwtSecret } from "../../lib/jwt";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("entrepreneur_secret")?.value;
    if (!token) {
      return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    }
    const secret = getJwtSecret();
    if (!secret) {
      return NextResponse.json(
        { error: "Server auth misconfiguration." },
        { status: 500 }
      );
    }
    jwt.verify(token, secret);

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        {
          error:
            "Uploads require CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
        },
        { status: 503 }
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }

    const mime = file.type || "application/octet-stream";
    if (!ALLOWED.has(mime)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, WebP, or PDF files are allowed." },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return NextResponse.json(
        { error: "File is too large (max 8MB)." },
        { status: 400 }
      );
    }

    const b64 = buf.toString("base64");
    const dataUri = `data:${mime};base64,${b64}`;

    const uploaded = await cloudinary.uploader.upload(dataUri, {
      folder: "deedyte/verification",
      resource_type: "auto",
    });

    return NextResponse.json({
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "JsonWebTokenError") {
      return NextResponse.json({ error: "Invalid or expired session." }, { status: 401 });
    }
    console.error("Verification upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 500 }
    );
  }
}
