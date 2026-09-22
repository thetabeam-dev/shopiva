"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDispatch } from "react-redux";

import "../styles/xxl.css";
import "react-phone-number-input/style.css";

import gg_svg from "../../../svgs/google-color-svgrepo-com (1).svg";
import a_svg from "../../../svgs/apple-logo-svgrepo-com.svg";
import fb_svg from "../../../svgs/facebook-svgrepo-com (1).svg";
import logo_img from "../../../images/Deedyte.png";

import { entrepreneur_overlay_setup } from "../../../reusables/overlay";
import { setNewCookie } from "../../actions/auth-cookies";
import { resolvePostLoginNavigation } from "../../../reusables/redirectAfterVendorLogin";
import {
  set_entrepreneur_has_shop,
  set_entrepreneur_shop_details,
  reset_entrepreneur_shop,
} from "../../../redux/entrepreneur/entrepreneur_shop";

const LOGIN_ENDPOINT = "/api/user/signin";

const ROLES = { entrepreneur: "entrepreneur", customer: "customer" };

function authQuery(role) {
  const r = role === ROLES.customer ? "customer" : "entrepreneur";
  return `?role=${r}`;
}

export default function AuthLoginPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const role = roleParam === "customer" ? ROLES.customer : ROLES.entrepreneur;
  const cookieRole = role === ROLES.entrepreneur ? 1 : 0;

  const session = useSession();

  async function applyPostLoginNavigation(loginRole) {
    const nav = await resolvePostLoginNavigation(loginRole);
    if (loginRole === ROLES.entrepreneur) {
      if (nav.hasShop !== null) dispatch(set_entrepreneur_has_shop(nav.hasShop));
      dispatch(set_entrepreneur_shop_details(nav.shop));
    } else {
      dispatch(reset_entrepreneur_shop());
    }
    router.replace(nav.path);
  }
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const validation = useRef(false);
  const book = useRef({ email: false, pwd: false });
  const oauthLoginInProgress = useRef(false);

  useEffect(() => {
    if (session.status !== "authenticated") return;
    // Only call backend when user just completed OAuth from this page (clicked a button), not when landing with an existing session
    if (typeof window === "undefined" || window.sessionStorage?.getItem("auth_oauth_pending") !== "true") return;
    if (oauthLoginInProgress.current) return;
    oauthLoginInProgress.current = true;
    window.sessionStorage.removeItem("auth_oauth_pending");

    fetch(LOGIN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: session.data?.user?.email,
        provider: session.data?.provider,
      }),
    })
      .then(async (result) => {
        const response = await result.json();
        if (response.bool) {
          await setNewCookie(response.cookie, cookieRole);
          await applyPostLoginNavigation(role);
        } else {
          oauthLoginInProgress.current = false;
          addErrMssg([{ mssg: response.data || "Login failed" }], document.querySelector(".pwd")?.parentElement);
          entrepreneur_overlay_setup(false, "Try Again...");
        }
      })
      .catch((err) => {
        oauthLoginInProgress.current = false;
        console.error("OAuth login error:", err);
      });
  }, [session.status, session.data?.user?.email, session.data?.provider, cookieRole, role, router, dispatch]);

  function addErrMssg(err, pElem) {
    if (!pElem) return;
    const existing = pElem.querySelector(".err-mssg");
    if (existing) existing.remove();
    if (err?.length > 0) {
      const div = document.createElement("div");
      div.className = "err-mssg";
      div.innerHTML = err[0].mssg;
      pElem.append(div);
    }
  }

  function handleLoginError(errorType) {
    if (errorType === "duplicate email") {
      addErrMssg([{ mssg: "Email already exists, please try something else" }], document.querySelector(".email")?.parentElement);
    } else if (errorType === "duplicate phone") {
      addErrMssg([{ mssg: "Phone number already exists" }], document.querySelector(".phone")?.parentElement);
    } else {
      addErrMssg([{ mssg: errorType }], document.querySelector(".pwd")?.parentElement);
    }
  }

  function validateForm() {
    const inputs = [...document.querySelectorAll("input")];
    inputs.forEach((item) => {
      if (item.type === "text" && item.name === "email") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const empty = item.value !== "" ? { bool: true, mssg: "" } : { bool: false, mssg: "Please field cannot be empty." };
        const validEmail = emailRegex.test(item.value) ? { bool: true, mssg: "" } : { bool: false, mssg: "Please enter a valid email address." };
        const errs = [empty, validEmail];
        addErrMssg(errs.filter((e) => e.mssg !== ""), item.parentElement);
        book.current.email = errs.every((e) => e.mssg === "");
      }
      if (item.type === "password" && item.name === "password") {
        const empty = item.value !== "" ? { bool: true, mssg: "" } : { bool: false, mssg: "Please field cannot be empty." };
        const length = item.value.length >= 8 ? { bool: true, mssg: "" } : { bool: false, mssg: "Password must contain at least 8 characters." };
        const errs = [empty, length];
        addErrMssg(errs.filter((e) => e.mssg !== ""), item.parentElement);
        book.current.pwd = errs.every((e) => e.mssg === "");
      }
    });
  }

  function handleLogin(e) {
    try {
      e.target.disabled = true;
      validateForm();
      const allValid = Object.values(book.current).every((v) => v === true);
      validation.current = allValid;
      if (!validation.current) {
        e.target.disabled = false;
        return;
      }
      entrepreneur_overlay_setup(true, "One Moment Please...");

      fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pwd, provider: "local" }),
      })
        .then(async (result) => {
          const response = await result.json();
          if (response.bool) {
            await setNewCookie(response.cookie, cookieRole);
            await applyPostLoginNavigation(role);
          } else {
            handleLoginError(response.data);
            e.target.disabled = false;
            entrepreneur_overlay_setup(false, "Try Again...");
          }
        })
        .catch((err) => {
          console.error("Login error:", err);
          e.target.disabled = false;
          entrepreneur_overlay_setup(false, "Try Again...");
        });
    } catch (error) {
      console.error("Login error:", error);
      e.target.disabled = false;
    }
  }

  return (
    <div className="enetrepreneur-signup-form">
      <div className="form-cnt">
        <section>
          <section style={{ marginLeft: "0px", flexDirection: "row", display: "flex", alignItems: "flex-start" }}>
            <img src={logo_img.src} style={{ height: "40px", width: "40px", borderRadius: "10px" }} alt="Deedyte" />
          </section>
          <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#666" }}>
            Sign in as {role === ROLES.entrepreneur ? "Entrepreneur" : "Customer"}
          </p>
          <div style={{ display: "flex", width: "auto", gap: "10px", marginTop: 12 }}>
            <button className="shadow-sm" onClick={() => { sessionStorage.setItem("auth_oauth_pending", "true"); signIn("google", { redirect: false }); }} style={{ padding: "2px 15px", height: "40px", background: "#fff", border: "none", borderRadius: "5px" }}>
              <span><img src={gg_svg.src} style={{ height: "20px", width: "20px" }} alt="Google" /></span>
            </button>
            <button className="shadow-sm" onClick={() => { sessionStorage.setItem("auth_oauth_pending", "true"); signIn("apple", { redirect: false }); }} style={{ padding: "2px 15px", height: "40px", background: "#fff", border: "none", borderRadius: "5px" }}>
              <span><img src={a_svg.src} style={{ height: "25px", width: "25px" }} alt="Apple" /></span>
            </button>
            <button className="shadow-sm" onClick={() => { sessionStorage.setItem("auth_oauth_pending", "true"); signIn("facebook", { redirect: false }); }} style={{ padding: "2px 15px", height: "40px", background: "#fff", border: "none", borderRadius: "5px" }}>
              <span><img src={fb_svg.src} style={{ height: "20px", width: "20px" }} alt="Facebook" /></span>
            </button>
          </div>
        </section>

        <section style={{ height: "auto" }}>
          <div style={{ width: "100%" }}>
            <div className="input-cnt" style={{ display: "flex", flexDirection: "column" }}>
              <label htmlFor="email">Email</label>
              <input className="email" style={{ color: "#000", width: "100%" }} onInput={(e) => setEmail(e.target.value)} type="text" placeholder="Email" name="email" id="email" />
            </div>
            <div className="input-cnt" style={{ display: "flex", flexDirection: "column" }}>
              <label htmlFor="password">Password</label>
              <input style={{ color: "#000", width: "100%" }} onInput={(e) => setPwd(e.target.value)} type="password" placeholder="Password" className="pwd" name="password" id="password" />
            </div>
            <div className="input-cnt" style={{ marginBottom: 4 }}>
              <Link href={`/auth/password-recovery/confirm-email${authQuery(role)}`} style={{ fontSize: "13px", color: "#00926e" }}>Forgot password?</Link>
            </div>
            <div className="input-cnt">
              <button style={{ borderRadius: "8px", background: "#00926e" }} onClick={handleLogin}>Login</button>
            </div>
          </div>
        </section>

        <section className="other-reg-forms">
          <Link href={`/auth/signup${authQuery(role)}`} style={{ marginLeft: "0", background: "none", border: "none", color: "#00926e", textDecoration: "none", fontSize: "14px" }}>
            Not registered? Signup.
          </Link>
        </section>
      </div>
    </div>
  );
}
