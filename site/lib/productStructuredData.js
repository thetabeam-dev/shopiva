import { SITE_ORIGIN } from "./siteNavigation";

function productUrl(slug, id) {
  return `${SITE_ORIGIN}/store/${encodeURIComponent(String(slug))}/${id}`;
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

export function productJsonLd(product, slug) {
  const url = productUrl(slug, product?.id);
  const images = firstImages(product);
  const shopName = String(product?.shopName ?? "").trim() || "DeeDyte";

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
  };
}
