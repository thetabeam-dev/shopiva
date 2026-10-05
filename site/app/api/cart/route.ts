import { NextRequest, NextResponse } from "next/server";
import { query } from "../lib/database";
import { getCustomerUserId } from "../lib/customerAuth";

const MISSING_TABLE = "42P01";

function isPgError(err: unknown): err is { code?: string; message?: string } {
  return typeof err === "object" && err !== null;
}

async function requireCustomer(request: NextRequest) {
  const userId = getCustomerUserId(request);
  if (userId == null) {
    return {
      error: NextResponse.json({ error: "Sign in to use your cart." }, { status: 401 }),
    } as const;
  }
  return { userId } as const;
}

/**
 * GET — list cart lines with product name, images, unit price (from inventory).
 */
export async function GET(request: NextRequest) {
  const auth = await requireCustomer(request);
  if ("error" in auth) return auth.error;

  try {
    const { rows } = await query(
      `SELECT
         ci.id AS cart_line_id,
         ci.quantity,
         i.id AS inventory_id,
         i.product_id,
         i.sku,
         i.price,
         i.currency,
         CASE
           WHEN i.track_inventory IS FALSE THEN GREATEST(0, COALESCE(i.quantity, 0))
           ELSE GREATEST(0, COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0))
         END AS stock,
         p.name,
         p.images,
         p.shop_id,
         s.slug AS shop_slug
       FROM cart_items ci
       INNER JOIN inventory i ON i.id = ci.inventory_id
       INNER JOIN products p ON p.id = i.product_id
       LEFT JOIN shops s ON s.id = p.shop_id
       WHERE ci.user_id = $1
       ORDER BY ci.id ASC`,
      [auth.userId]
    );

    const items = rows.map((r) => ({
      id: String(r.cart_line_id),
      cartLineId: Number(r.cart_line_id),
      productId: Number(r.product_id),
      inventoryId: Number(r.inventory_id),
      name: String(r.name ?? ""),
      sku: r.sku != null ? String(r.sku) : null,
      price: Number(r.price) || 0,
      currency: r.currency != null ? String(r.currency) : "NGN",
      quantity: Number(r.quantity) || 1,
      stock: Number(r.stock) || 0,
      shopId: Number(r.shop_id) || 0,
      shopSlug: r.shop_slug != null ? String(r.shop_slug) : "",
      images: Array.isArray(r.images) ? r.images.map(String) : [],
    }));

    return NextResponse.json({ items });
  } catch (err: unknown) {
    if (isPgError(err) && err.code === MISSING_TABLE) {
      return NextResponse.json(
        {
          error:
            "Cart table is missing. Run database migrations (e.g. npm run migrate in the node package).",
          items: [],
        },
        { status: 503 }
      );
    }
    console.error("GET /api/cart:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load cart." },
      { status: 500 }
    );
  }
}

/**
 * POST — add or merge quantity for an inventory line (upsert).
 * Body: { inventoryId: number, quantity?: number } (default quantity 1)
 */
export async function POST(request: NextRequest) {
  const auth = await requireCustomer(request);
  if ("error" in auth) return auth.error;

  let body: { inventoryId?: unknown; quantity?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const inventoryId = Number(body.inventoryId);
  if (!Number.isFinite(inventoryId) || inventoryId < 1) {
    return NextResponse.json({ error: "inventoryId is required." }, { status: 400 });
  }

  let addQty = Number(body.quantity ?? 1);
  if (!Number.isFinite(addQty) || addQty < 1) addQty = 1;
  addQty = Math.min(99, Math.floor(addQty));

  try {
    await query(
      `INSERT INTO cart_items (user_id, inventory_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, inventory_id)
       DO UPDATE SET
         quantity = LEAST(99, cart_items.quantity + EXCLUDED.quantity),
         updated_at = now()`,
      [auth.userId, inventoryId, addQty]
    );
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (isPgError(err) && err.code === "23503") {
      return NextResponse.json({ error: "Invalid product variant." }, { status: 400 });
    }
    if (isPgError(err) && err.code === MISSING_TABLE) {
      return NextResponse.json(
        { error: "Cart table is missing. Run database migrations first." },
        { status: 503 }
      );
    }
    console.error("POST /api/cart:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update cart." },
      { status: 500 }
    );
  }
}

/**
 * PATCH — set quantity for a cart line owned by the user.
 * Body: { cartLineId: number, quantity: number }
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireCustomer(request);
  if ("error" in auth) return auth.error;

  let body: { cartLineId?: unknown; quantity?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const cartLineId = Number(body.cartLineId);
  const quantity = Number(body.quantity);
  if (!Number.isFinite(cartLineId) || cartLineId < 1) {
    return NextResponse.json({ error: "cartLineId is required." }, { status: 400 });
  }
  if (!Number.isFinite(quantity)) {
    return NextResponse.json({ error: "quantity is required." }, { status: 400 });
  }

  const q = Math.max(1, Math.min(99, Math.floor(quantity)));

  try {
    const { rowCount } = await query(
      `UPDATE cart_items
       SET quantity = $1, updated_at = now()
       WHERE id = $2 AND user_id = $3`,
      [q, cartLineId, auth.userId]
    );
    if (!rowCount) {
      return NextResponse.json({ error: "Cart line not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (isPgError(err) && err.code === MISSING_TABLE) {
      return NextResponse.json(
        { error: "Cart table is missing. Run database migrations first." },
        { status: 503 }
      );
    }
    console.error("PATCH /api/cart:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update cart." },
      { status: 500 }
    );
  }
}

/**
 * DELETE — remove one line (?cartLineId=) or clear cart (?all=1 or no cartLineId).
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireCustomer(request);
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const cartLineIdRaw = searchParams.get("cartLineId");
  const all = searchParams.get("all");

  try {
    const wantsClearAll =
      all === "1" || cartLineIdRaw == null || cartLineIdRaw === "";

    if (wantsClearAll) {
      await query(`DELETE FROM cart_items WHERE user_id = $1`, [auth.userId]);
      return NextResponse.json({ ok: true });
    }

    const cartLineId = Number(cartLineIdRaw);
    if (!Number.isFinite(cartLineId) || cartLineId < 1) {
      return NextResponse.json({ error: "Invalid cartLineId." }, { status: 400 });
    }

    const { rowCount } = await query(
      `DELETE FROM cart_items WHERE id = $1 AND user_id = $2`,
      [cartLineId, auth.userId]
    );
    if (!rowCount) {
      return NextResponse.json({ error: "Cart line not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if (isPgError(err) && err.code === MISSING_TABLE) {
      return NextResponse.json(
        { error: "Cart table is missing. Run database migrations first." },
        { status: 503 }
      );
    }
    console.error("DELETE /api/cart:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update cart." },
      { status: 500 }
    );
  }
}
