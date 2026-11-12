"use client";

import { useEffect, useMemo, useState } from "react";
import { IoStar, IoStarHalf, IoStarOutline } from "react-icons/io5";
import ProductCard from "./ProductCard";
import { buyerAuthHeaders } from "../../reusables/shopBackendAuth";
import { CART_UPDATED_EVENT, notifyCartUpdated } from "../../reusables/cartEvents";

function formatSold(n) {
    const sold = Number(n) || 0;
    if (sold <= 0) return "";
    if (sold >= 1000) {
        const compact = sold >= 10000 ? Math.round(sold / 1000) : Math.round((sold / 1000) * 10) / 10;
        return `${compact}K+ sold`;
    }
    return `${sold} sold`;
}

function StarRow({ rating, count }) {
    const value = Number(rating) || 0;
    const reviews = Number(count) || 0;
    return (
        <div className="card-rating">
            {[1, 2, 3, 4, 5].map((star) => {
                const Icon = value >= star ? IoStar : value >= star - 0.5 ? IoStarHalf : IoStarOutline;
                return <Icon key={star} size={12} color={value > 0 ? "#00926E" : "#D0D0D0"} />;
            })}
            <span>
                {value > 0 ? value.toFixed(1) : "New"}
                {reviews > 0 ? ` (${reviews.toLocaleString("en-NG")})` : ""}
            </span>
        </div>
    );
}

const PAGE_SIZE = 40;

export default function CustomerHome() {
    const [products, setProducts] = useState([]);
    const [nextOffset, setNextOffset] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [windowDays, setWindowDays] = useState(null);
    const [sort, setSort] = useState("sold");
    const [categoryKey, setCategoryKey] = useState("");
    const [cartBusyId, setCartBusyId] = useState("");
    const [addedIds, setAddedIds] = useState(() => new Set());

    useEffect(() => {
        let active = true;
        setLoading(true);
        fetch(`/api/storefront/products?limit=${PAGE_SIZE}&offset=0`)
            .then((response) => response.json())
            .then((payload) => {
                if (!active) return;
                const rows = Array.isArray(payload?.products) ? payload.products : [];
                setProducts(rows);
                setHasMore(Boolean(payload?.hasMore));
                setNextOffset(
                    Number.isFinite(Number(payload?.nextOffset))
                        ? Number(payload.nextOffset)
                        : rows.length
                );
            })
            .catch(() => {
                if (!active) return;
                setProducts([]);
                setHasMore(false);
                setNextOffset(0);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, []);

    async function loadMore() {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            const response = await fetch(
                `/api/storefront/products?limit=${PAGE_SIZE}&offset=${nextOffset}`
            );
            const payload = await response.json().catch(() => ({}));
            const rows = Array.isArray(payload?.products) ? payload.products : [];
            setProducts((prev) => {
                const seen = new Set(prev.map((row) => String(row.id)));
                return [...prev, ...rows.filter((row) => !seen.has(String(row.id)))];
            });
            setHasMore(Boolean(payload?.hasMore));
            setNextOffset(
                Number.isFinite(Number(payload?.nextOffset))
                    ? Number(payload.nextOffset)
                    : nextOffset + rows.length
            );
        } catch {
            setHasMore(false);
        } finally {
            setLoadingMore(false);
        }
    }

    useEffect(() => {
        let active = true;
        async function loadCarted() {
            try {
                const response = await fetch("/api/cart", {
                    method: "GET",
                    credentials: "include",
                    headers: buyerAuthHeaders(),
                });
                const payload = await response.json().catch(() => ({}));
                if (!active || !response.ok) return;
                const items = Array.isArray(payload.items) ? payload.items : [];
                setAddedIds(new Set(items.map((row) => String(row.productId))));
            } catch {
                if (active) setAddedIds(new Set());
            }
        }
        loadCarted();
        window.addEventListener(CART_UPDATED_EVENT, loadCarted);
        return () => {
            active = false;
            window.removeEventListener(CART_UPDATED_EVENT, loadCarted);
        };
    }, []);

    const categories = useMemo(() => {
        const seen = new Set();
        const rows = [];
        products.forEach((product) => {
            if (!product.categoryKey || seen.has(product.categoryKey)) return;
            seen.add(product.categoryKey);
            rows.push({ key: product.categoryKey, title: product.category });
        });
        return rows;
    }, [products]);

    const visible = useMemo(() => {
        const now = Date.now();
        const cutoff = windowDays ? now - windowDays * 24 * 60 * 60 * 1000 : 0;
        let list = products.filter((product) => {
            if (categoryKey && product.categoryKey !== categoryKey) return false;
            if (!cutoff) return true;
            const created = Date.parse(product.createdAt);
            return Number.isFinite(created) && created >= cutoff;
        });
        if (sort === "sold" || windowDays) {
            list = [...list].sort((a, b) =>
                (b.shopReviewCount || 0) - (a.shopReviewCount || 0)
                || (b.reviewCount || 0) - (a.reviewCount || 0)
                || (b.sold || 0) - (a.sold || 0)
            );
        } else if (sort === "price-asc") {
            list = [...list].sort((a, b) => a.price - b.price);
        } else if (sort === "price-desc") {
            list = [...list].sort((a, b) => b.price - a.price);
        }
        return list;
    }, [products, windowDays, sort, categoryKey]);

    async function addToCart(event, product) {
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
                setAddedIds((prev) => new Set(prev).add(String(product.id)));
                notifyCartUpdated();
            }
        } finally {
            setCartBusyId("");
        }
    }

    return (
        <section className="deedyte-home" id="deedyte-home">
            <div className="deedyte-home-toolbar">
                <div className="deedyte-home-chips">
                    <button
                        type="button"
                        className={`deedyte-home-link-chip${windowDays == null && sort !== "price-asc" && sort !== "price-desc" ? " is-active" : ""}`}
                        onClick={() => {
                            setWindowDays(null);
                            setSort("sold");
                        }}
                    >
                        Best-Selling Items
                    </button>
                    {[
                        { days: 30, label: "Within last 30 days" },
                        { days: 14, label: "Within last 14 days" },
                        { days: 7, label: "Within last 7 days" },
                    ].map((chip) => (
                        <button
                            key={chip.days}
                            type="button"
                            className={windowDays === chip.days ? "is-active" : ""}
                            onClick={() => {
                                setWindowDays(chip.days);
                                setSort("sold");
                            }}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>
                <div className="deedyte-home-toolbar-right">
                    <label>
                        {/* Filter by category */}
                        <select value={categoryKey} onChange={(event) => setCategoryKey(event.target.value)}>
                            <option value="">All</option>
                            {categories.map((category) => (
                                <option key={category.key} value={category.key}>
                                    {category.title}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <select
                            value={sort === "sold" || sort === "recommended" ? "recommended" : sort}
                            onChange={(event) => setSort(event.target.value)}
                        >
                            <option value="recommended">Recommended</option>
                            <option value="price-asc">Lowest price</option>
                            <option value="price-desc">Highest price</option>
                        </select>
                    </label>
                </div>
            </div>

            <div className="deedyte-home-grid">
                {visible.map((product) => {
                    const soldLabel = formatSold(product.sold);
                    return (
                        <ProductCard
                            key={product.id}
                            product={product}
                            extra={soldLabel ? <span className="card-sold">{soldLabel}</span> : null}
                        >
                            {product.featured ? (
                                <p className="card-badge">Best-Selling Item{product.category ? ` in ${product.category}` : ""}</p>
                            ) : null}
                            <StarRow rating={product.rating} count={product.reviewCount} />
                            {product.brand ? (
                                <p className="card-brand">
                                    <span>Star seller</span> Brand: {product.brand}
                                </p>
                            ) : null}
                        </ProductCard>
                    );
                })}
            </div>
            {!loading && !visible.length ? (
                <p className="deedyte-home-empty">No products yet.</p>
            ) : null}
            {hasMore ? (
                <div className="deedyte-home-load-more">
                    <button
                        type="button"
                        className="deedyte-home-load-more__btn"
                        onClick={() => void loadMore()}
                        disabled={loadingMore}
                    >
                        {loadingMore ? "Loading…" : "Load more"}
                    </button>
                </div>
            ) : null}
        </section>
    );
}
