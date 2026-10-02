/**
 * Unified auth verification for restricted layouts.
 * Verifies JWT with the same API for both entrepreneur and customer;
 * redirects to /auth/login?role=... if token is missing or invalid.
 *
 * @module reusables/verifyAuth
 */

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { set_entrepreneur_id_to } from "../redux/entrepreneur/entrepreneur_id";
import { set_entrepreneur_data_to } from "../redux/entrepreneur/entrepreneur_data";

/** Create-shop route (no dashboard shop yet) */
export const ENTREPRENEUR_SHOP_CREATE_PATH = "/entrepreneur/shop";

/** Pages that do not require authentication (last path segment) */
export const PUBLIC_PAGES = ["login", "signup", "password-recovery"];

/**
 * Same-origin auth API so cookies are always sent with credentials.
 * Avoid relying on NEXT_PUBLIC_API_URL (often wrong or unset in dev).
 */
const AUTH_ENDPOINT = "/api/user/authorization";

export function getCookie(name) {
  if (typeof document === "undefined") return null;
  const cookieName = `${name}=`;
  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.indexOf(cookieName) === 0) {
      return cookie.substring(cookieName.length, cookie.length);
    }
  }
  return null;
}

/**
 * Whether the current path requires authentication.
 * @param {string} pathname - e.g. /entrepreneur/shop
 */
export function requiresAuth(pathname) {
  if (!pathname || typeof pathname !== "string") return false;
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  // Require auth only for entrepreneur routes
  if (!path.startsWith("/entrepreneur")) return false;

  const pathParts = path.split("/").filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  // Still allow public pages under entrepreneur (e.g. /entrepreneur/auth/login)
  return !PUBLIC_PAGES.includes(lastPart);
}

/**
 * Cookie name for the given role.
 * @param {"entrepreneur"|"customer"} role
 */
function cookieNameForRole(role) {
  return role === "entrepreneur" ? "entrepreneur_secret" : "customer_secret";
}

/**
 * Unified auth verification hook.
 * Verifies token with /api/user/authorization; redirects to /auth/login?role=... if invalid.
 *
 * @param {"entrepreneur"|"customer"} role
 * @returns {{ isLoading: boolean, isAuthenticated: boolean }}
 */
export function useVerifyAuth(role) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const authInProgress = useRef(false);

  useEffect(() => {
    if (!requiresAuth(pathname)) {
      setIsLoading(false);
      setIsAuthenticated(true);
      return;
    }

    if (authInProgress.current) return;

    const tokenFromDocument = getCookie(cookieNameForRole(role));
    // HttpOnly cookies are invisible to JS — still verify via API with credentials

    authInProgress.current = true;

    const headers = { "Content-Type": "application/json" };
    if (tokenFromDocument) {
      headers.Authorization = `Bearer ${tokenFromDocument}`;
    }

    fetch(AUTH_ENDPOINT, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ role }),
    })
      .then(async (result) => {
        const response = await result.json();
        if (result.ok && response.bool) {
          const userId = response.id ?? response.data?.id;
          if (userId != null) {
            dispatch(set_entrepreneur_id_to(userId));
          }
          if (response.data && typeof response.data === "object") {
            dispatch(set_entrepreneur_data_to(response.data));
          }
          setIsAuthenticated(true);
        } else {
          router.push(`/auth/login?role=${role}`);
        }
      })
      .catch(() => {
        router.push(`/auth/login?role=${role}`);
      })
      .finally(() => {
        setIsLoading(false);
        authInProgress.current = false;
      });
  }, [pathname, router, dispatch, role]);

  return { isLoading, isAuthenticated };
}
