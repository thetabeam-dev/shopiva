"use client";

/**
 * Public shop storefront (Temu-style vendor store).
 */
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IoSearchOutline, IoStar } from "react-icons/io5";
import "./vendor-store.css";

function formatNgn(n) {
  return `₦${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function compactCount(value) {
  const n = Number(value) || 0;
  if (n >= 1000) {
    const compact = n >= 10000 ? Math.round(n / 1000) : Math.round((n / 1000) * 10) / 10;
    return `${compact}K+`;
  }
  return String(n);
}

function startedLabel(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  const years = Math.max(0, Math.floor((Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
  if (years < 1) return "Started to sell on DeeDyte this year";
  if (years === 1) return "Started to sell on DeeDyte 1 year ago";
  return `Started to sell on DeeDyte ${years} years ago`;
}

function isVideoFile(url) {
  return /\.(mp4|webm|mov|m4v|ogv|ogg|avi|mkv)(\?|#|$)/i.test(String(url || ""));
}

export default function PublicShopPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const [shop, setShop] = useState(null);
  const [catalogAll, setCatalogAll] = useState([]);
  const [catalogError, setCatalogError] = useState("");
  const [tab, setTab] = useState("items");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("relevance");

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/storefront/shop/${encodeURIComponent(slug)}/products`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) {
            setCatalogError(typeof data.error === "string" ? data.error : "Could not load products.");
            setCatalogAll([]);
          }
          return;
        }
        if (!cancelled) {
          setShop(data.shop && typeof data.shop === "object" ? data.shop : null);
          setCatalogAll(Array.isArray(data.products) ? data.products : []);
          setCatalogError("");
        }
      } catch {
        if (!cancelled) {
          setCatalogError("Could not load products.");
          setCatalogAll([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const categories = useMemo(() => {
    const seen = new Set();
    const rows = [];
    for (const product of catalogAll) {
      const key = String(product.category || "").trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push({
        key,
        title: product.categoryLabel || key,
      });
    }
    return rows;
  }, [catalogAll]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = catalogAll.filter((product) => {
      if (tab !== "items" && tab !== "reviews" && tab !== "about" && product.category !== tab) {
        return false;
      }
      if (!q) return true;
      return String(product.name || "").toLowerCase().includes(q);
    });
    if (sort === "from_low_to_high") {
      list = [...list].sort((a, b) => Number(a.minPrice ?? a.price) - Number(b.minPrice ?? b.price));
    } else if (sort === "from_high_to_low") {
      list = [...list].sort((a, b) => Number(b.minPrice ?? b.price) - Number(a.minPrice ?? a.price));
    }
    return list;
  }, [catalogAll, tab, query, sort]);

  const name = shop?.name || "Shop";
  const started = startedLabel(shop?.createdAt);
  const starSeller = Boolean(shop?.verified) || Number(shop?.average_rating) >= 4;
  const itemCount = catalogAll.length || Number(shop?.productCount) || 0;
  const rating = Number(shop?.average_rating) || 0;
  const reviewCount = Number(shop?.review_count) || 0;
  const showingItems = tab !== "reviews" && tab !== "about";

  return (
    <div className="vendor-store">
      <div className="vendor-store__profile">
        <div className="vendor-store__identity">
          {shop?.logo ? (
            <img className="vendor-store__logo" src={shop.logo} alt="" />
          ) : (
            <span className="vendor-store__logo--fallback">{name.slice(0, 1)}</span>
          )}
          <div>
            <h1>{name}</h1>
            <div className="vendor-store__meta">
              {starSeller ? (
                <span className="vendor-store__badge">
                  <IoStar size={11} /> Star seller
                </span>
              ) : null}
              {started ? <span className="vendor-store__started">{started}</span> : null}
            </div>
          </div>
        </div>
        <div className="vendor-store__stats">
          <div className="vendor-store__stat">
            <b>{compactCount(shop?.soldCount)}</b>
            <span>Sold</span>
          </div>
          <div className="vendor-store__stat">
            <b>{compactCount(itemCount)}</b>
            <span>Items</span>
          </div>
          <div className="vendor-store__stat">
            <b>{rating > 0 ? rating.toFixed(1) : "—"}</b>
            <span>Rating</span>
          </div>
        </div>
      </div>

      <nav className="vendor-store__nav">
        <button type="button" className={tab === "items" ? "is-active" : ""} onClick={() => setTab("items")}>
          Items
        </button>
        {categories.slice(0, 3).map((category) => (
          <button
            key={category.key}
            type="button"
            className={tab === category.key ? "is-active" : ""}
            onClick={() => setTab(category.key)}
          >
            {category.title}
          </button>
        ))}
        <button type="button" className={tab === "reviews" ? "is-active" : ""} onClick={() => setTab("reviews")}>
          Reviews{reviewCount > 0 ? ` (${rating.toFixed(1)})` : ""}
        </button>
        <button type="button" className={tab === "about" ? "is-active" : ""} onClick={() => setTab("about")}>
          About
        </button>
        {/* <label className="vendor-store__search">
          <IoSearchOutline size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={itemCount ? `Search all ${itemCount} items` : "Search items"}
          />
        </label> */}
      </nav>

      {showingItems ? (
        <>
          <div className="vendor-store__toolbar">
            <h2>{visible.length} items</h2>
            <label>
              Sort by
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="relevance">Relevance</option>
                <option value="from_low_to_high">Lowest price</option>
                <option value="from_high_to_low">Highest price</option>
              </select>
            </label>
          </div>
          {catalogError ? <p className="vendor-store__empty">{catalogError}</p> : null}
          {!catalogError && visible.length === 0 ? (
            <p className="vendor-store__empty">No products in this shop yet.</p>
          ) : (
            <div className="vendor-store__grid">
              {visible.map((product) => (
                <Link key={product.id} href={`/${product.id}`} className="vendor-store-card">
                  <div className="vendor-store-card__media">
                    {product.thumbnail && isVideoFile(product.thumbnail) ? (
                      <video src={product.thumbnail} muted playsInline preload="metadata" />
                    ) : product.thumbnail ? (
                      <img src={product.thumbnail} alt="" />
                    ) : null}
                    <p className="vendor-store-card__title">{product.name}</p>
                  </div>
                  <div className="vendor-store-card__price">{formatNgn(product.minPrice ?? product.price)}</div>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : null}

      {tab === "reviews" ? (
        <div className="vendor-store__panel">
          <h2>
            {reviewCount > 0
              ? `${reviewCount} shop reviews · ${rating.toFixed(1)} average`
              : "No shop reviews yet"}
          </h2>
          <p>Reviews from buyers of this shop will show here.</p>
        </div>
      ) : null}

      {tab === "about" ? (
        <div className="vendor-store__panel">
          <h2>About {name}</h2>
          <p>{shop?.description?.trim() || "This shop has not added a description yet."}</p>
        </div>
      ) : null}
    </div>
  );
}
