"use client";

import { useEffect } from "react";

const APP_STORE_URL = "https://apps.apple.com/app/id6792328397";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.thetabeam.shopiva";

const INFO_PAGES = [
  "about",
  "legal",
  "privacy-policy",
  "terms-of-use",
  "contact",
  "sitemap",
  "pricing",
];

/**
 * Web is only open on the customer and vendor landing pages and on site info
 * pages (legal, privacy, about, ...). Everything else is app-only.
 * @param {string} pathname
 */
export function isWebAllowedPath(pathname) {
  const segments = String(pathname || "").split("?")[0].split("/").filter(Boolean);
  if (segments.length === 0) return true;

  const [first, second, third] = segments;
  if (INFO_PAGES.includes(first)) return true;
  if (first === "account" && second === "delete") return true;

  const isLocale = (value) => typeof value === "string" && /^[a-z]{2}$/i.test(value);

  if (isLocale(first)) {
    return segments.length === 1 || (segments.length === 2 && INFO_PAGES.includes(second));
  }

  if ((first === "entrepreneur" || first === "customer") && isLocale(second)) {
    return segments.length === 2 || (segments.length === 3 && INFO_PAGES.includes(third));
  }

  return false;
}

export default function DownloadAppGate() {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-app-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 16,
          padding: "32px 24px",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.25)",
        }}
      >
        <h2 id="download-app-title" style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 12 }}>
          Continue on the DeeDyte app
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.5, color: "#555", marginBottom: 24 }}>
          Shopping, selling and managing orders are only available on the DeeDyte mobile app.
          Download it from the App Store or Play Store to continue.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={buttonStyle}
          >
            <img src="/svgs/app_store.svg" alt="" style={{ height: 32, width: 32 }} />
            <b>App Store</b>
          </a>
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={buttonStyle}
          >
            <img src="/svgs/play_store.svg" alt="" style={{ height: 32, width: 32 }} />
            <b>Play Store</b>
          </a>
          <a href="/" style={{ marginTop: 8, color: "#00926E", fontWeight: 600, textDecoration: "none" }}>
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}

const buttonStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  height: 52,
  borderRadius: 10,
  border: "1px solid #00926E",
  color: "#00926E",
  background: "#fff",
  textDecoration: "none",
  fontSize: 16,
};
