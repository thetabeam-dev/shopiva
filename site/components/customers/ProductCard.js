"use client";

import Link from "next/link";
import { IoCart, IoCartOutline } from "react-icons/io5";

function formatNgn(n) {
  return `₦${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function ProductCard({ product, onAddToCart, cartBusy, extra, children, added }) {
  const href = product.path || `/${product.id}`;
  const busy = cartBusy === String(product.id);

  function handleAdd(event) {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();
    onAddToCart?.(event, product);
  }

  return (
    <article className="product-card shadow-sm">
      <Link href={href} className="product-card__media">
        <div className="card-thumbnail">
          {product.thumbnailIsVideo && product.thumbnail ? (
            <video src={product.thumbnail} muted loop playsInline autoPlay preload="metadata" />
          ) : product.thumbnail ? (
            <img src={product.thumbnail} alt={product.name} />
          ) : null}
        </div>
        <div className="card-title">{product.name}</div>
      </Link>
      <div className="card-detail">
        <div className="card-price-row">
          <b className="card-price">{formatNgn(product.price)}</b>
          {product.compareAtPrice ? (
            <span className="card-compare">{formatNgn(product.compareAtPrice)}</span>
          ) : null}
          {extra}
          <button
            type="button"
            className={`card-cart${added ? " is-added" : ""}`}
            aria-label={added ? `${product.name} in cart` : `Add ${product.name} to cart`}
            onClick={handleAdd}
            disabled={busy}
          >
            {added ? <IoCart size={16} /> : <IoCartOutline size={16} />}
          </button>
        </div>
        {children}
      </div>
    </article>
  );
}
