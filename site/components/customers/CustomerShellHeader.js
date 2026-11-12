"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./assets/shell-header.css";

function pathWithoutQueryAndTrailingSlash(path) {
  const base = (path || "").split("?")[0];
  return base.replace(/\/+$/, "") || "/";
}


function ProfileIcon() {
  return (
    <svg
      className="customer-shell-header__svg"
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        opacity="0.4"
        d="M12.1207 12.78C12.0507 12.77 11.9607 12.77 11.8807 12.78C10.1207 12.72 8.7207 11.28 8.7207 9.50998C8.7207 7.69998 10.1807 6.22998 12.0007 6.22998C13.8107 6.22998 15.2807 7.69998 15.2807 9.50998C15.2707 11.28 13.8807 12.72 12.1207 12.78Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        opacity="0.34"
        d="M18.7398 19.3801C16.9598 21.0101 14.5998 22.0001 11.9998 22.0001C9.39977 22.0001 7.03977 21.0101 5.25977 19.3801C5.35977 18.4401 5.95977 17.5201 7.02977 16.8001C9.76977 14.9801 14.2498 14.9801 16.9698 16.8001C18.0398 17.5201 18.6398 18.4401 18.7398 19.3801Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Shared top bar for buyer-facing `/` routes (hidden on vendor storefront
 * `/store/:slug` — see `shouldShowCustomerShellHeader` in Restricted layout).
 */
export default function CustomerShellHeader() {
  const pathname = pathWithoutQueryAndTrailingSlash(usePathname());
  const isCustomerHome = pathname === "/";

  return (
    <div
      className={`customer-shell-header${isCustomerHome ? " customer-shell-header--home" : ""}`}
      role="banner"
      aria-label="Deedyte"
    >
      <Link href="/" className="customer-shell-header__logo">
        Deedyte
      </Link>
      <div className="customer-shell-header__tools">
        <Link
          href="/user-profile"
          className="customer-shell-header__icon"
          aria-label="Account"
        >
          <ProfileIcon />
        </Link>
      </div>
    </div>
  );
}
