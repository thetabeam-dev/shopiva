export const SITE_ORIGIN = "https://www.deedyte.com";

/** Legal and informational pages Google should treat as site sections, not products. */
export const LEGAL_AND_DOC_LINKS = [
  { title: "Legal", path: "/legal" },
  { title: "Contact Us", path: "/contact" },
  { title: "About", path: "/about" },
  { title: "Privacy Policy", path: "/privacy-policy" },
  { title: "Terms of Use", path: "/terms-of-use" },
];

/** Pages we want as Google sitelinks: categories plus a compact legal group. */
export function sitelinkSections(categories = []) {
  return [
    ...categories,
    { title: "Legal", path: "/legal" },
    { title: "Contact Us", path: "/contact" },
    { title: "About", path: "/about" },
  ];
}

export const APP_STORE_URL = "https://apps.apple.com/app/id6792328397";
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.thetabeam.shopiva";

export const SOCIAL_PROFILE_URLS = [
  "https://www.facebook.com/profile.php?id=61566898641430",
  "https://x.com/Deedyte_shop",
  "https://www.youtube.com/@deedyte",
  "https://whatsapp.com/channel/0029VacobY6LY6d7M19cx90O",
  APP_STORE_URL,
  PLAY_STORE_URL,
];

export const ORGANIZATION_LOGO =
  "https://www.deedyte.com/api/logo";

export function absoluteUrl(path) {
  if (!path || path === "/") return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}
