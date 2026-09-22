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

const REGISTRATION_ENDPOINT = "/api/user/signup";

const ROLES = { entrepreneur: "entrepreneur", customer: "customer" };

function authQuery(role) {
  return `?role=${role === ROLES.customer ? "customer" : "entrepreneur"}`;
}

export default function AuthSignupPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const role = roleParam === "customer" ? ROLES.customer : ROLES.entrepreneur;
  const cookieRole = role === ROLES.entrepreneur ? 1 : 0;

  const session = useSession();

  async function applyPostLoginNavigation(signupRole) {
    const nav = await resolvePostLoginNavigation(signupRole);
    if (signupRole === ROLES.entrepreneur) {
      if (nav.hasShop !== null) dispatch(set_entrepreneur_has_shop(nav.hasShop));
      dispatch(set_entrepreneur_shop_details(nav.shop));
    } else {
      dispatch(reset_entrepreneur_shop());
    }
    router.replace(nav.path);
  }
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [provider, setProvider] = useState("local");
  const [duplicateErr, setDuplicateErr] = useState("");

  const book = useRef({ fname: false, lname: false, email: false, pwd: false });
  const validation = useRef(false);

  useEffect(() => {
    if (session.status !== "authenticated") return;
    // Only call backend when user just completed OAuth from this page (clicked a button), not when landing with an existing session
    if (typeof window === "undefined" || window.sessionStorage?.getItem("auth_oauth_pending") !== "true") return;

    window.sessionStorage.removeItem("auth_oauth_pending");

    const nameParts = (session.data?.user?.name || "").split(" ");
    fetch(REGISTRATION_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fname: nameParts[0] || session.data?.user?.email?.split("@")[0],
        lname: nameParts[1] || "",
        email: session.data?.user?.email,
        password: "null",
        phone: "null",
        gender: "null",
        role,
        src: "web",
        deviceId: "null",
        deviceToken: "fcm-token",
        provider: session.data?.provider,
      }),
    })
      .then(async (result) => {
        const response = await result.json();
        if (response.bool) {
          await setNewCookie(response.cookie, cookieRole);
          entrepreneur_overlay_setup(false, "One Moment Please...");
          await applyPostLoginNavigation(role);
        } else {
          setDuplicateErr(response.data?.mssg || "Registration failed");
          entrepreneur_overlay_setup(false, "Try Again...");
        }
      })
      .catch((err) => {
        console.error("OAuth signup error:", err);
        entrepreneur_overlay_setup(false, "Try Again...");
      });
  }, [session.status, session.data?.user?.email, session.data?.user?.name, session.data?.provider, role, cookieRole, router, dispatch]);

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

  function handleRegistrationError(mssg) {
    if (mssg === "email exists") setDuplicateErr("Email already exists, please try something else");
    else if (mssg === "phone exists") setDuplicateErr("Phone number already exists");
    else setDuplicateErr(mssg || "Registration failed");
  }

  function validateForm() {
    const inputs = [...document.querySelectorAll("input")];
    inputs.forEach((item) => {
      if (item.name === "fname" || item.name === "lname") {
        const empty = item.value !== "" ? { bool: true, mssg: "" } : { bool: false, mssg: "Please field cannot be empty" };
        const length = item.value.length > 3 ? { bool: true, mssg: "" } : { bool: false, mssg: "Name must be at least 3 letters." };
        const alpha = /^[a-zA-Z]+$/.test(item.value.trim()) ? { bool: true, mssg: "" } : { bool: false, mssg: "Letters only." };
        const errs = [empty, length, alpha];
        addErrMssg(errs.filter((e) => e.mssg !== ""), item.parentElement);
        book.current[item.name] = errs.every((e) => e.mssg === "");
      }
      if (item.name === "email") {
        const empty = item.value !== "" ? { bool: true, mssg: "" } : { bool: false, mssg: "Please field cannot be empty." };
        const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.value) ? { bool: true, mssg: "" } : { bool: false, mssg: "Enter a valid email." };
        const errs = [empty, valid];
        addErrMssg(errs.filter((e) => e.mssg !== ""), item.parentElement);
        book.current.email = errs.every((e) => e.mssg === "");
      }
      if (item.name === "password") {
        const empty = item.value !== "" ? { bool: true, mssg: "" } : { bool: false, mssg: "Please field cannot be empty." };
        const length = item.value.length >= 8 ? { bool: true, mssg: "" } : { bool: false, mssg: "Password must be at least 8 characters." };
        const errs = [empty, length];
        addErrMssg(errs.filter((e) => e.mssg !== ""), item.parentElement);
        book.current.pwd = errs.every((e) => e.mssg === "");
      }
      if (item.name === "confirm-password") {
        const empty = item.value !== "" ? { bool: true, mssg: "" } : { bool: false, mssg: "Please field cannot be empty." };
        const match = item.value === pwd ? { bool: true, mssg: "" } : { bool: false, mssg: "Passwords do not match." };
        const errs = [empty, match];
        addErrMssg(errs.filter((e) => e.mssg !== ""), item.parentElement);
        if (errs.every((e) => e.mssg === "")) book.current.pwd = true;
      }
    });
  }

  function handleRegistration(e) {
    try {
      e?.preventDefault?.();
      setDuplicateErr("");
      entrepreneur_overlay_setup(true, "One Moment Please...");
      validateForm();

      const allValid = book.current.fname && book.current.lname && book.current.email && book.current.pwd;
      validation.current = allValid;
      if (!validation.current) {
        entrepreneur_overlay_setup(false, "Try Again...");
        return;
      }

      fetch(REGISTRATION_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fname,
          lname,
          email,
          password: pwd,
          role,
          src: "web",
          provider,
        }),
      })
        .then(async (result) => {
          const response = await result.json();
          if (response.bool) {
            await setNewCookie(response.cookie, cookieRole);
            entrepreneur_overlay_setup(false, "One Moment Please...");
            await applyPostLoginNavigation(role);
          } else {
            handleRegistrationError(response.data?.mssg);
            entrepreneur_overlay_setup(false, "Try Again...");
          }
        })
        .catch((err) => {
          console.error("Registration error:", err);
          entrepreneur_overlay_setup(false, "Try Again...");
        });
    } catch (error) {
      console.error("Registration error:", error);
      entrepreneur_overlay_setup(false, "Try Again...");
    }
  }

  return (
    <div className="enetrepreneur-signup-form">
      <div className="form-cnt">
        <section>
          <section style={{ marginLeft: "0px", marginBottom: "10px", flexDirection: "row", display: "flex", alignItems: "flex-start" }}>
            <img src={logo_img.src} style={{ height: "40px", width: "40px", borderRadius: "10px" }} alt="Deedyte" />
          </section>
          <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#666" }}>
            Sign up as {role === ROLES.entrepreneur ? "Entrepreneur" : "Customer"}
          </p>
          <div style={{ display: "flex", width: "auto", gap: "10px", marginTop: 12 }}>
            <button className="shadow-sm" onClick={() => { sessionStorage.setItem("auth_oauth_pending", "true"); setProvider("google"); signIn("google", { redirect: false }); }} style={{ padding: "2px 15px", height: "40px", background: "#fff", border: "none", borderRadius: "5px" }}>
              <span><img src={gg_svg.src} style={{ height: "20px", width: "20px" }} alt="Google" /></span>
            </button>
            <button className="shadow-sm" onClick={() => { sessionStorage.setItem("auth_oauth_pending", "true"); setProvider("apple"); signIn("apple", { redirect: false }); }} style={{ padding: "2px 15px", height: "40px", background: "#fff", border: "none", borderRadius: "5px" }}>
              <span><img src={a_svg.src} style={{ height: "25px", width: "25px" }} alt="Apple" /></span>
            </button>
            <button className="shadow-sm" onClick={() => { sessionStorage.setItem("auth_oauth_pending", "true"); setProvider("facebook"); signIn("facebook", { redirect: false }); }} style={{ padding: "2px 15px", height: "40px", background: "#fff", border: "none", borderRadius: "5px" }}>
              <span><img src={fb_svg.src} style={{ height: "20px", width: "20px" }} alt="Facebook" /></span>
            </button>
          </div>
        </section>

        <section style={{ height: "auto" }}>
          {duplicateErr && <p className="err-mssg" style={{ marginBottom: 8 }}>{duplicateErr}</p>}
          <div style={{ width: "100%" }}>
            <section style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ width: "48%", display: "flex", flexDirection: "column" }} className="input-cnt">
                <label htmlFor="fname">First name</label>
                <input style={{ color: "#000", width: "100%" }} onInput={(e) => setFname(e.target.value)} type="text" placeholder="First name" name="fname" id="fname" />
              </div>
              <div style={{ width: "48%", display: "flex", flexDirection: "column" }} className="input-cnt">
                <label htmlFor="lname">Last name</label>
                <input style={{ color: "#000", width: "100%" }} onInput={(e) => setLname(e.target.value)} type="text" placeholder="Last name" name="lname" id="lname" />
              </div>
            </section>
            <div className="input-cnt" style={{ display: "flex", flexDirection: "column" }}>
              <label htmlFor="email">Email</label>
              <input style={{ color: "#000", width: "100%" }} onInput={(e) => setEmail(e.target.value)} type="text" placeholder="Email" name="email" id="email" />
            </div>
            <div className="input-cnt" style={{ display: "flex", flexDirection: "column" }}>
              <label htmlFor="password">Password</label>
              <input style={{ color: "#000", width: "100%" }} onInput={(e) => setPwd(e.target.value)} type="password" autoComplete="off" placeholder="Password" name="password" id="password" />
            </div>
            <div className="input-cnt" style={{ display: "flex", flexDirection: "column" }}>
              <label htmlFor="confirm-password">Confirm Password</label>
              <input style={{ color: "#000", width: "100%" }} onInput={(e) => setConfirmPwd(e.target.value)} type="password" placeholder="Confirm Password" name="confirm-password" id="confirm-password" />
            </div>
            <div className="input-cnt" style={{ marginTop: "20px" }}>
              <button style={{ borderRadius: "8px" }} onClick={(e) => { setProvider("local"); handleRegistration(e); }}>Register</button>
            </div>
          </div>
        </section>

        <section className="other-reg-forms">
          <Link href={`/auth/login${authQuery(role)}`} style={{ marginLeft: "0", background: "none", border: "none", color: "#00926e", textDecoration: "none", fontSize: "14px" }}>
            Already registered? Login.
          </Link>
        </section>
      </div>
    </div>
  );
}
