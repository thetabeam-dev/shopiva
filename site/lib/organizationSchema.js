import { query } from "../app/api/lib/database";
import {
  APP_STORE_URL,
  ORGANIZATION_LOGO,
  PLAY_STORE_URL,
  SITE_ORIGIN,
  SOCIAL_PROFILE_URLS,
  absoluteUrl,
  sitelinkSections,
} from "./siteNavigation";

async function marketplaceRating() {
  try {
    const result = await query(`
      SELECT
        ROUND(AVG(rating)::numeric, 1)::float AS rating,
        COUNT(*)::int AS count
      FROM (
        SELECT rating FROM shop_reviews WHERE is_hidden IS NOT TRUE
        UNION ALL
        SELECT rating FROM product_reviews
      ) reviews
    `);
    const rating = Number(result.rows[0]?.rating);
    const count = Number(result.rows[0]?.count);
    if (!Number.isFinite(rating) || rating <= 0 || !Number.isFinite(count) || count < 1) {
      return null;
    }
    return { rating, count };
  } catch (error) {
    console.error("Organization rating lookup failed:", error);
    return null;
  }
}

export async function buildSearchAppearanceSchema() {
  const rating = await marketplaceRating();
  const organizationId = `${SITE_ORIGIN}/#organization`;
  const websiteId = `${SITE_ORIGIN}/#website`;

  const organization = {
    "@type": ["Organization", "OnlineStore"],
    "@id": organizationId,
    name: "DeeDyte Nigeria",
    alternateName: ["DeeDyte", "DeeDyte NG"],
    url: `${SITE_ORIGIN}/`,
    logo: {
      "@type": "ImageObject",
      url: ORGANIZATION_LOGO,
    },
    image: ORGANIZATION_LOGO,
    description:
      "DeeDyte is a local on-demand marketplace for ordering products from nearby vendors in Nigeria.",
    email: "admin@deedyte.com",
    areaServed: {
      "@type": "Country",
      name: "Nigeria",
    },
    address: {
      "@type": "PostalAddress",
      addressCountry: "NG",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "admin@deedyte.com",
      url: absoluteUrl("/contact"),
      areaServed: "NG",
      availableLanguage: ["en"],
    },
    sameAs: SOCIAL_PROFILE_URLS,
  };

  if (rating) {
    organization.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating.rating,
      bestRating: 5,
      worstRating: 1,
      reviewCount: rating.count,
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: "DeeDyte Nigeria",
        url: `${SITE_ORIGIN}/`,
        publisher: { "@id": organizationId },
        inLanguage: "en-NG",
        description:
          "Shop fashion, electronics, home, and more from nearby vendors on DeeDyte.",
      },
      {
        "@type": "SoftwareApplication",
        name: "DeeDyte",
        operatingSystem: "iOS",
        applicationCategory: "https://schema.org/ShoppingApplication",
        url: APP_STORE_URL,
        installUrl: APP_STORE_URL,
        downloadUrl: APP_STORE_URL,
        publisher: { "@id": organizationId },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "NGN",
        },
      },
      {
        "@type": "SoftwareApplication",
        name: "DeeDyte",
        operatingSystem: "ANDROID",
        applicationCategory: "https://schema.org/ShoppingApplication",
        url: PLAY_STORE_URL,
        installUrl: PLAY_STORE_URL,
        downloadUrl: PLAY_STORE_URL,
        publisher: { "@id": organizationId },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "NGN",
        },
      },
      {
        "@type": "ItemList",
        name: "DeeDyte sitelinks",
        itemListElement: sitelinkSections().map((section, index) => ({
          "@type": "SiteNavigationElement",
          position: index + 1,
          name: section.title,
          url: absoluteUrl(section.path),
        })),
      },
    ],
  };
}
