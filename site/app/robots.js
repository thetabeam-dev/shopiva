const SITE = "https://www.deedyte.com";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/account/",
        "/user-profile",
        "/entrepreneur/",
        "/store/cart",
        "/store/checkouts",
        "/store/orders",
        "/store/inbox",
        "/store/disputes",
      ],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
