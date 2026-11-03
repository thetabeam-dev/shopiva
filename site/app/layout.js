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
import { ORGANIZATION_LOGO } from "../lib/siteNavigation";
import { buildSearchAppearanceSchema } from "../lib/organizationSchema";

export async function generateMetadata() {
  const imageUrl = ORGANIZATION_LOGO;
  const title =
    "DeeDyte Nigeria | Online Shopping for Fashion, Electronics & Local Delivery";
  const description =
    "DeeDyte Nigeria is an on-demand marketplace for fashion, electronics, home, and more. Shop nearby vendors with secure checkout and delivery to your location.";

  return {
    metadataBase: new URL("https://www.deedyte.com"),
    applicationName: "DeeDyte Nigeria",
    title,
    description,
    robots: { index: true, follow: true },
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: imageUrl, type: "image/jpeg", sizes: "512x512" },
      ],
      apple: [{ url: imageUrl, type: "image/jpeg" }],
    },
    openGraph: {
      title,
      description,
      url: "https://www.deedyte.com",
      siteName: "DeeDyte Nigeria",
      locale: "en_NG",
      type: "website",
      images: [{ url: imageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function RootLayout({ children }) {
  const searchAppearanceSchema = await buildSearchAppearanceSchema();

  return (
    <html lang="en">
      <head>
        <title>
          DeeDyte Nigeria | Online Shopping for Fashion, Electronics & Local
          Delivery
        </title>
        <meta
          name="description"
          content="DeeDyte Nigeria is an on-demand marketplace for fashion, electronics, home, and more. Shop nearby vendors with secure checkout and delivery to your location."
        />
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
        <StructuredData data={searchAppearanceSchema} />
      </head>

      <body style={{ overflow: "auto", background: "#fff" }}>
        <App>{children}</App>
      </body>
    </html>
  );
}
