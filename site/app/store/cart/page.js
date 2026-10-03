"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./styles/xxl.css";
import "./styles/s.css";
import { buyerAuthHeaders } from "@/reusables/shopBackendAuth";

const DELIVERY_NGN = 40_000;
const TAX_NGN = 22_000;
const DISCOUNT_NGN = 95_000;

function formatMoney(n) {
  return `₦${Number(n).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export default function CartPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [actionError, setActionError] = useState("");
  const [promo, setPromo] = useState("SAVE60");
  const [promoApplied, setPromoApplied] = useState(true);

  const loadCart = useCallback(async () => {
    setLoadError("");
    setAuthRequired(false);
    setActionError("");
    setLoading(true);
    try {
      const res = await fetch("/api/cart", {
        method: "GET",
        headers: buyerAuthHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setItems([]);
        setAuthRequired(true);
        return;
      }
      if (!res.ok) {
        setItems([]);
        setLoadError(typeof data.error === "string" ? data.error : "Could not load your cart.");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
      setLoadError("Could not load your cart.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  const itemCount = useMemo(
    () => items.reduce((s, i) => s + (Number(i.quantity) || 0), 0),
    [items]
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0),
        0
      ),
    [items]
  );

  const discountAmount = promoApplied ? DISCOUNT_NGN : 0;
  const total = subtotal + DELIVERY_NGN + TAX_NGN - discountAmount;

  async function setQty(cartLineId, next) {
    const q = Math.max(1, Math.min(99, Number(next) || 1));
    const prev = items;
    setItems((rows) =>
      rows.map((row) =>
        String(row.id) === String(cartLineId) ? { ...row, quantity: q } : row
      )
    );
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: buyerAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ cartLineId: Number(cartLineId), quantity: q }),
      });
      if (!res.ok) {
        setItems(prev);
        const data = await res.json().catch(() => ({}));
        setActionError(typeof data.error === "string" ? data.error : "Could not update quantity.");
      } else {
        setActionError("");
      }
    } catch {
      setItems(prev);
      setActionError("Could not update quantity.");
    }
  }

  async function removeLine(cartLineId) {
    const prev = items;
    setItems((rows) => rows.filter((row) => String(row.id) !== String(cartLineId)));
    try {
      const res = await fetch(
        `/api/cart?cartLineId=${encodeURIComponent(String(cartLineId))}`,
        {
          method: "DELETE",
          headers: buyerAuthHeaders(),
          credentials: "include",
        }
      );
      if (!res.ok) {
        setItems(prev);
        const data = await res.json().catch(() => ({}));
        setActionError(typeof data.error === "string" ? data.error : "Could not remove item.");
      } else {
        setActionError("");
      }
    } catch {
      setItems(prev);
      setActionError("Could not remove item.");
    }
  }

  async function removeAll() {
    const prev = items;
    setItems([]);
    try {
      const res = await fetch("/api/cart", {
        method: "DELETE",
        headers: buyerAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) {
        setItems(prev);
        const data = await res.json().catch(() => ({}));
        setActionError(typeof data.error === "string" ? data.error : "Could not clear cart.");
      } else {
        setActionError("");
      }
    } catch {
      setItems(prev);
      setActionError("Could not clear cart.");
    }
  }

  function applyPromo() {
    const code = promo.trim().toLowerCase();
    if (code === "save60" || code === "save") {
      setPromoApplied(true);
    }
  }

  if (loading) {
    return (
      <div className="crt-page">
        <main className="crt-main">
          <p className="crt-empty" role="status">
            Loading your cart…
          </p>
        </main>
      </div>
    );
  }

  if (authRequired) {
    return (
      <div className="crt-page">
        <main className="crt-main">
          <p className="crt-empty">
            <Link href="/auth/login?role=customer" className="crt-empty__link">
              Sign in
            </Link>{" "}
            to view your cart.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="crt-page">
      <main className="crt-main">
        {loadError ? (
          <p className="crt-empty" role="alert">
            {loadError}{" "}
            <button type="button" className="crt-empty__link" onClick={() => loadCart()}>
              Retry
            </button>
          </p>
        ) : null}
        {actionError ? (
          <p className="crt-empty" role="alert">
            {actionError}
          </p>
        ) : null}
        {!loadError && items.length === 0 ? (
          <p className="crt-empty">
            <Link href="/" className="crt-empty__link">
              Continue shopping
            </Link>
          </p>
        ) : null}
        {!loadError && items.length > 0 ? (
          <div className="crt-layout">
            <section className="crt-lines" aria-label="Cart items">
              {items.map((row) => {
                const priceEach = Number(row.price) || 0;
                const qty = Number(row.quantity) || 1;
                const lineTotal = priceEach * qty;
                const thumb =
                  Array.isArray(row.images) && row.images[0]
                    ? row.images[0]
                    : "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop&q=80";
                const skuLabel = row.sku && String(row.sku).trim() ? row.sku : "—";
                return (
                  <article key={String(row.id)} className="crt-line">
                    <div className="crt-line__thumb-wrap">
                      <img
                        className="crt-line__thumb"
                        src={thumb}
                        alt=""
                        width={88}
                        height={88}
                      />
                    </div>
                    <div className="crt-line__info">
                      <h2 className="crt-line__name">{row.name}</h2>
                      <p className="crt-line__meta">Color: —</p>
                      <p className="crt-line__meta">SKU: {skuLabel}</p>
                      <p className="crt-line__meta">
                        Price: {formatMoney(priceEach)} / per item
                      </p>
                    </div>
                    <div className="crt-line__total">{formatMoney(lineTotal)}</div>
                    <div className="crt-line__controls">
                      <label className="crt-qty-label">
                        <span className="crt-sr-only">Quantity for {row.name}</span>
                        <select
                          className="crt-qty"
                          value={qty}
                          onChange={(e) => setQty(row.id, e.target.value)}
                          aria-label={`Quantity for ${row.name}`}
                        >
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              Qty: {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="crt-line__actions">
                        <button
                          type="button"
                          className="crt-icon-btn"
                          aria-label={`Remove ${row.name} from cart`}
                          onClick={() => removeLine(row.id)}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                            <path
                              fill="currentColor"
                              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
              <div className="crt-lines__footer">
                <button type="button" className="crt-remove-all" onClick={removeAll}>
                  Remove all from cart
                </button>
              </div>
            </section>

            <aside className="crt-summary" aria-label="Order summary">
              <div className="crt-promo">
                <input
                  type="text"
                  className="crt-promo__input"
                  placeholder="Promocode"
                  value={promo}
                  onChange={(e) => setPromo(e.target.value)}
                  aria-label="Promocode"
                />
                <button type="button" className="crt-promo__btn" onClick={applyPromo}>
                  Apply
                </button>
              </div>
              {promoApplied ? (
                <p className="crt-promo__ok" role="status">
                  Promocode applied.
                </p>
              ) : null}

              <dl className="crt-breakdown">
                <div className="crt-row">
                  <dt>
                    {itemCount} item{itemCount === 1 ? "" : "s"}:
                  </dt>
                  <dd>{formatMoney(subtotal)}</dd>
                </div>
                <div className="crt-row">
                  <dt>Delivery cost:</dt>
                  <dd>{formatMoney(DELIVERY_NGN)}</dd>
                </div>
                <div className="crt-row">
                  <dt>Tax:</dt>
                  <dd>{formatMoney(TAX_NGN)}</dd>
                </div>
                <div className="crt-row crt-row--discount">
                  <dt>Discount:</dt>
                  <dd>{discountAmount > 0 ? `- ${formatMoney(discountAmount)}` : "—"}</dd>
                </div>
              </dl>

              <div className="crt-total-row">
                <span className="crt-total-label">Total:</span>
                <span className="crt-total-value">{formatMoney(total)}</span>
              </div>

              <Link href="/store/checkouts" className="crt-checkout">
                Checkout
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"
                  />
                </svg>
              </Link>
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  );
}
