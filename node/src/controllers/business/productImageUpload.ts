import type { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import type { AuthRequest } from "../../middleware/auth.js";
import { GetShopService } from "../../services/business/shop.js";
import Cloudinary from "../../utils/cloudinary.js";

const MAX_BYTES = 15 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } });
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/mov",
  "video/x-matroska",
  "video/x-msvideo",
]);

export const productImageUploadMiddleware = upload.single("file");

type ReqWithFile = AuthRequest & { file?: Express.Multer.File };

export async function UploadProductImageController(req: Request, res: Response): Promise<void> {
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

    const productId = String(req.body?.productId ?? req.body?.product_id ?? '').trim();
    if (!productId) {
      res.status(400).json({ error: "Product ID is required." });
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

    const shop = await GetShopService(shopId);
    const row = shop as Record<string, unknown>;
    const ownerId = Number(row.ownerid ?? row.ownerId);
    if (!Number.isFinite(ownerId) || ownerId !== Number(user.id)) {
      res.status(403).json({ error: "You do not own this shop." });
      return;
    }

    const file = (req as ReqWithFile).file;
    if (!file?.buffer?.length) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }

    const mime = file.mimetype || "application/octet-stream";
    if (!ALLOWED_MIMES.has(mime)) {
      res.status(400).json({ error: `Unsupported file type: ${mime}` });
      return;
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

    const uploadResult = await Cloudinary.uploadAsset({
      file,
      productId,
    });

    res.status(200).json({ image: uploadResult.data });
  } catch (err) {
    console.error("Upload product image error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed." });
  }
}

export async function DeleteProductImageController(req: Request, res: Response): Promise<void> {
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

    const url = String(req.body?.url ?? "").trim();
    if (!url.startsWith("https://res.cloudinary.com/")) {
      res.status(400).json({ error: "A Cloudinary image URL is required." });
      return;
    }

    const shop = await GetShopService(shopId);
    const row = shop as Record<string, unknown>;
    const ownerId = Number(row.ownerid ?? row.ownerId);
    if (!Number.isFinite(ownerId) || ownerId !== Number(user.id)) {
      res.status(403).json({ error: "You do not own this shop." });
      return;
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      res.status(503).json({ error: "Cloudinary is not configured." });
      return;
    }
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

    const type = String(req.body?.type ?? "").toLowerCase().includes("video") || url.includes("/video/upload/")
      ? "video"
      : "image";
    try {
      await Cloudinary.deleteAsset({ url, type });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("not found")) {
        throw error;
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Delete product image error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Delete failed." });
  }
}
