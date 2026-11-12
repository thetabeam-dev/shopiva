"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IoLockClosed, IoCheckmarkCircle } from "react-icons/io5";
import ProductCard from "@/components/customers/ProductCard";
import "./styles/xxl.css";
import "./styles/s.css";
import "../styles/xxl.css";
import CustomerHeader from "@/components/customers/Header";
import { buyerAuthHeaders } from "@/reusables/shopBackendAuth";
import { notifyCartUpdated } from "@/reusables/cartEvents";

function formatMoney(n) {
  return `₦${Number(n || 0).toLocaleString("en-NG", {
    maximumFractionDigits: 0,
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

function Checkmark({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`crt-check${checked ? " is-on" : ""}`}
      aria-pressed={checked}
      aria-label={label}
      onClick={onChange}
    >
      {checked ? <span>✓</span> : null}
    </button>
  );
}

export default function CartPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [listFilter, setListFilter] = useState("all");
  const [explore, setExplore] = useState([]);
  const [cartBusyId, setCartBusyId] = useState("");

  const loadCart = useCallback(async (quiet = false) => {
    setLoadError("");
    setActionError("");
    if (!quiet) setLoading(true);
    try {
      const res = await fetch("/api/cart", {
        method: "GET",
        headers: buyerAuthHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setItems([]);
        setSelectedIds(new Set());
        return;
      }
      if (!res.ok) {
        setItems([]);
        setLoadError(typeof data.error === "string" ? data.error : "Could not load your cart.");
        return;
      }
      const next = Array.isArray(data.items) ? data.items : [];
      setItems(next);
      setSelectedIds(new Set(next.map((row) => String(row.id))));
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

  useEffect(() => {
    let active = true;
    fetch("/api/storefront/products")
      .then((response) => response.json())
      .then((payload) => {
        if (active && Array.isArray(payload?.products)) setExplore(payload.products);
      })
      .catch(() => {
        if (active) setExplore([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleItems = useMemo(() => {
    if (listFilter !== "selected") return items;
    return items.filter((row) => selectedIds.has(String(row.id)));
  }, [items, listFilter, selectedIds]);

  const selectedItems = useMemo(
    () => items.filter((row) => selectedIds.has(String(row.id))),
    [items, selectedIds]
  );

  const allSelected = items.length > 0 && selectedItems.length === items.length;

  const totals = useMemo(() => {
    return selectedItems.reduce(
      (acc, row) => {
        const qty = Number(row.quantity) || 0;
        const price = Number(row.price) || 0;
        const compare = Number(row.compareAtPrice) || 0;
        const list = compare > price ? compare : price;
        acc.itemsTotal += list * qty;
        acc.discount += Math.max(0, list - price) * qty;
        acc.payable += price * qty;
        return acc;
      },
      { itemsTotal: 0, discount: 0, payable: 0 }
    );
  }, [selectedItems]);

  const selectedCount = selectedItems.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);

  const exploreProducts = useMemo(() => {
    const inCart = new Set(items.map((row) => String(row.productId)));
    return explore.filter((product) => !inCart.has(String(product.id))).slice(0, 10);
  }, [explore, items]);

  async function addExploreToCart(event, product) {
    event.preventDefault();
    event.stopPropagation();
    if (!product.inventoryId || cartBusyId) return;
    setCartBusyId(String(product.id));
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        credentials: "include",
        headers: buyerAuthHeaders(),
        body: JSON.stringify({ inventoryId: product.inventoryId, quantity: 1 }),
      });
      if (response.status === 401) {
        window.location.href = "/cart";
        return;
      }
      if (response.ok) {
        notifyCartUpdated();
        await loadCart(true);
      }
    } finally {
      setCartBusyId("");
    }
  }

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
    setSelectedIds((ids) => {
      const next = new Set(ids);
      next.delete(String(cartLineId));
      return next;
    });
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

  function toggleOne(id) {
    const key = String(id);
    setSelectedIds((ids) => {
      const next = new Set(ids);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((row) => String(row.id))));
  }

  return (
    <div className="crt-shell">
      <div className="buyer-head">
        <CustomerHeader />
      </div>
      <div className="crt-page">
        <div className="crt-safe" role="note">
          <IoLockClosed size={14} />
          All data is safeguarded
        </div>

        <nav className="crt-crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>›</span>
          <span>Cart</span>
        </nav>

        {loading ? (
          <div className="crt-status crt-status--loader" role="status" aria-label="Loading">
            <span className="site-process-loader__spinner" style={{ borderColor: "#ededed", borderTopColor: "#00926e" }} />
          </div>
        ) : null}

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

        {!loading && !loadError ? (
          <div className="crt-layout">
            <div className="crt-main">
              <div className="crt-pin">
                <div className="crt-ship">
                  <span>
                    <IoCheckmarkCircle size={18} />
                    Free shipping special for you
                  </span>
                  <small>Limited-time offer</small>
                </div>

                {items.length > 0 ? (
                  <div className="crt-toolbar">
                    <label className="crt-select-all">
                      <Checkmark
                        checked={allSelected}
                        onChange={toggleAll}
                        label="Select all"
                      />
                      Select all ({items.length})
                    </label>
                    <div className="crt-pills">
                      <button
                        type="button"
                        className={listFilter === "all" ? "is-on" : ""}
                        onClick={() => setListFilter("all")}
                      >
                        All ({items.length})
                      </button>
                      <button
                        type="button"
                        className={listFilter === "selected" ? "is-on" : ""}
                        onClick={() => setListFilter("selected")}
                      >
                        Selected ({selectedItems.length})
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="crt-scroll">
              {items.length === 0 ? (
                <div className="crt-empty">
                  <p>Your cart is empty.</p>
                  <Link href="/" className="crt-continue">
                    Continue shopping
                  </Link>
                </div>
              ) : (
                <>
                  <div className="crt-lines">
                    {visibleItems.map((row) => {
                      const priceEach = Number(row.price) || 0;
                      const compare = Number(row.compareAtPrice) || 0;
                      const qty = Number(row.quantity) || 1;
                      const stock = Number(row.stock);
                      const thumb =
                        row.thumbnail ||
                        (Array.isArray(row.images) && row.images[0] ? row.images[0] : "");
                      const maxQty =
                        Number.isFinite(stock) && stock > 0 ? Math.min(99, stock) : 99;
                      const productHref = row.productId ? `/${row.productId}` : "/";
                      const checked = selectedIds.has(String(row.id));
                      const lowStock = Number.isFinite(stock) && stock > 0 && stock <= 3;
                      const pct =
                        compare > priceEach
                          ? Math.round(((compare - priceEach) / compare) * 100)
                          : 0;
                      return (
                        <article key={String(row.id)} className="crt-line">
                          <div className="crt-line__select">
                            <Checkmark
                              checked={checked}
                              onChange={() => toggleOne(row.id)}
                              label={`Select ${row.name}`}
                            />
                            <Link href={productHref} className="crt-line__thumb">
                              {row.thumbnailIsVideo && thumb ? (
                                <video src={thumb} muted loop playsInline autoPlay preload="metadata" />
                              ) : thumb ? (
                                <img src={thumb} alt="" />
                              ) : null}
                              {lowStock ? <span className="crt-line__badge">Almost sold out</span> : null}
                            </Link>
                          </div>
                          <div className="crt-line__body">
                            <div className="crt-line__info">
                              <div className="crt-line__copy">
                                <h2 className="crt-line__name">
                                  <Link href={productHref}>{row.name}</Link>
                                </h2>
                                {row.sku ? (
                                  <p className="crt-line__sku">
                                    <Link href={productHref}>{row.sku} ›</Link>
                                  </p>
                                ) : null}
                              </div>
                              <div className="crt-line__price">
                                {pct > 0 || compare > priceEach ? (
                                  <p className="crt-line__was">
                                    {pct > 0 ? <span className="crt-off">-{pct}%</span> : null}
                                    {compare > priceEach ? <s>{formatMoney(compare)}</s> : null}
                                  </p>
                                ) : null}
                                <p className="crt-line__now">
                                  {compare > priceEach ? (
                                    <Link href={productHref}>
                                      {formatMoney(priceEach)} after applying promos to {formatMoney(compare)} ›
                                    </Link>
                                  ) : (
                                    <strong>{formatMoney(priceEach)}</strong>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="crt-line__actions">
                              <button
                                type="button"
                                className="crt-remove"
                                aria-label={`Remove ${row.name}`}
                                onClick={() => removeLine(row.id)}
                              >
                                <TrashIcon />
                              </button>
                              <div className="crt-qty" role="group" aria-label={`Quantity for ${row.name}`}>
                                <button
                                  type="button"
                                  aria-label="Decrease quantity"
                                  disabled={qty <= 1}
                                  onClick={() => setQty(row.id, qty - 1)}
                                >
                                  −
                                </button>
                                <span>{qty}</span>
                                <button
                                  type="button"
                                  aria-label="Increase quantity"
                                  disabled={qty >= maxQty}
                                  onClick={() => setQty(row.id, qty + 1)}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              )}

              {exploreProducts.length > 0 ? (
                <section id="crt-explore" className="crt-explore deedyte-home" aria-labelledby="crt-explore-title">
                  <h2 id="crt-explore-title">Explore More</h2>
                  <div className="deedyte-home-grid">
                    {exploreProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
              </div>
            </div>

            <aside className="crt-summary" aria-label="Order summary">
              <h2>Order Summary</h2>
              <dl>
                <div>
                  <dt>Item(s) total:</dt>
                  <dd>{formatMoney(totals.itemsTotal)}</dd>
                </div>
                {totals.discount > 0 ? (
                  <div>
                    <dt>Item(s) discount:</dt>
                    <dd className="is-off">-{formatMoney(totals.discount)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Shipping:</dt>
                  <dd>Calculated at checkout</dd>
                </div>
              </dl>
              <div className="crt-summary__total">
                <span>Total</span>
                <strong>{formatMoney(totals.payable)}</strong>
              </div>
              <p className="crt-summary__hint">Please refer to your final actual payment amount.</p>
              <Link
                href="/checkouts"
                className={`crt-checkout${selectedCount < 1 ? " is-disabled" : ""}`}
                aria-disabled={selectedCount < 1}
                onClick={(event) => {
                  if (selectedCount < 1) event.preventDefault();
                }}
              >
                Checkout ({selectedCount})
              </Link>
              <p className="crt-summary__note">
                Item availability and pricing are not guaranteed until payment is final.
              </p>
              <p className="crt-summary__lock">
                <IoLockClosed size={14} />
                You will not be charged until you review this order on the next page.
              </p>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
