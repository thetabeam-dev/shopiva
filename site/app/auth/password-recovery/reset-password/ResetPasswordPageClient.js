"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import "../../styles/xxl.css";
import logo_img from "../../../../images/Deedyte.png";

const ROLES = { entrepreneur: "entrepreneur", customer: "customer" };

function authQuery(role) {
  return `?role=${role === ROLES.customer ? "customer" : "entrepreneur"}`;
}

/**
 * Unified reset password page. Token from ?token=...; role from ?role=.
 */
export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const roleParam = searchParams.get("role");
  const role = roleParam === "customer" ? ROLES.customer : ROLES.entrepreneur;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) setMessage({ type: "error", text: "Invalid or missing reset link. Request a new one." });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });
    if (!token) return;
    if (password.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/user/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: "success", text: "Password updated. You can now log in." });
        setTimeout(() => {
          window.location.href = `/auth/login${authQuery(role)}`;
        }, 1500);
        return;
      }

      setMessage({ type: "error", text: data.error || "Something went wrong. Please try again." });
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
            <h2 style={{ margin: "16px 0 8px", fontSize: "1.25rem", color: "#333" }}>Set new password</h2>
          </section>
          <div style={{
            display: "flex",
            alignItems: "center",
            flexDirection: "column"
          }}>
            <div>
              <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#666" }}>
                <b>Set new password ({role === ROLES.entrepreneur ? "Entrepreneur" : "Customer"})</b>
              </p>
              <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#666" }}>Enter your new password below.</p>
            </div>
          </div>
       </section>

        <form onSubmit={handleSubmit}>
          <section style={{ height: "auto" }}>
            <div style={{ width: "100%" }}>
              <div className="input-cnt" style={{ display: "flex", flexDirection: "column" }}>
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  placeholder="New password (min 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ color: "#000", width: "100%" }}
                  autoComplete="new-password"
                  disabled={submitting || !token}
                />
              </div>
              <div className="input-cnt" style={{ display: "flex", flexDirection: "column" }}>
                <label htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ color: "#000", width: "100%" }}
                  autoComplete="new-password"
                  disabled={submitting || !token}
                />
              </div>
              {message.text && (
                <p role="alert" style={{ margin: "8px 0", fontSize: "14px", color: message.type === "error" ? "#c00" : "#00926e" }}>
                  {message.text}
                </p>
              )}
              <div className="input-cnt">
                <button type="submit" disabled={submitting || !token} style={{ borderRadius: "8px", background: "#00926e" }}>
                  {submitting ? "Updating…" : "Reset password"}
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
