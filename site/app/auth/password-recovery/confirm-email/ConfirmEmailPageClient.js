"use client";

import React, { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import "../../styles/xxl.css";
import logo_img from "../../../../images/Deedyte.png";

const ROLES = { entrepreneur: "entrepreneur", customer: "customer" };

function authQuery(role) {
  return `?role=${role === ROLES.customer ? "customer" : "entrepreneur"}`;
}

/**
 * Unified confirm email – request password reset link.
 * Role from ?role=entrepreneur|customer; back link goes to /auth/login with same role.
 */
export default function ConfirmEmailPage() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const role = roleParam === "customer" ? ROLES.customer : ROLES.entrepreneur;

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    const trimmed = email.trim();
    if (!trimmed) {
      setMessage({ type: "error", text: "Please enter your email." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setMessage({ type: "error", text: "Please enter a valid email address." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/user/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();

      if (data.success && data.token) {
        const params = new URLSearchParams({ token: data.token, role: role === ROLES.customer ? "customer" : "entrepreneur" });
        window.location.href = `/auth/password-recovery/reset-password?${params.toString()}`;
        return;
      }

      setMessage({
        type: "error",
        text: data.error || "No account found for this email. Please check the address or sign up.",
      });
    } catch (err) {
      setMessage({ type: "error", text: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="enetrepreneur-signup-form">
      <div className="form-cnt">
        <section style={{
          flexDirection: "column",
          justifyContent: "flex-start",
          alignItems: "flex-start"
        }}>
          <section style={{ marginLeft: "0px", flexDirection: "row", display: "flex", alignItems: "flex-start", justifyContent: "flex-start", width: "100%"}}>
            <img src={logo_img.src} style={{ height: "40px", width: "40px", borderRadius: "10px" }} alt="Deedyte" />
            &nbsp;
            &nbsp;
            <h2 style={{ margin: "16px 0 8px", fontSize: "1.25rem", color: "#333" }}>Reset password</h2>
          </section>
          <div style={{
            display: "flex",
            alignItems: "center",
            flexDirection: "column"
          }}>
            <div>
              <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#666" }}>
                <b>Reset password for {role === ROLES.entrepreneur ? "Entrepreneur" : "Customer"}</b>
              </p>
              <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#666" }}>
                Enter your email address so we can confirm your account and continue.
              </p>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit}>
          <section style={{ height: "auto" }}>
            <div style={{ width: "100%" }}>
              <div className="input-cnt" style={{ display: "flex", flexDirection: "column" }}>
                <label htmlFor="confirm-email">Email</label>
                <input
                  id="confirm-email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ color: "#000", width: "100%" }}
                  autoComplete="email"
                  disabled={submitting}
                />
              </div>
              {message.text && (
                <p role="alert" style={{ margin: "8px 0", fontSize: "14px", color: message.type === "error" ? "#c00" : "#00926e" }}>
                  {message.text}
                </p>
              )}
              <div className="input-cnt">
                <button type="submit" disabled={submitting} style={{ borderRadius: "8px", background: "#00926e" }}>
                  {submitting ? "Confirming..." : "Confirm Email"}
                </button>
              </div>
            </div>
          </section>
        </form>

        <section className="other-reg-forms">
          <Link href={`/auth/login${authQuery(role)}`} style={{ marginLeft: "0", background: "none", border: "none", color: "#00926e", textDecoration: "none", fontSize: "14px" }}>
            Back to login
          </Link>
        </section>
      </div>
    </div>
  );
}
