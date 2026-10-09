import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import { confirmCartCheckoutAndCreateChatRoom, createUnpaidCheckoutOrders } from "../../services/buyer/checkoutConfirm.js";

type UnpaidClientItem = {
  item_id?: unknown;
  unit?: unknown;
  unit_price?: unknown;
  total?: unknown;
  cart_id?: unknown;
};

/**
 * POST /buyer/checkout/unpaid-order
 * Creates an unpaid order so the vendor can set a shipping quote.
 */
export async function PostBuyerUnpaidOrderController(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const body = (req.body ?? {}) as {
      shipping_address?: unknown;
      use_cart?: unknown;
      orders?: Array<{ shop_id?: unknown; items?: UnpaidClientItem[] }>;
    };
    const orders = Array.isArray(body.orders)
      ? body.orders.map((order) => ({
          shop_id: String(order.shop_id ?? ""),
          items: Array.isArray(order.items)
            ? order.items.map((item) => ({
                item_id: String(item.item_id ?? ""),
                unit: Number(item.unit ?? 0),
                unit_price: Number(item.unit_price ?? 0),
                total: Number(item.total ?? 0),
                cart_id:
                  typeof item.cart_id === "number" && Number.isFinite(item.cart_id)
                    ? item.cart_id
                    : typeof item.cart_id === "string" && item.cart_id.trim()
                      ? item.cart_id.trim()
                      : null,
              }))
            : [],
        }))
      : [];
    const result = await createUnpaidCheckoutOrders(
      userId,
      String(body.shipping_address ?? ""),
      orders,
      body.use_cart !== false,
    );
    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    console.log(err);
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

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
