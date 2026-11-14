"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";

import { setNewCookie } from "../../../actions/auth-cookies";
import { resolvePostLoginNavigation } from "../../../../reusables/redirectAfterVendorLogin";
import { saveCustomerAccountHint } from "../../../../reusables/customerAccountHint";
import { passportOAuthErrorMessage } from "../../../../reusables/passportOAuth";
import { entrepreneur_overlay_setup } from "../../../../reusables/overlay";
import {
  set_entrepreneur_has_shop,
  set_entrepreneur_shop_details,
  reset_entrepreneur_shop,
} from "../../../../redux/entrepreneur/entrepreneur_shop";

function safeNextPath(raw) {
  const next = String(raw || "").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/auth")) return "";
  return next;
}

function OAuthCallbackInner() {
  const router = useRouter();
  const dispatch = useDispatch();
  const searchParams = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const error = searchParams.get("error");
    const token = searchParams.get("token");
    const role =
      searchParams.get("role") === "entrepreneur" ? "entrepreneur" : "customer";
    const nextPath = safeNextPath(searchParams.get("next"));
    const email = searchParams.get("email") || "";
    const fname = searchParams.get("fname") || "";
    const cookieRole = role === "entrepreneur" ? 1 : 0;

    async function finish() {
      entrepreneur_overlay_setup(true, "One Moment Please...");

      if (error || !token) {
        entrepreneur_overlay_setup(false, "Try Again...");
        const message = encodeURIComponent(passportOAuthErrorMessage(error || "oauth_failed"));
        router.replace(`/auth/login?role=${role}&oauth_error=${message}`);
        return;
      }

      try {
        await setNewCookie(token, cookieRole);
        if (role === "customer") {
          saveCustomerAccountHint({
            email,
            name: fname,
          });
        }

        const nav = await resolvePostLoginNavigation(role);
        if (role === "entrepreneur") {
          if (nav.hasShop !== null) dispatch(set_entrepreneur_has_shop(nav.hasShop));
          dispatch(set_entrepreneur_shop_details(nav.shop));
        } else {
          dispatch(reset_entrepreneur_shop());
        }

        entrepreneur_overlay_setup(false, "One Moment Please...");
        router.replace(nextPath || nav.path);
      } catch (err) {
        console.error("Passport OAuth callback error:", err);
        entrepreneur_overlay_setup(false, "Try Again...");
        router.replace(`/auth/login?role=${role}&oauth_error=${encodeURIComponent("Sign-in failed.")}`);
      }
    }

    void finish();
  }, [dispatch, router, searchParams]);

  return (
    <div style={{ minHeight: "40vh", display: "grid", placeItems: "center", padding: 24 }}>
      <p style={{ color: "#666", fontSize: 14 }}>Finishing sign-in…</p>
    </div>
  );
}

export default function OAuthCallbackClient() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "40vh", display: "grid", placeItems: "center", padding: 24 }}>
          <p style={{ color: "#666", fontSize: 14 }}>Finishing sign-in…</p>
        </div>
      }
    >
      <OAuthCallbackInner />
    </Suspense>
  );
}
