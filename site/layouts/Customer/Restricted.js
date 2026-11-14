/**
 * Customer Restricted Layout Component
 *
 * Layout for authenticated customer pages.
 * Uses a slim top bar for buyer index routes (`/`, `/store/*`, `/vendors`, etc.).
 *
 * @module layouts/Customer/Restricted
 */

"use client";

// ============================================================================
// IMPORTS
// ============================================================================

import React, { useEffect, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import { usePathname } from "next/navigation";

// Components
// import Header from "../../components/customer/header/Header";
import Aside from "../../components/customers/Aside";
import CustomerShellHeader from "../../components/customers/CustomerShellHeader";
import CustomerAuthModal from "../../components/customers/CustomerAuthModal";
import ProfileFloater from "../../components/floaters.js/Profile";
import NotificationFloater from "../../components/floaters.js/Notification";
import SearchFloater from "../../components/floaters.js/Search";

// Utilities
import { handleFloater, closeSidebar, closeAllFloaters } from "../../reusables/anitmation";
import { useVerifyAuth, requiresAuth } from "../../reusables/verifyAuth";
import SiteFooter from "../../components/SiteFooter";

const ASIDE_MIN_WIDTH = 1200;
const RESIZE_DEBOUNCE_DELAY = 150;

/** `/store/*` segments that use shell chrome — not vendor storefront slugs. */
const STORE_APP_SEGMENTS = new Set([
  "cart",
  "checkouts",
  "orders",
  "disputes",
  "inbox",
]);

/**
 * Aside on buyer hub: `/store/inbox`, `.../orders`, `.../disputes`
 * (hidden on order/dispute detail pages).
 */
function shouldShowCustomerCheckoutAside(pathname) {
  const path = (pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2) return false;
  if (segments[0] !== "store") return false;
  if (!["inbox", "orders", "disputes"].includes(segments[1])) return false;
  if (segments[1] === "orders" && segments.length >= 3) return false;
  if (segments[1] === "disputes" && segments.length >= 3) return false;
  return true;
}

/**
 * Buyer shell header on index customer routes, except vendor storefront
 * `/store/:shopSlug` and PDP `/:id`.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
function shouldShowCustomerShellHeader(pathname) {
  const raw = (pathname || "").split("?")[0] || "/";
  const path = raw.replace(/\/+$/, "") || "/";
  const segments = path.split("/").filter(Boolean);

  // Hide on vendor storefront + product detail pages
  if (
    segments[0] === "store" &&
    segments.length >= 2 &&
    !STORE_APP_SEGMENTS.has(segments[1])
  ) {
    return true;
  }

  return false;
}

/**
 * Full-bleed `/public/customer.mp4` background for the buyer app at the index routes.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
function shouldShowCustomerBgVideo(pathname) {
  const path = (pathname || "").split("?")[0] || "/";
  const norm = path.replace(/\/+$/, "") || "/";
  // Product feed home stays opaque white — video was fighting the grid/footer stack.
  if (norm === "/") return false;
  // Vendors uses the solid shopping chrome (buyer header + grey feed), not the video shell.
  if (norm === "/vendors" || norm.startsWith("/vendors/")) return false;
  if (norm === "/user-profile" || norm.startsWith("/user-profile/")) return true;
  if (norm === "/store" || norm.startsWith("/store/")) return true;
  return false;
}

function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// ============================================================================
// CUSTOMER RESTRICTED LAYOUT COMPONENT
// ============================================================================

/**
 * Restricted layout for authenticated customer pages
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 * @returns {JSX.Element} The restricted customer layout
 */
export default function CustomerRestrictedLayout({ children }) {
  const pathname = usePathname();
  const [activeFloater, setActiveFloater] = useState(null);
  const [screenWidth, setScreenWidth] = useState(0);

  const { isLoading, isAuthenticated, recheck } = useVerifyAuth("customer", {
    redirectOnFail: false,
  });
  const [authModalOpen, setAuthModalOpen] = useState(true);
  const { floater_src } = useSelector((state) => state.floater_src);
  const showAside = shouldShowCustomerCheckoutAside(pathname);
  const showDesktopAside = showAside && screenWidth >= ASIDE_MIN_WIDTH;
  const showShellHeader = shouldShowCustomerShellHeader(pathname);
  const showBgVideo = shouldShowCustomerBgVideo(pathname);

  // Update active floater based on Redux state
  useEffect(() => {
    switch (floater_src) {
      case "profile":
        setActiveFloater(<ProfileFloater />);
        break;
      case "notification":
        setActiveFloater(<NotificationFloater />);
        break;
      default:
        setActiveFloater(null);
    }
  }, [floater_src]);

  // Close floaters on route change
  useEffect(() => {
    closeAllFloaters();
    closeSidebar();
    setAuthModalOpen(true);
  }, [pathname]);

  /**
   * Handles floater overlay click to close floater
   */
  const handleFloaterClick = useCallback(
    (e) => {
      if (e.target === e.currentTarget) {
        handleFloater(floater_src);
      }
    },
    [floater_src]
  );

  /**
   * Handles keyboard events for accessibility
   */
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      closeAllFloaters();
      closeSidebar();
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleResize = useCallback(() => {
    setScreenWidth(window.innerWidth);
  }, []);

  const debouncedResize = useCallback(
    debounce(handleResize, RESIZE_DEBOUNCE_DELAY),
    [handleResize]
  );

  useEffect(() => {
    handleResize();
    window.addEventListener("resize", debouncedResize);
    return () => {
      window.removeEventListener("resize", debouncedResize);
    };
  }, [debouncedResize, handleResize]);

  // ============================================================================
  // RENDER
  // ============================================================================

  const pathParts = pathname.split("/").filter(Boolean);
  const isUserProfilePage = pathParts[0] === "customer" && pathParts[1] === "user-profile";

  if (isUserProfilePage) {
    return (
      <>
        {children}
        <SiteFooter />
      </>
    );
  }

  const needsAuthModal =
    !isLoading && !isAuthenticated && requiresAuth(pathname) && authModalOpen;

  return (
    <div
      className={`customer-layout customer-restricted-layout${showBgVideo ? "" : " customer-restricted-layout--no-bg-video"}`}
    >
      {showBgVideo ? (
        <video
          className="customer-restricted-layout__bg-video"
          src="/customer.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
        />
      ) : null}
      {showShellHeader ? <CustomerShellHeader /> : null}

      <div className="customer-main" style={{background: "transparent"}}>
        {showDesktopAside ? (
          <div className="customer-aside">
            <Aside />
          </div>
        ) : null}
        <div style={{background: "transparent"}} className={`customer-content${showDesktopAside ? " customer-content--with-aside" : ""}`}>
          <div style={{background: "transparent"}} className="customer-content__body">{children}</div>
        </div>
      </div>
      <SiteFooter />
      {needsAuthModal ? (
        <CustomerAuthModal
          onAuthenticated={() => {
            setAuthModalOpen(false);
            recheck();
          }}
          onClose={() => setAuthModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
