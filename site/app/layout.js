/**
 * Root Layout Component
 *
 * This is the main layout component for the Deedyte application.
 * It handles:
 * - Global styles and metadata
 * - External script and stylesheet loading
 *
 * Cookie writes for login/signup live in `app/actions/auth-cookies.js` (server
 * actions cannot be exported from this file — Next.js only allows specific
 * layout exports here).
 *
 * @module app/layout
 */

import App from "./App";
import "./globals.css";
import StructuredData from "./StructuredData";

export async function generateMetadata() {
  const imageUrl = "https://www.deedyte.com/api/logo";

  return {
    title: "DeeDyte Nigeria | Trusted Online Marketplace For Anyone",
    description: "Enjoy Free Commerce From The Comfort Of Your Home.",
    alternates: { canonical: "https://www.deedyte.com" },
    robots: { index: true, follow: true },
    openGraph: {
      title: "DeeDyte Nigeria | Trusted Online Marketplace Anyone",
      description: "Enjoy Free Commerce From The Comfort Of Your Home.",
      url: "https://www.deedyte.com",
      type: "website",
      images: [{ url: imageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "DeeDyte Nigeria | Trusted Online Marketplace Anyone",
      description: "Enjoy Free Commerce From The Comfort Of Your Home.",
      images: [imageUrl],
    },
  };
}

const productSchema = await fetch("https://www.deedyte.com/api/json-ld", {
  next: { revalidate: 3600 },
})
  .then(res => res.ok ? res.json() : null)
  .then(data => data?.success ? data.data : null)
  .catch(() => null);


const CATEGORY_NAMES = [
  "apparel & accessories",
  "beauty",
  "jewelry & watches & eyewear",
  "shoes & accessories",
  "home appliances",
  "lights & lighting",
  "kitchenware & cookware",
  "storage & organizations",
  "electronics",
  "toiletries",
];

function categoryPath(name) {
  return `/store/${encodeURIComponent(name.replaceAll(" ", ""))}`;
}

export default async function RootLayout({ children }) {
  const categories = CATEGORY_NAMES.map((title) => ({
    title,
    uri: categoryPath(title),
  }));

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "DeeDyte",
    url: "https://www.deedyte.com/",
    logo: "https://res.cloudinary.com/jh7nqlrd/image/upload/v1791187434/WhatsApp_Image_2026-09-22_at_22.45.49.jpg",
    description: "Sign up, sign in, and rely on us to handle your purchase.",
    hasPart: [
      {
        "@type": "SiteNavigationElement",
        name: "Sign Up",
        url: "https://www.deedyte.com/auth/signup",
      },
      {
        "@type": "SiteNavigationElement",
        name: "Sign In",
        url: "https://www.deedyte.com/auth/login",
      },
      {
        "@type": "SiteNavigationElement",
        name: "Sell Your Products",
        url: "https://www.deedyte.com/entrepreneur/ng",
      },
      {
        "@type": "SiteNavigationElement",
        name: "Place Your Order",
        url: "https://www.deedyte.com/vendors",
      },
      ...categories.map((cat) => ({
        "@type": "SiteNavigationElement",
        name: cat.title,
        url: `https://www.deedyte.com${cat.uri}`,
      })),
    ],
  };

  return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="theme-color" content="#fff" />

          <link
            rel="stylesheet"
            href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css"
            integrity="sha384-rbsA2VBKQhggwzxH7pPCaAqO46MgnOM80zW1RWuH61DGLwZJEdK2Kadq2F9CUG65"
            crossOrigin="anonymous"
          />

          <link
            rel="stylesheet"
            href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"
          />

          <script
            async
            src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js"
            integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM"
            crossOrigin="anonymous"
          />

          <script async src="https://js.pusher.com/7.2/pusher.min.js" />
          <StructuredData data={websiteSchema} />
          {productSchema && <StructuredData data={productSchema} />}
        </head>

        <body style={{ overflow: "auto", background: "#fff" }}>
          <App>{children}</App>
        </body>
      </html>
    );
  }
