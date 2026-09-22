"use client";

import { useState, useCallback } from "react";
import Header from "components/entrepreneur/header/Header";
import { isValidPhoneNumber } from "react-phone-number-input";
import "./styles/global.css";
import "./styles/s.css";
import "./styles/m.css";
import "./styles/l.css";
import "./styles/xxl.css";
import logo_img from "../../../images/Deedyte.png";

const NIGERIAN_NATIONAL_LENGTH = 10; // digits only (e.g. 8012345678)
const E164_PREFIX = "+234";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function WaitList() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsAppNational, setWhatsAppNational] = useState(""); // 10 digits only, no prefix
  const [errors, setErrors] = useState({
    firstName: "",
    lastName: "",
    email: "",
    whatsApp: "",
  });
  const [whatsAppValidating, setWhatsAppValidating] = useState(false);
  const [whatsAppValid, setWhatsAppValid] = useState(null); // true | false | null (not checked)
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const validateWhatsAppApi = useCallback(async (phone) => {
    if (!phone || !isValidPhoneNumber(phone)) return false;
    setWhatsAppValidating(true);
    setWhatsAppValid(null);
    try {
      const res = await fetch("/api/waitlist/validate-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWhatsAppValid(false);
        setErrors((e) => ({ ...e, whatsApp: data?.error || "Validation failed" }));
        return false;
      }
      setWhatsAppValid(data.valid);
      if (!data.valid && !data.skipped) {
        setErrors((e) => ({ ...e, whatsApp: "This number is not registered on WhatsApp." }));
      } else if (data.valid || data.skipped) {
        setErrors((e) => ({ ...e, whatsApp: "" }));
      }
      return data.valid || data.skipped;
    } catch (err) {
      setWhatsAppValid(false);
      setErrors((e) => ({ ...e, whatsApp: "Could not verify WhatsApp number." }));
      return false;
    } finally {
      setWhatsAppValidating(false);
    }
  }, []);

  const whatsAppE164 = whatsAppNational ? `${E164_PREFIX}${whatsAppNational}` : "";

  const validateForm = useCallback(() => {
    const next = {
      firstName: "",
      lastName: "",
      email: "",
      whatsApp: "",
    };
    if (!firstName.trim()) next.firstName = "First name is required.";
    if (!lastName.trim()) next.lastName = "Last name is required.";
    if (!email.trim()) next.email = "Email is required.";
    else if (!emailRegex.test(email.trim())) next.email = "Please enter a valid email address.";
    if (!whatsAppNational.trim()) next.whatsApp = "WhatsApp number is required.";
    else if (whatsAppNational.length !== NIGERIAN_NATIONAL_LENGTH) next.whatsApp = "Enter 10 digits.";
    else if (!isValidPhoneNumber(whatsAppE164)) next.whatsApp = "Please enter a valid phone number.";
    setErrors(next);
    return !Object.values(next).some(Boolean);
  }, [firstName, lastName, email, whatsAppNational, whatsAppE164]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!validateForm()) return;
    const whatsAppOk = await validateWhatsAppApi(whatsAppE164);
    if (!whatsAppOk) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          whatsAppNumber: whatsAppE164,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data?.error || "Could not join waitlist. Please try again.");
        return;
      }
      alert("You're on the list! We'll be in touch.");
    } catch (err) {
      setSubmitError("Could not join waitlist. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="wait-list-cnt">
        <div className="left">
          <img
            className="img"
            src={logo_img.src}
            style={{ height: "50px", width: "50px" }}
            alt=""
          />
          <label className="launch-date" htmlFor="">
            Launching September 8th, 2026.
          </label>
          <br />
          <h2 className="wait-list-header">
            Ready to launch your store online and reach more customers?
          </h2>
          <br />
          <small className="wait-list-body">
            Join the Deedyte Vendor Waitlist to be among the first sellers on our upcoming marketplace. 
            <br />Get early access to create your shop, list your products, and start preparing your store before the official launch.
          </small>
          <small className="foot-text">
            Sign up now to secure your spot and start preparing your store on Deedyte.
          </small>
        </div>
        <div className="right">
          <form onSubmit={handleSubmit} noValidate>
            <h4 style={{color: "#005c45"}}><b>Deedyte Wait List</b></h4>
            <br />
            <div className="wait-list-form-row">
              <div className="input-cnt" style={{ width: "45%" }}>
                <label htmlFor="waitlist-firstname">First name</label>
                <input
                  id="waitlist-firstname"
                  type="text"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (errors.firstName) setErrors((e) => ({ ...e, firstName: "" }));
                  }}
                  placeholder="First name"
                  aria-invalid={!!errors.firstName}
                />
                {errors.firstName && (
                  <span className="wait-list-err" role="alert">{errors.firstName}</span>
                )}
              </div>
              <div className="input-cnt" style={{ width: "45%" }}>
                <label htmlFor="waitlist-lastname">Last name</label>
                <input
                  id="waitlist-lastname"
                  type="text"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (errors.lastName) setErrors((e) => ({ ...e, lastName: "" }));
                  }}
                  placeholder="Last name"
                  aria-invalid={!!errors.lastName}
                />
                {errors.lastName && (
                  <span className="wait-list-err" role="alert">{errors.lastName}</span>
                )}
              </div>
            </div>
            <br />
            <div className="input-cnt">
              <label htmlFor="waitlist-email">Email</label>
              <input
                id="waitlist-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((e) => ({ ...e, email: "" }));
                }}
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <span className="wait-list-err" role="alert">{errors.email}</span>
              )}
            </div>
            <br />
            <div className="input-cnt">
              <label htmlFor="waitlist-whatsapp">WhatsApp Number</label>
              <div className="wait-list-phone-wrap">
                <span className="wait-list-phone-code" aria-hidden>+234</span>
                <input
                  id="waitlist-whatsapp"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={NIGERIAN_NATIONAL_LENGTH}
                  value={whatsAppNational}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, NIGERIAN_NATIONAL_LENGTH);
                    setWhatsAppNational(digits);
                    setWhatsAppValid(null);
                    if (errors.whatsApp) setErrors((prev) => ({ ...prev, whatsApp: "" }));
                  }}
                  onKeyDown={(e) => {
                    if (["+", "-", "e", "E", "."].includes(e.key)) e.preventDefault();
                  }}
                  placeholder="8012345678"
                  aria-invalid={!!errors.whatsApp}
                  className="wait-list-phone-input"
                />
                {whatsAppValidating && (
                  <span className="wait-list-phone-hint">Checking WhatsApp…</span>
                )}
                {whatsAppValid === true && !whatsAppValidating && (
                  <span className="wait-list-phone-ok" role="status">✓ Valid WhatsApp number</span>
                )}
              </div>
              {errors.whatsApp && (
                <span className="wait-list-err" role="alert">{errors.whatsApp}</span>
              )}
            </div>
            <br />
            <div className="input-cnt">
              {submitError && (
                <span className="wait-list-err" role="alert" style={{ marginBottom: 8 }}>{submitError}</span>
              )}
              <button type="submit" disabled={whatsAppValidating || submitting}>
                {submitting ? "Joining…" : "Join The Wait list"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}