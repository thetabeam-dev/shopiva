import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import { confirmCartCheckoutAndCreateChatRoom } from "../../services/buyer/checkoutConfirm.js";

/**
 * POST /buyer/checkout/confirm-payment
 * Body: { reference: string, shipping_naira?: number }
 * Verifies Paystack, creates chat room buyer↔vendor, clears cart.
 */
export async function PostBuyerCheckoutConfirmPaymentController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    console.log(req.body);
    const body = (req.body ?? {}) as { reference?: unknown; shipping_naira?: unknown };
    const reference = String(body.reference ?? "").trim();
    const shippingNaira = body.shipping_naira != null ? Number(body.shipping_naira) : 0;

    if (!reference) {
      res.status(400).json({ error: "reference is required" });
      return;
    }
    const result = await confirmCartCheckoutAndCreateChatRoom(userId, reference, shippingNaira);
    const first = result.rooms[0];
    res.status(200).json({
      ok: true,
      multi_shop: result.rooms.length > 1,
      rooms: result.rooms,
      transaction_id: result.transaction_id,
      room: first?.room,
      existing: first?.existing,
      vendor_user_id: first?.vendor_user_id,
    });
  } catch (err) {
    console.log(err);
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
