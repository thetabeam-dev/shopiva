"use client";

import Link from "next/link";

function formatNgn(n) {
  return `₦${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function ProductCard({ product, extra, children }) {
  const href = product.path || `/${product.id}`;

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
        </div>
        {children}
      </div>
    </article>
  );
}
