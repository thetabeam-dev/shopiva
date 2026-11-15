import { SITE_ORIGIN } from "./siteNavigation";

function productUrl(id) {
  return `${SITE_ORIGIN}/${id}`;
}

function firstImages(product) {
  if (Array.isArray(product?.images)) {
    return product.images.map((value) => String(value ?? "").trim()).filter(Boolean);
  }
  const thumbnail = String(product?.thumbnail ?? product?.thumbnail_url ?? "").trim();
  return thumbnail ? [thumbnail] : [];
}

function offerPrice(product) {
  const amount = Number(product?.price ?? product?.minPrice ?? 0);
  if (!Number.isFinite(amount) || amount < 0) return "0.00";
  return amount.toFixed(2);
}

function productAggregateRating(product) {
  const metrics = product?.reviewMetrics ?? product?.reviews ?? null;
  const ratingValue = Number(
    metrics?.average_rating ?? metrics?.averageRating ?? product?.averageRating ?? 0,
  );
  const reviewCount = Number(
    metrics?.review_count ?? metrics?.reviewCount ?? product?.reviewCount ?? 0,
  );
  if (!Number.isFinite(ratingValue) || ratingValue <= 0) return null;
  if (!Number.isFinite(reviewCount) || reviewCount < 1) return null;
  return {
    "@type": "AggregateRating",
    ratingValue: Math.round(ratingValue * 10) / 10,
    bestRating: 5,
    worstRating: 1,
    ratingCount: reviewCount,
    reviewCount,
  };
}

export function productJsonLd(product) {
  const url = productUrl(product?.id);
  const images = firstImages(product);
  const shopName = String(product?.shopName ?? "").trim() || "DeeDyte";
  const aggregateRating = productAggregateRating(product);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: String(product?.name ?? product?.title ?? "Product").trim(),
    description: String(product?.description ?? "").replace(/<[^>]+>/g, " ").trim(),
    image: images,
    sku: String(product?.id ?? ""),
    url,
    brand: {
      "@type": "Brand",
      name: shopName,
    },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "NGN",
      price: offerPrice(product),
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: shopName,
      },
    },
    ...(aggregateRating ? { aggregateRating } : {}),
  };
}
