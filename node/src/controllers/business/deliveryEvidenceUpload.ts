import type { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import type { AuthRequest } from "../../middleware/auth.js";
import Cloudinary from "../../utils/cloudinary.js";

const MAX_BYTES = 15 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
});

const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export const deliveryEvidenceUploadMiddleware = upload.single("file");

type ReqWithFile = AuthRequest & { file?: Express.Multer.File };

/**
 * POST /shop/delivery-evidence-upload
 * Multipart field `file` — uploads delivery proof image to Cloudinary.
 */
export async function UploadDeliveryEvidenceController(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = (req as AuthRequest).user;
    if (!user?.id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      res.status(503).json({
        error:
          "Uploads require CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
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

    const folder = `orders/delivery/user-${user.id}`;
    const uploadResult = await Cloudinary.uploadAsset({
      file,
      productId: folder,
    });

    res.status(200).json({
      image: uploadResult.data,
      url: uploadResult.data.url,
    });
  } catch (err) {
    console.error("Upload delivery evidence error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Upload failed.",
    });
  }
}
