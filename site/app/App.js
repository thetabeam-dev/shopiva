"use client";

/**
 * App Component
 * 
 * Main application wrapper that handles:
 * - User role detection (customer vs entrepreneur)
 * - Layout selection based on route
 * - Redux and session provider setup
 * 
 * @module app/App
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { usePathname } from "next/navigation";
import React from "react";
import { Provider } from "react-redux";
import { SessionProvider } from "next-auth/react";
import store from "../redux/store";
import AuthLayout from "../layouts/Auth";

// Entrepreneur Layout Imports
import EntrepreneurRestrictedLayout from "../layouts/Entrepreneur/Restricted";
import EntrepreneurFreeLayout from "../layouts/Entrepreneur/Free";

// Customer Layout Imports
import CustomerRestrictedLayout from "../layouts/Customer/Restricted";
import CustomerFreeLayout from "../layouts/Customer/Free";

// ============================================================================
// CONSTANTS
// ============================================================================

/** User role identifiers */
const USER_ROLES = {
  CUSTOMER: 0,
  ENTREPRENEUR: 1,
};

/** Auth page identifiers (also used for /auth/* unified auth) */
const AUTH_PAGES = ["signup", "login", "wait-list", "shop", "password-recovery"];

/** Shared legal / company info pages (global; not role-scoped) */
const PUBLIC_INFO_PATHS = [
  "/privacy-policy",
  "/terms-of-use",
  "/about",
  "/legal",
  "/contact",
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Customer vs entrepreneur shell: any segment `entrepreneur` → vendor app;
 * any segment `customer` → customer app. Entrepreneur wins if both appear.
 *
 * @param {string} pathname
 * @returns {number | null} USER_ROLES value or null
 */
function roleFromPathSegments(pathname) {
  const segments = pathname.toLowerCase().split("/").filter(Boolean);
  if (segments.includes("entrepreneur")) return USER_ROLES.ENTREPRENEUR;
  if (segments.includes("customer")) return USER_ROLES.CUSTOMER;
  return null;
}

/**
 * Global informational/legal pages shared by entrepreneurs and customers.
 * @param {string} pathname
 * @returns {boolean}
 */
function isPublicInfoPage(pathname) {
  const path = (pathname || "").split("?")[0];
  return PUBLIC_INFO_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Checks if the current path is an authentication page
 * @param {string} pathname - Current route pathname
 * @returns {boolean} True if on auth page
 */
const isAuthPage = (pathname) => {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return false;
  if (parts[0] === "auth") {
    return AUTH_PAGES.includes(parts[1]);
  }
  // /entrepreneur/shop uses AuthLayout (create-shop); /entrepreneur/shop/[id] needs Restricted + verifyAuth
  if (parts[0] === "entrepreneur") {
    if (parts[1] === "shop" && parts.length > 2) return false;
    return AUTH_PAGES.includes(parts[1]);
  }
  return false;
};

/**
 * Checks if the current path requires a free (public) layout
 * @param {string} pathname - Current route pathname
 * @returns {boolean} True if free layout should be used
 */
const isFreeLayout = (pathname) => {
  const pathParts = pathname.split("/");
  return pathParts.length > 2 && pathParts.splice(0, 3)[2]?.length === 2;
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

/**
 * Main App component that wraps the entire application
 * 
 * @param {Object} props - Component props
 * @param {Object} props.session - NextAuth session object
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} The wrapped application
 */
export default function App({ session, children }) {
  const pathname = usePathname();

  // One authoritative shell for shared legal/company pages
  if (isPublicInfoPage(pathname)) {
    return (
      <SessionProvider session={session}>
        <Provider store={store}>
          <EntrepreneurFreeLayout>{children}</EntrepreneurFreeLayout>
        </Provider>
      </SessionProvider>
    );
  }

  const role = roleFromPathSegments(pathname) ?? USER_ROLES.CUSTOMER;

  return (
    <SessionProvider session={session}>
      <Provider store={store}>
        {role === USER_ROLES.CUSTOMER ? (
          <Customer>{children}</Customer>
          // <></>
        ) : (
          <Entrepreneur>{children}</Entrepreneur>
        )}
      </Provider>
    </SessionProvider>
  );
}

// ============================================================================
// ENTREPRENEUR LAYOUT WRAPPER
// ============================================================================

/**
 * Entrepreneur layout wrapper component
 * Determines which layout to use based on current route
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} Appropriate entrepreneur layout
 */
function Entrepreneur({ children }) {
  const pathname = usePathname();
  const pathParts = pathname.split("/");
  const isShopDetailPage = pathParts[0] === "entrepreneur" && pathParts[1] === "shop" && pathParts.length > 2;

  // Shop detail/editor route renders full-width page without dashboard chrome.
  if (isShopDetailPage) {
    return <>{children}</>;
  }

  // Auth pages use AuthLayout
  if (isAuthPage(pathname)) {
    return <AuthLayout>{children}</AuthLayout>;
  }

  // Determine if restricted or free layout
  if (pathname.split("/").length > 2) {
    if (isFreeLayout(pathname)) {
      return <EntrepreneurFreeLayout>{children}</EntrepreneurFreeLayout>;
    }
    return <EntrepreneurRestrictedLayout>{children}</EntrepreneurRestrictedLayout>;
  }

  // Default to restricted layout
  return <EntrepreneurRestrictedLayout>{children}</EntrepreneurRestrictedLayout>;
}

// ============================================================================
// CUSTOMER LAYOUT WRAPPER
// ============================================================================

/**
 * Customer layout wrapper component
 * Determines which layout to use based on current route
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 * @returns {JSX.Element} Appropriate customer layout
 */
function Customer({ children }) {
  const pathname = usePathname();

  // Auth pages use AuthLayout
  if (isAuthPage(pathname)) {
    return <AuthLayout>{children}</AuthLayout>;
  }

  // Determine if restricted or free layout
  if (pathname.split("/").length > 2) {
    if (isFreeLayout(pathname)) {
      return <CustomerFreeLayout>{children}</CustomerFreeLayout>;
    }
    return <CustomerRestrictedLayout>{children}</CustomerRestrictedLayout>;
  }

  // Default to restricted layout
  return <CustomerRestrictedLayout>{children}</CustomerRestrictedLayout>;
}
