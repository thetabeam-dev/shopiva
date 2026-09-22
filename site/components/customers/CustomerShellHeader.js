"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./assets/shell-header.css";

function pathWithoutQueryAndTrailingSlash(path) {
  const base = (path || "").split("?")[0];
  return base.replace(/\/+$/, "") || "/";
}

function CartIcon() {
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
        d="M2 3L2.26491 3.0883C3.58495 3.52832 4.24497 3.74832 4.62248 4.2721C5 4.79587 5 5.49159 5 6.88304V9.5C5 12.3284 5 13.7426 5.87868 14.6213C6.75736 15.5 8.17157 15.5 11 15.5H13M19 15.5H17"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7.5 18C8.32843 18 9 18.6716 9 19.5C9 20.3284 8.32843 21 7.5 21C6.67157 21 6 20.3284 6 19.5C6 18.6716 6.67157 18 7.5 18Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M16.5 18.0001C17.3284 18.0001 18 18.6716 18 19.5001C18 20.3285 17.3284 21.0001 16.5 21.0001C15.6716 21.0001 15 20.3285 15 19.5001C15 18.6716 15.6716 18.0001 16.5 18.0001Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5 6H8M5.5 13H16.0218C16.9812 13 17.4609 13 17.8366 12.7523C18.2123 12.5045 18.4013 12.0636 18.7792 11.1818L19.2078 10.1818C20.0173 8.29294 20.4221 7.34853 19.9775 6.67426C19.5328 6 18.5054 6 16.4504 6H12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
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
 * Shared top bar for buyer-facing `/customer` routes (hidden on vendor storefront
 * `/customer/store/:slug` — see `shouldShowCustomerShellHeader` in Restricted layout).
 */
export default function CustomerShellHeader() {
  const pathname = pathWithoutQueryAndTrailingSlash(usePathname());
  const isCustomerHome = pathname === "/customer";

  return (
    <div
      className={`customer-shell-header${isCustomerHome ? " customer-shell-header--home" : ""}`}
      role="banner"
      aria-label="Deedyte"
    >
      <Link href="/customer" className="customer-shell-header__logo">
        Deedyte
      </Link>
      <div className="customer-shell-header__tools">
        <Link href="/customer/store/cart" className="customer-shell-header__icon" aria-label="Cart">
          <CartIcon />
        </Link>
        <Link
          href="/customer/user-profile"
          className="customer-shell-header__icon"
          aria-label="Account"
        >
          <ProfileIcon />
        </Link>
      </div>
    </div>
  );
}
