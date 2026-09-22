import type { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import type { AuthRequest } from "../../middleware/auth.js";
import type { ShopDocument } from "../../types/business.js";
import { GetShopService, UpdateShopService } from "../../services/business/shop.js";
import { shopRowToUpdatePayload } from "../../utils/shopRowToUpdatePayload.js";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
});

export const verificationUploadMiddleware = upload.single("file");

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Reject obvious garbage (does not replace NIBSS / Paystack KYC). */
function isPlausibleBvnDigits(d: string): boolean {
  if (d.length !== 11) return false;
  if (!/^\d{11}$/.test(d)) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  return true;
}

/**
 * POST /shop/patch/:shopId/verify-bvn
 * Body: `{ "bvn": "11-digit string" }` — matches Next.js BVN modal.
 */
export async function VerifyShopBvnController(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user;
    if (!user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const shopId = parseInt(String(req.params.shopId ?? ""), 10);
    if (!Number.isFinite(shopId) || shopId <= 0) {
      res.status(400).json({ error: "Invalid shop ID." });
      return;
    }
    const body = req.body as { bvn?: string };
    const digits = digitsOnly(String(body?.bvn ?? ""));
    if (!isPlausibleBvnDigits(digits)) {
      res.status(400).json({ error: "Enter a valid 11-digit BVN." });
      return;
    }

    const shop = await GetShopService(shopId);
    const row = shop as Record<string, unknown>;
    const ownerId = Number(row.ownerid ?? row.ownerId);
    if (!Number.isFinite(ownerId) || ownerId !== Number(user.id)) {
      res.status(403).json({ error: "You do not own this shop." });
      return;
    }

    const payload = shopRowToUpdatePayload(row);
    const prevDocs = { ...(payload.verificationDocuments as unknown as Record<string, unknown>) };
    const now = new Date().toISOString();
    prevDocs.bvn = {
      last4: digits.slice(-4),
      verified: true,
      verifiedAt: now,
      submittedAt: now,
    };

    await UpdateShopService({
      ...payload,
      verificationDocuments: prevDocs as unknown as ShopDocument["verificationDocuments"],
      updatedAt: now,
    });

    res.status(200).json({ ok: true, message: "BVN recorded." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Shop not found") {
      res.status(404).json({ error: msg });
      return;
    }
    res.status(400).json({ error: msg });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Express augments Request with `file` from multer
type ReqWithFile = AuthRequest & { file?: Express.Multer.File };

/**
 * POST /shop/:shopId/verification-upload (multipart field `file`)
 */
export async function UploadShopVerificationDocumentController(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user;
    if (!user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const shopId = parseInt(String(req.params.shopId ?? ""), 10);
    if (!Number.isFinite(shopId) || shopId <= 0) {
      res.status(400).json({ error: "Invalid shop ID." });
      return;
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      res.status(503).json({
        error: "Uploads require CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
      });
      return;
    }

    const file = (req as ReqWithFile).file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: "Missing file." });
      return;
    }
    const mime = file.mimetype || "application/octet-stream";
    if (!ALLOWED_MIMES.has(mime)) {
      res.status(400).json({ error: "Only JPEG, PNG, WebP, or PDF files are allowed." });
      return;
    }

    const shop = await GetShopService(shopId);
    const row = shop as Record<string, unknown>;
    const ownerId = Number(row.ownerid ?? row.ownerId);
    if (!Number.isFinite(ownerId) || ownerId !== Number(user.id)) {
      res.status(403).json({ error: "You do not own this shop." });
      return;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const b64 = file.buffer.toString("base64");
    const dataUri = `data:${mime};base64,${b64}`;
    const uploaded = await cloudinary.uploader.upload(dataUri, {
      folder: "deedyte/verification",
      resource_type: "auto",
    });

    res.status(200).json({
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed." });
  }
}
