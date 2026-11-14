"use client";

import { useEffect, useState } from "react";
// import { usePathname } from "next/navigation";
import Link from "next/link";
import { IoLockClosed } from "react-icons/io5";
import { entrepreneur_overlay_setup } from "../../reusables/overlay";
import { setNewCookie } from "../../app/actions/auth-cookies";
// Passport OAuth (temporarily disconnected)
// import { startPassportOAuth } from "../../reusables/passportOAuth";
import {
  clearCustomerAccountHint,
  hintInitial,
  maskEmail,
  readCustomerAccountHint,
  saveCustomerAccountHint,
} from "../../reusables/customerAccountHint";
// import gg_svg from "../../svgs/google-color-svgrepo-com (1).svg";
import "./assets/customer-auth-modal.css";

const LOGIN_ENDPOINT = "/api/user/signin";
const SIGNUP_ENDPOINT = "/api/user/signup";

export default function CustomerAuthModal({ onAuthenticated, onClose }) {
  // const pathname = usePathname();
  const [view, setView] = useState("chooser");
  const [hint, setHint] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  useEffect(() => {
    const stored = readCustomerAccountHint();
    setHint(stored);
    if (stored?.email) setEmail(stored.email);
  }, []);

  async function finishLogin(cookie, profile) {
    await setNewCookie(cookie, 0);
    const name =
      profile?.name ||
      [profile?.fname, profile?.lname].filter(Boolean).join(" ") ||
      fname ||
      email.split("@")[0];
    saveCustomerAccountHint({
      email: profile?.email || email,
      name,
    });
    entrepreneur_overlay_setup(false);
    onAuthenticated?.();
  }

  // Passport OAuth (temporarily disconnected)
  // function startGoogle() {
  //   try {
  //     setError("");
  //     entrepreneur_overlay_setup(true);
  //     const next =
  //       pathname && pathname.startsWith("/") && !pathname.startsWith("/auth")
  //         ? pathname
  //         : "/";
  //     startPassportOAuth("google", { role: "customer", next });
  //   } catch (err) {
  //     entrepreneur_overlay_setup(false);
  //     setError(err?.message || "Could not start Google sign-in");
  //   }
  // }

  async function handlePasswordSignIn(event) {
    event.preventDefault();
    setError("");
    if (!email.trim() || password.length < 8) {
      setError("Enter a valid email and password.");
      return;
    }
    setBusy(true);
    entrepreneur_overlay_setup(true);
    try {
      const result = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, provider: "local" }),
      });
      const response = await result.json();
      if (response.bool) {
        await finishLogin(response.cookie, { email });
      } else {
        entrepreneur_overlay_setup(false);
        setError(typeof response.data === "string" ? response.data : "Sign in failed");
      }
    } catch {
      entrepreneur_overlay_setup(false);
      setError("Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setError("");
    if (!fname.trim() || !lname.trim() || !email.trim() || password.length < 8 || password !== confirmPwd) {
      setError("Complete all fields. Passwords must match and be at least 8 characters.");
      return;
    }
    setBusy(true);
    entrepreneur_overlay_setup(true);
    try {
      const result = await fetch(SIGNUP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fname,
          lname,
          email,
          password,
          role: "customer",
          src: "web",
          provider: "local",
        }),
      });
      const response = await result.json();
      if (response.bool) {
        await finishLogin(response.cookie, { email, name: `${fname} ${lname}`.trim() });
      } else {
        entrepreneur_overlay_setup(false);
        setError(response.data?.mssg || "Registration failed");
      }
    } catch {
      entrepreneur_overlay_setup(false);
      setError("Registration failed");
    } finally {
      setBusy(false);
    }
  }

  function removeAccount() {
    clearCustomerAccountHint();
    setHint(null);
    setEmail("");
  }

  return (
    <div className="customer-auth-modal" role="presentation" onClick={onClose}>
      <div
        className="customer-auth-modal__dialog"
        role="dialog"
        aria-labelledby="customer-auth-title"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="customer-auth-modal__close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <h2 id="customer-auth-title" className="customer-auth-modal__title">Sign in</h2>
        <p className="customer-auth-modal__safe">
          <IoLockClosed size={13} />
          All data is safeguarded
        </p>

        {view === "chooser" ? (
          <>
            <div className="customer-auth-modal__avatar" aria-hidden>
              {hintInitial(hint)}
            </div>
            {hint?.name ? <p className="customer-auth-modal__name">{hint.name}</p> : null}
            {hint?.email ? (
              <p className="customer-auth-modal__email">{maskEmail(hint.email)}</p>
            ) : (
              <p className="customer-auth-modal__email">Sign in to continue</p>
            )}
            {error ? <p className="customer-auth-modal__error">{error}</p> : null}
            <div className="customer-auth-modal__actions">
              {/* Passport OAuth (temporarily disconnected)
              <button type="button" className="customer-auth-modal__btn" onClick={startGoogle} disabled={busy}>
                <img src={gg_svg.src} alt="" />
                Continue with Google
              </button>
              */}
              <button
                type="button"
                className="customer-auth-modal__btn"
                onClick={() => setView("password")}
              >
                Sign in with email
              </button>
            </div>
            <div className="customer-auth-modal__alt">
              <button type="button" className="customer-auth-modal__text-btn" onClick={() => setView("register")}>
                Register / Sign in with another account
              </button>
            </div>
            <div className="customer-auth-modal__meta">
              {hint ? (
                <button type="button" className="customer-auth-modal__text-btn" onClick={removeAccount}>
                  Remove account
                </button>
              ) : null}
              <Link className="customer-auth-modal__text-btn" href="/auth/password-recovery/confirm-email?role=customer">
                Trouble signing in?
              </Link>
            </div>
          </>
        ) : null}

        {view === "password" ? (
          <form className="customer-auth-modal__form" onSubmit={handlePasswordSignIn}>
            {error ? <p className="customer-auth-modal__error">{error}</p> : null}
            <label htmlFor="customer-auth-email">Email</label>
            <input
              id="customer-auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
            <label htmlFor="customer-auth-password">Password</label>
            <input
              id="customer-auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
            <button type="submit" className="customer-auth-modal__btn customer-auth-modal__primary" disabled={busy}>
              Sign in
            </button>
            <button type="button" className="customer-auth-modal__text-btn" onClick={() => setView("chooser")}>
              Back
            </button>
          </form>
        ) : null}

        {view === "register" ? (
          <form className="customer-auth-modal__form" onSubmit={handleRegister}>
            {error ? <p className="customer-auth-modal__error">{error}</p> : null}
            <div className="customer-auth-modal__row">
              <div>
                <label htmlFor="customer-auth-fname">First name</label>
                <input id="customer-auth-fname" value={fname} onChange={(event) => setFname(event.target.value)} />
              </div>
              <div>
                <label htmlFor="customer-auth-lname">Last name</label>
                <input id="customer-auth-lname" value={lname} onChange={(event) => setLname(event.target.value)} />
              </div>
            </div>
            <label htmlFor="customer-auth-reg-email">Email</label>
            <input
              id="customer-auth-reg-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label htmlFor="customer-auth-reg-password">Password</label>
            <input
              id="customer-auth-reg-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <label htmlFor="customer-auth-confirm">Confirm password</label>
            <input
              id="customer-auth-confirm"
              type="password"
              value={confirmPwd}
              onChange={(event) => setConfirmPwd(event.target.value)}
            />
            <button type="submit" className="customer-auth-modal__btn customer-auth-modal__primary" disabled={busy}>
              Register
            </button>
            <button type="button" className="customer-auth-modal__text-btn" onClick={() => setView("chooser")}>
              Back
            </button>
          </form>
        ) : null}

        <p className="customer-auth-modal__legal">
          By signing in, you agree to our <Link href="/terms-of-use">Terms of Use</Link> and acknowledge that you
          have read our <Link href="/privacy-policy">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
