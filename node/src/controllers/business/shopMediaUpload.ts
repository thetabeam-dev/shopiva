import type { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import type { AuthRequest } from "../../middleware/auth.js";
import Cloudinary from "../../utils/cloudinary.js";

const MAX_BYTES = 8 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
});

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export const shopMediaUploadMiddleware = upload.single("file");

type ReqWithFile = AuthRequest & { file?: Express.Multer.File };

/**
 * POST /shop/:shopId/media/upload
 * Multipart field `file`, plus `kind` (`logo` | `banner`) and optional `previousUrl`.
 * Deletes the previous Cloudinary image before storing the new one.
 */
export async function UploadShopMediaController(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as AuthRequest).user;
    if (!user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const shopId = String(req.params.shopId ?? "").trim();
    if (!shopId) {
      res.status(400).json({ error: "Shop id is required." });
      return;
    }

    const kind = req.body?.kind === "banner" ? "banner" : req.body?.kind === "logo" ? "logo" : "";
    if (!kind) {
      res.status(400).json({ error: "kind must be logo or banner." });
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
      res.status(400).json({ error: "No file uploaded." });
      return;
    }

    const mime = file.mimetype || "application/octet-stream";
    if (!ALLOWED_MIMES.has(mime)) {
      res.status(400).json({ error: `Unsupported file type: ${mime}` });
      return;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const previousUrl = typeof req.body?.previousUrl === "string" ? req.body.previousUrl.trim() : "";
    if (previousUrl.startsWith("https://res.cloudinary.com/")) {
      try {
        await Cloudinary.deleteAsset({ url: previousUrl, type: "image" });
      } catch (deleteErr) {
        const message = deleteErr instanceof Error ? deleteErr.message : String(deleteErr);
        if (!message.toLowerCase().includes("not found")) {
          res.status(500).json({ error: "Could not remove the current image before uploading a new one." });
          return;
        }
      }
    }

    const uploadResult = await Cloudinary.uploadAsset({
      file,
      productId: `shops/${shopId}/${kind}`,
    });

    res.status(200).json({
      image: uploadResult.data,
      url: uploadResult.data.url,
      kind,
    });
  } catch (err) {
    console.error("Upload shop media error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Upload failed.",
    });
  }
}
