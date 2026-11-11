/**
 * Entrepreneur Restricted Layout Component
 * 
 * Layout for authenticated entrepreneur dashboard pages.
 * Includes header, sidebar, floater components, and authentication verification.
 * 
 * @module layouts/Entrepreneur/Restricted
 */

"use client";

// ============================================================================
// IMPORTS
// ============================================================================

import React, { useEffect, useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { usePathname } from "next/navigation";

// Components
import Aside from "../../components/entrepreneur/aside/Aside";
import Nav from "../../components/entrepreneur/aside/Nav";
import Header from "../../components/entrepreneur/header/Header";
import ProfileFloater from "../../components/floaters.js/Profile";
import NotificationFloater from "../../components/floaters.js/Notification";
import SearchFloater from "../../components/floaters.js/Search";

// Utilities
import { handleFloater, closeSidebar, closeAllFloaters } from "../../reusables/anitmation";
import { useVerifyAuth, requiresAuth } from "../../reusables/verifyAuth";
import {
  set_entrepreneur_has_shop,
  set_entrepreneur_shop_details,
} from "../../redux/entrepreneur/entrepreneur_shop";
import { pickDefaultShopFromList } from "../../lib/entrepreneurDefaultShop";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Aside (full sidebar) is mounted only at this width and above */
const ASIDE_MIN_WIDTH = 1200;

/** Bottom <Nav /> only at this width and below */
const MOBILE_NAV_MAX_WIDTH = 480;

/**
 * Top-level segments under /entrepreneur where mobile Nav may show.
 * Nav appears only when there is no further path (see shouldShowMobileBottomNav).
 * `product` matches app folder naming; `products` included for parity with nav label.
 * `transaction` → /entrepreneur/transaction (transactions page).
 */
const MOBILE_NAV_ENTREPRENEUR_SEGMENTS = new Set([
  "overview",
  "orders",
  "products",
  "product",
  "inventory",
  "transaction",
  "disputes",
]);

/**
 * True only for `/entrepreneur` (overview) or exactly `/entrepreneur/{segment}` with an allowed segment.
 * Any deeper path (e.g. /entrepreneur/product/create-product) → false.
 *
 * @param {string} pathname
 * @returns {boolean}
 */
function shouldShowMobileBottomNav(pathname) {
  const path = (pathname || "").split("?")[0].replace(/\/+$/, "") || "/";
  if (!path.startsWith("/entrepreneur")) return false;
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "entrepreneur") return false;
  if (parts.length === 1) return true;
  if (parts.length !== 2) return false;
  return MOBILE_NAV_ENTREPRENEUR_SEGMENTS.has(parts[1]);
}

/** Debounce delay for resize events (ms) */
const RESIZE_DEBOUNCE_DELAY = 150;

/**
 * Creates a debounced function
 * 
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ============================================================================
// ENTREPRENEUR RESTRICTED LAYOUT COMPONENT
// ============================================================================

/**
 * Restricted layout for authenticated entrepreneur pages
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 * @returns {JSX.Element} The restricted entrepreneur layout
 */
export default function EntrepreneurRestrictedLayout({ children }) {
  // ============================================================================
  // HOOKS & STATE
  // ============================================================================
  
  const pathname = usePathname();
  const dispatch = useDispatch();
  const [screenWidth, setScreenWidth] = useState(0);
  const [activeFloater, setActiveFloater] = useState(null);

  const { isLoading, isAuthenticated } = useVerifyAuth("entrepreneur");
  const { floater_src } = useSelector((state) => state.floater_src);
  const { entrepreneur_id } = useSelector((state) => state.entrepreneur_id);
  const shopDetails = useSelector((state) => state.entrepreneur_shop.shop);

  /** After hard refresh, Redux is empty — hydrate shop using last-used id from localStorage when possible */
  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    if (shopDetails != null) return;
    let cancelled = false;
    (async () => {
      try {
        const sres = await fetch("/api/shop/my-shops", { credentials: "include" });
        const sjson = await sres.json().catch(() => ({}));
        const shops = Array.isArray(sjson?.shops) ? sjson.shops : [];
        if (cancelled) return;
        if (shops.length > 0) {
          const shop = pickDefaultShopFromList(shops);
          dispatch(set_entrepreneur_has_shop(true));
          dispatch(set_entrepreneur_shop_details(shop));
          return;
        }
        const dres = await fetch("/api/shop/details", { credentials: "include" });
        const d = await dres.json().catch(() => ({}));
        if (cancelled) return;
        if (d.shop) {
          dispatch(set_entrepreneur_has_shop(true));
          dispatch(set_entrepreneur_shop_details(d.shop));
        } else {
          dispatch(set_entrepreneur_has_shop(false));
          dispatch(set_entrepreneur_shop_details(null));
        }
      } catch {
        if (!cancelled) {
          dispatch(set_entrepreneur_has_shop(false));
          dispatch(set_entrepreneur_shop_details(null));
        }
      }
    })();
    return () => { cancelled = true };
  }, [isAuthenticated, isLoading, shopDetails, dispatch]);

  // ============================================================================
  // CALLBACKS
  // ============================================================================

  /**
   * Handles window resize events
   */
  const handleResize = useCallback(() => {
    const newWidth = window.innerWidth;
    setScreenWidth(newWidth);
    
    if (newWidth >= ASIDE_MIN_WIDTH) {
      closeSidebar();
    }
  }, []);

  /**
   * Debounced resize handler
   */
  const debouncedResize = useCallback(
    debounce(handleResize, RESIZE_DEBOUNCE_DELAY),
    [handleResize]
  );

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  // Set initial screen width and add resize listener
  useEffect(() => {
    // Set initial width
    setScreenWidth(window.innerWidth);

    // Add resize listener
    window.addEventListener("resize", debouncedResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", debouncedResize);
    };
  }, [debouncedResize]);

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
  }, [pathname]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  /**
   * Handles floater overlay click to close floater
   */
  const handleFloaterClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      handleFloater(floater_src);
    }
  }, [floater_src]);

  /**
   * Handles keyboard events for accessibility
   */
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      closeAllFloaters();
      closeSidebar();
    }
  }, []);

  // Add keyboard listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // ============================================================================
  // RENDER
  // ============================================================================
  
  // Check for pages that should render without dashboard chrome
  const pathParts = pathname.split("/").filter(Boolean);
  const isUserProfilePage = pathParts[1] === "user-profile";
  const isShopDetailPage = pathParts[1] === "shop" && pathParts.length > 2;

  if (isUserProfilePage || isShopDetailPage) {
    return <>{children}</>;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div 
        className="entrepreneur-layout"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: "#f7f7f7",
        }}
      >
        <div className="site-process-loader" role="status" aria-label="Loading">
          <span
            className="site-process-loader__spinner"
            style={{ borderColor: "#ededed", borderTopColor: "#00926e" }}
          />
        </div>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!isAuthenticated && requiresAuth(pathname)) {
    return null;
  }

  return (
    <div className="entrepreneur-layout">
      {/* Header Section */}
      <div className="entrepreneur-header">
        {/* Search Floater */}
        <section
          className="entrepreneur-floater-cnt-xtra"
          onClick={handleFloaterClick}
          role="dialog"
          aria-modal="true"
          aria-label="Search"
        >
          <SearchFloater />
        </section>
        
        <Header />
      </div>

      {/* Profile/Notification Floater */}
      <section
        className="entrepreneur-floater-cnt"
        onClick={handleFloaterClick}
        role="dialog"
        aria-modal="true"
        aria-label="Profile menu"
      >
        {activeFloater}
      </section>

      {/* Main Content Area */}
      <div className="entrepreneur-main">
        {screenWidth >= ASIDE_MIN_WIDTH ? (
          <div className="entrepreneur-aside">
            <Aside />
          </div>
        ) : null}

        {/* Main Content */}
        <div className="entrepreneur-content">
          {children}
        </div>
      </div>

      {screenWidth > 0 &&
        screenWidth <= MOBILE_NAV_MAX_WIDTH &&
        shouldShowMobileBottomNav(pathname) && <Nav />}
    </div>
  );
}
