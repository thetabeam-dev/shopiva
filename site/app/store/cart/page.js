"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import "./styles/xxl.css";
import "./styles/s.css";
import { buyerAuthHeaders } from "@/reusables/shopBackendAuth";

function formatMoney(n) {
  return `₦${Number(n || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13h8l1-13"
      />
    </svg>
  );
}

export default function CartPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [actionError, setActionError] = useState("");

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

  const productCount = items.length;
  const itemCount = useMemo(
    () => items.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0),
    [items]
  );
  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, row) => sum + (Number(row.price) || 0) * (Number(row.quantity) || 0),
        0
      ),
    [items]
  );

  const continueHref = useMemo(() => {
    const slug = items.find((row) => row.shopSlug)?.shopSlug;
    return slug ? `/store/${encodeURIComponent(slug)}` : "/";
  }, [items]);

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

  if (loading) {
    return (
      <div className="crt-page">
        <p className="crt-status" role="status">
          Loading your cart…
        </p>
      </div>
    );
  }

  if (authRequired) {
    return (
      <div className="crt-page">
        <p className="crt-status">
          <Link href="/auth/login?role=customer">Sign in</Link> to view your cart.
        </p>
      </div>
    );
  }

  return (
    <div className="crt-page">
      {loadError ? (
        <p className="crt-status" role="alert">
          {loadError}{" "}
          <button type="button" onClick={() => loadCart()}>
            Retry
          </button>
        </p>
      ) : null}
      {actionError ? (
        <p className="crt-status" role="alert">
          {actionError}
        </p>
      ) : null}

      {!loadError && items.length === 0 ? (
        <div className="crt-empty">
          <p>Your cart is empty.</p>
          <Link href={continueHref} className="crt-continue">
            Continue shopping →
          </Link>
        </div>
      ) : null}

      {!loadError && items.length > 0 ? (
        <div className="crt-shell">
          <header className="crt-head">
            <p className="crt-head__count">
              {productCount} product{productCount === 1 ? "" : "s"} · {itemCount} item
              {itemCount === 1 ? "" : "s"}
            </p>
          </header>

          <div className="crt-layout">
            <div className="crt-lines">
              {items.map((row) => {
                const priceEach = Number(row.price) || 0;
                const qty = Number(row.quantity) || 1;
                const stock = Number(row.stock);
                const lineTotal = priceEach * qty;
                const thumb = Array.isArray(row.images) && row.images[0] ? row.images[0] : "";
                const maxQty =
                  Number.isFinite(stock) && stock > 0 ? Math.min(99, stock) : 99;
                const productHref =
                  row.shopSlug && row.productId
                    ? `/store/${encodeURIComponent(row.shopSlug)}/${row.productId}`
                    : continueHref;
                return (
                  <article key={String(row.id)} className="crt-line">
                    <div className="crt-line__thumb">
                      {thumb ? <img src={thumb} alt="" /> : null}
                    </div>
                    <div className="crt-line__body">
                      <div className="crt-line__top">
                        <div>
                          <h2 className="crt-line__name">
                            <Link href={productHref}>{row.name}</Link>
                          </h2>
                          <p className="crt-line__stock">
                            {Number.isFinite(stock) ? stock : 0} units available
                          </p>
                        </div>
                        <p className="crt-line__unit">{formatMoney(priceEach)}</p>
                      </div>
                      <div className="crt-line__bottom">
                        <div className="crt-line__tools">
                          <div className="crt-qty" role="group" aria-label={`Units for ${row.name}`}>
                            <button
                              type="button"
                              aria-label="Remove unit"
                              disabled={qty <= 1}
                              onClick={() => setQty(row.id, qty - 1)}
                            >
                              −
                            </button>
                            <span>{qty}</span>
                            <button
                              type="button"
                              aria-label="Add unit"
                              disabled={qty >= maxQty}
                              onClick={() => setQty(row.id, qty + 1)}
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            className="crt-remove"
                            onClick={() => removeLine(row.id)}
                          >
                            <TrashIcon />
                            Remove
                          </button>
                        </div>
                        <div className="crt-line__totals">
                          <span>Item total</span>
                          <strong>{formatMoney(lineTotal)}</strong>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <aside className="crt-summary" aria-label="Order summary">
              <h2>Order summary</h2>
              <dl>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatMoney(subtotal)}</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>Free</dd>
                </div>
              </dl>
              <div className="crt-summary__total">
                <span>Total</span>
                <strong>{formatMoney(subtotal)}</strong>
              </div>
              <Link href="/store/checkouts" style={{textDecoration: "none"}} className="crt-checkout">
                Proceed to checkout →
              </Link>
              <p className="crt-summary__note">
                Your order details will be confirmed at checkout.
              </p>
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}
