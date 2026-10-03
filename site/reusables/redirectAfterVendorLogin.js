/**
 * Post-login navigation targets for vendors/customers.
 * Returns path + shop payload so callers can dispatch Redux then router.replace (state survives).
 */

import { pickDefaultShopFromList } from "../lib/entrepreneurDefaultShop";

const AUTH_URL = "/api/user/authorization";

/**
 * @param {"entrepreneur"|"customer"} role
 * @returns {Promise<{ path: string, hasShop: boolean | null, shop: object | null }>}
 *   hasShop/shop are only meaningful for entrepreneur; customer gets hasShop null, shop null.
 */
export async function resolvePostLoginNavigation(role) {
  if (role === "customer") {
    return { path: "/", hasShop: null, shop: null };
  }

  try {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ role: "entrepreneur", checkShop: true }),
    });
    const data = await res.json();

    if (res.ok && data.bool && data.hasShop === false) {
      return { path: "/entrepreneur/shop", hasShop: false, shop: null };
    }

    if (res.ok && data.bool && data.hasShop === true) {
      try {
        const sres = await fetch("/api/shop/my-shops", { credentials: "include" });
        const sjson = await sres.json().catch(() => ({}));
        const shops = Array.isArray(sjson?.shops) ? sjson.shops : [];
        let shop = pickDefaultShopFromList(shops);
        if (!shop) {
          const dres = await fetch("/api/shop/details", { credentials: "include" });
          const djson = await dres.json().catch(() => ({}));
          shop = dres.ok ? djson.shop ?? null : null;
        }
        return { path: "/entrepreneur", hasShop: true, shop };
      } catch {
        return { path: "/entrepreneur", hasShop: true, shop: null };
      }
    }
  } catch (e) {
    console.error("Post-login shop check:", e);
  }

  return { path: "/entrepreneur", hasShop: null, shop: null };
}
