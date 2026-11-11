import Link from "next/link";
import { IoStar } from "react-icons/io5";

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

export default function ShopDetails({ shop }) {
  if (!shop?.slug && !shop?.name) return null;

  const name = shop.name || "Shop";
  const href = shop.slug ? `/store/${encodeURIComponent(shop.slug)}` : "/vendors";
  const rating = Number(shop.rating) || 0;
  const sold = Number(shop.soldCount) || 0;
  const products = Number(shop.productCount) || 0;
  const starSeller = Boolean(shop.verified) || rating >= 4;
  const started = startedLabel(shop.createdAt);

  return (
    <div className="pdp-shop-card">
      <div className="pdp-shop-card__row">
        {shop.logo ? (
          <img className="pdp-shop-card__logo" src={shop.logo} alt="" />
        ) : (
          <span className="pdp-shop-card__logo pdp-shop-card__logo--fallback">{name.slice(0, 1)}</span>
        )}
        <div className="pdp-shop-card__copy">
          <div className="pdp-shop-card__name-row">
            <h3>{name}</h3>
            {starSeller ? <span className="pdp-shop-card__badge">Star seller</span> : null}
          </div>
          <p className="pdp-shop-card__meta">
            {sold > 0 ? <span>{compactCount(sold)} Sold</span> : null}
            {rating > 0 ? (
              <span>
                {rating.toFixed(1)} <IoStar size={12} color="#00926E" />
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <Link href={href} className="pdp-shop-card__shop-all">
        Shop all items{products > 0 ? ` (${products})` : ""}
      </Link>
      {started ? (
        <p className="pdp-shop-card__started">{started}</p>
      ) : null}
    </div>
  );
}
