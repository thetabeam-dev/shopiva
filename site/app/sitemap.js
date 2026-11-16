import {
  LEGAL_AND_DOC_LINKS,
  SITE_ORIGIN,
} from "../lib/siteNavigation";
import { listCategoriesWithProducts } from "../lib/storefrontCategories";

const STATIC_PATHS = [
  "/",
  ...LEGAL_AND_DOC_LINKS.map((link) => link.path),
];

function entry(path, lastModified = new Date(), priority = 0.6) {
  return {
    url: path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`,
    lastModified,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority,
  };
}

export default async function sitemap() {
  const pages = STATIC_PATHS.map((path) =>
    entry(path, new Date(), path === "/" ? 1 : path === "/blogs" ? 0.85 : 0.8),
  );

  try {
    const categories = await listCategoriesWithProducts();
    return [
      ...pages,
      ...categories.map((category) => entry(category.path, new Date(), 0.8)),
    ];
  } catch (error) {
    console.error("Sitemap storefront lookup failed:", error);
    return pages;
  }
}
