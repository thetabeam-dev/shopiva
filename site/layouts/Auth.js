/**
 * Auth Layout Component
 *
 * Wrapper layout for authentication pages (login, signup, password recovery).
 * Provides a clean, minimal layout for auth-related pages.
 *
 * @module layouts/Auth
 */

"use client";

// ============================================================================
// IMPORTS
// ============================================================================

import { usePathname } from "next/navigation";
import React from "react";
import { useVerifyAuth } from "../reusables/verifyAuth";
import SiteFooter from "../components/SiteFooter";

// ============================================================================
// AUTH LAYOUT COMPONENT
// ============================================================================

/**
 * JWT + shop check for create-shop route (uses AuthLayout, not Restricted).
 */
function EntrepreneurShopVerify({ children }) {
  const { isLoading, isAuthenticated } = useVerifyAuth("entrepreneur");

  if (isLoading) {
    return (
      <div
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
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}

/**
 * Authentication layout wrapper
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 * @returns {JSX.Element} The auth layout wrapper
 */
export default function AuthLayout({ children }) {
  const pathname = usePathname();

  if (pathname === "/entrepreneur/shop") {
    return <EntrepreneurShopVerify>{children}</EntrepreneurShopVerify>;
  }

  if (pathname.startsWith("/entrepreneur")) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
