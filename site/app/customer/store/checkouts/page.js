"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "./styles/xxl.css";
import "./styles/s.css";
import { buyerAuthHeaders } from "@/reusables/shopBackendAuth";

const AUTH_URL = "/api/user/authorization";

const PAYSTACK_PUBLIC_KEY =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY) ||
  "pk_live_13343a7bd4deeebc644070871efcdf8fdcf280f7";


function isValidEmail(s) {
  const t = String(s || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function digitCount(s) {
  return (String(s || "").match(/\d/g) || []).length;
}

function validateCheckoutFields(values) {
  const errors = {};
  const fullName = String(values.fullName || "").trim();
  if (fullName.length < 2) {
    errors.fullName = "Enter your full name.";
  }

  const email = String(values.checkoutEmail || "").trim();
  if (!email) {
    errors.checkoutEmail = "Email is required.";
  } else if (!isValidEmail(email)) {
    errors.checkoutEmail = "Enter a valid email address.";
  }

  const phone = String(values.phone || "").trim();
  if (!phone) {
    errors.phone = "Phone number is required.";
  } else if (digitCount(phone) < 10) {
    errors.phone = "Enter a valid phone number (at least 10 digits).";
  }

  const street = String(values.street || "").trim();
  if (street.length < 5) {
    errors.street = "Enter a complete street address.";
  }

  const city = String(values.city || "").trim();
  if (city.length < 2) {
    errors.city = "Enter your city.";
  }

  const zip = String(values.zip || "").trim();
  if (zip.length < 3) {
    errors.zip = "Enter a ZIP or postal code.";
  }

  const country = String(values.country || "").trim();
  if (country.length < 2) {
    errors.country = "Enter your country.";
  }

  return errors;
}

export default function CheckoutPage() {
  const [delivery, setDelivery] = useState("standard");
  const [payment, setPayment] = useState("paystack");
  const [items, setItems] = useState([]);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formSummaryError, setFormSummaryError] = useState("");

  const shipping = delivery === "express" ? 1000 : 0;
  const itemsTotal = useMemo(
    () =>
      items.reduce(
        (s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 0),
        0
      ),
    [items]
  );
  const totalNaira = itemsTotal + shipping;

  /** Paystack expects amount in the smallest currency unit (kobo for NGN). */
  const amountKobo = Math.max(100, Math.round(totalNaira * 100));

  const fmt = (n) =>
    `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await fetch(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: "customer" }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.bool && result.data && typeof result.data === "object") {
        const email = typeof result.data.email === "string" ? result.data.email.trim() : "";
        const sessionName =
          typeof result.data.name === "string" ? result.data.name.trim() : "";
        if (email) setCheckoutEmail((prev) => (prev.trim() ? prev : email));
        if (sessionName) setFullName((prev) => (prev.trim() ? prev : sessionName));
      }
    } catch {
      /* keep email empty */
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadCart = useCallback(async () => {
    setCartError("");
    setAuthRequired(false);
    setCartLoading(true);
    try {
      const res = await fetch("/api/cart", {
        method: "GET",
        headers: buyerAuthHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setItems([]);
        setAuthRequired(true);
        return;
      }
      if (!res.ok) {
        setItems([]);
        setCartError(typeof data.error === "string" ? data.error : "Could not load your cart.");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
      setCartError("Could not load your cart.");
    } finally {
      setCartLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  const paystackBase = useMemo(
    () => ({
      publicKey: PAYSTACK_PUBLIC_KEY,
      currency: "NGN",
    }),
    []
  );

  // removed `usePaystackPayment` to avoid server-side `window` access during build

  const bump = async (cartLineId, delta) => {
    const row = items.find((r) => String(r.id) === String(cartLineId));
    if (!row) return;
    const q = Math.max(1, Math.min(99, (Number(row.quantity) || 1) + delta));
    const prev = items;
    setItems((rows) =>
      rows.map((r) =>
        String(r.id) === String(cartLineId) ? { ...r, quantity: q } : r
      )
    );
    try {
      const res = await fetch("/api/cart", {
        method: "PATCH",
        headers: buyerAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ cartLineId: Number(cartLineId), quantity: q }),
      });
      if (!res.ok) {
        setItems(prev);
      }
    } catch {
      setItems(prev);
    }
  };

  const removeLine = async (cartLineId) => {
    const prev = items;
    setItems((rows) => rows.filter((row) => String(row.id) !== String(cartLineId)));
    try {
      const res = await fetch(
        `/api/cart?cartLineId=${encodeURIComponent(String(cartLineId))}`,
        {
          method: "DELETE",
          headers: buyerAuthHeaders(),
          credentials: "include",
        }
      );
      if (!res.ok) setItems(prev);
    } catch {
      setItems(prev);
    }
  };

  const onSuccess = (reference) => {
    console.log(reference);
  };

  const onClose = () => {
    console.log("closed");
  };

  const clearFieldError = (key) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFormSummaryError("");
  };

  const handlePayClick = () => {
    setFormSummaryError("");
    if (totalNaira <= 0) return;

    const values = {
      fullName,
      checkoutEmail,
      phone,
      street,
      city,
      zip,
      country,
    };
    const errors = validateCheckoutFields(values);
    setFieldErrors(errors);

    const firstKeys = [
      "fullName",
      "checkoutEmail",
      "phone",
      "street",
      "city",
      "zip",
      "country",
    ];
    const firstInvalid = firstKeys.find((k) => errors[k]);
    if (firstInvalid) {
      setFormSummaryError("Please complete all fields correctly before paying.");
      const idMap = {
        fullName: "co-fullname",
        checkoutEmail: "co-email",
        phone: "co-phone",
        street: "co-street",
        city: "co-city",
        zip: "co-zip",
        country: "co-country",
      };
      requestAnimationFrame(() => {
        document.getElementById(idMap[firstInvalid])?.focus();
      });
      return;
    }

    const email = checkoutEmail.trim();
    const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
    const firstname = nameParts[0] ?? email.split("@")[0];
    const lastname = nameParts.slice(1).join(" ") || firstname;

    if (!paystackReady) {
      setFormSummaryError("Payment service not available. Try again in your browser.");
      return;
    }

    try {
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount: amountKobo,
        ref: `deedyte-co-${Date.now()}`,
        metadata: {
          custom_fields: [
            {
              display_name: "Shipping address",
              variable_name: "shipping_address",
              value: `${street.trim()}, ${city.trim()} ${zip.trim()}, ${country.trim()}`,
            },
          ],
        },
        callback: function (response) {
          onSuccess(response);
        },
        onClose: function () {
          onClose();
        },
      });
      handler.openIframe();
    } catch (e) {
      setFormSummaryError("Failed to initialize payment. Try again.");
    }
  };

  if (cartLoading || profileLoading) {
    return (
      <div className="co-page">
        <div className="co-body">
          <p className="co-title" style={{ marginTop: 24 }}>
            Loading checkout…
          </p>
        </div>
      </div>
    );
  }

  if (authRequired) {
    return (
      <div className="co-page">
        <div className="co-body">
          <h1 className="co-title">Checkout</h1>
          <p role="status" style={{ marginTop: 16 }}>
            Sign in to continue checkout.{" "}
            <a href="/auth/login?role=customer">Sign in</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="co-page">
      <div className="co-body">
        <h1 className="co-title">Checkout</h1>

        <div className="co-main">
          <div className="co-forms">
            <section className="co-section">
              <h2 className="co-section__title">Contact information</h2>
              {formSummaryError ? (
                <p className="co-field__error co-field__error--summary" role="alert">
                  {formSummaryError}
                </p>
              ) : null}
              <div className="co-field">
                <label className="co-label" htmlFor="co-fullname">
                  Full name
                </label>
                <input
                  id="co-fullname"
                  className={`co-input${fieldErrors.fullName ? " co-input--error" : ""}`}
                  placeholder="Jane Doe"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    clearFieldError("fullName");
                  }}
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  aria-describedby={fieldErrors.fullName ? "co-fullname-error" : undefined}
                />
                {fieldErrors.fullName ? (
                  <p id="co-fullname-error" className="co-field__error">
                    {fieldErrors.fullName}
                  </p>
                ) : null}
              </div>
              <div className="co-row">
                <div className="co-field">
                  <label className="co-label" htmlFor="co-email">
                    Email
                  </label>
                  <input
                    id="co-email"
                    type="email"
                    className={`co-input${fieldErrors.checkoutEmail ? " co-input--error" : ""}`}
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={checkoutEmail}
                    onChange={(e) => {
                      setCheckoutEmail(e.target.value);
                      clearFieldError("checkoutEmail");
                    }}
                    aria-invalid={Boolean(fieldErrors.checkoutEmail)}
                    aria-describedby={
                      fieldErrors.checkoutEmail ? "co-email-error" : undefined
                    }
                  />
                  {fieldErrors.checkoutEmail ? (
                    <p id="co-email-error" className="co-field__error">
                      {fieldErrors.checkoutEmail}
                    </p>
                  ) : null}
                </div>
                <div className="co-field">
                  <label className="co-label" htmlFor="co-phone">
                    Phone
                  </label>
                  <input
                    id="co-phone"
                    type="tel"
                    className={`co-input${fieldErrors.phone ? " co-input--error" : ""}`}
                    placeholder="+234 …"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      clearFieldError("phone");
                    }}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? "co-phone-error" : undefined}
                  />
                  {fieldErrors.phone ? (
                    <p id="co-phone-error" className="co-field__error">
                      {fieldErrors.phone}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="co-section">
              <h2 className="co-section__title">Shipping address</h2>
              <div className="co-field">
                <label className="co-label" htmlFor="co-street">
                  Street address
                </label>
                <input
                  id="co-street"
                  className={`co-input${fieldErrors.street ? " co-input--error" : ""}`}
                  placeholder="123 Main Street"
                  autoComplete="street-address"
                  value={street}
                  onChange={(e) => {
                    setStreet(e.target.value);
                    clearFieldError("street");
                  }}
                  aria-invalid={Boolean(fieldErrors.street)}
                  aria-describedby={fieldErrors.street ? "co-street-error" : undefined}
                />
                {fieldErrors.street ? (
                  <p id="co-street-error" className="co-field__error">
                    {fieldErrors.street}
                  </p>
                ) : null}
              </div>
              <div className="co-grid-2">
                <div className="co-field">
                  <label className="co-label" htmlFor="co-city">
                    City
                  </label>
                  <input
                    id="co-city"
                    className={`co-input${fieldErrors.city ? " co-input--error" : ""}`}
                    placeholder="Lagos"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      clearFieldError("city");
                    }}
                    aria-invalid={Boolean(fieldErrors.city)}
                    aria-describedby={fieldErrors.city ? "co-city-error" : undefined}
                  />
                  {fieldErrors.city ? (
                    <p id="co-city-error" className="co-field__error">
                      {fieldErrors.city}
                    </p>
                  ) : null}
                </div>
                <div className="co-field">
                  <label className="co-label" htmlFor="co-zip">
                    ZIP / Postal code
                  </label>
                  <input
                    id="co-zip"
                    className={`co-input${fieldErrors.zip ? " co-input--error" : ""}`}
                    placeholder="101241"
                    value={zip}
                    onChange={(e) => {
                      setZip(e.target.value);
                      clearFieldError("zip");
                    }}
                    aria-invalid={Boolean(fieldErrors.zip)}
                    aria-describedby={fieldErrors.zip ? "co-zip-error" : undefined}
                  />
                  {fieldErrors.zip ? (
                    <p id="co-zip-error" className="co-field__error">
                      {fieldErrors.zip}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="co-field">
                <label className="co-label" htmlFor="co-country">
                  Country
                </label>
                <input
                  id="co-country"
                  className={`co-input${fieldErrors.country ? " co-input--error" : ""}`}
                  placeholder="Nigeria"
                  autoComplete="country-name"
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    clearFieldError("country");
                  }}
                  aria-invalid={Boolean(fieldErrors.country)}
                  aria-describedby={fieldErrors.country ? "co-country-error" : undefined}
                />
                {fieldErrors.country ? (
                  <p id="co-country-error" className="co-field__error">
                    {fieldErrors.country}
                  </p>
                ) : null}
              </div>
            </section>

            <section className="co-section">
              <h2 className="co-section__title">Delivery options</h2>
              <button
                type="button"
                className={
                  delivery === "standard"
                    ? "co-delivery-option is-selected"
                    : "co-delivery-option"
                }
                onClick={() => setDelivery("standard")}
              >
                <div className="co-delivery-option__main">
                  <strong>Standard shipping</strong>
                  <span>Delivered in 5–7 days</span>
                </div>
                <span className="co-delivery-option__price">Free</span>
              </button>
              <button
                type="button"
                className={
                  delivery === "express"
                    ? "co-delivery-option is-selected"
                    : "co-delivery-option"
                }
                onClick={() => setDelivery("express")}
              >
                <div className="co-delivery-option__main">
                  <strong>Express shipping</strong>
                  <span>Delivered in 2–3 days</span>
                </div>
                <span className="co-delivery-option__price">₦1,000</span>
              </button>
            </section>

            <section className="co-section">
              <h2 className="co-section__title">Payment method</h2>
              {["paystack"].map((id) => (
                <div key={id}>
                  <button
                    type="button"
                    className={
                      payment === id ? "co-pay-row is-selected" : "co-pay-row"
                    }
                    onClick={() => setPayment(id)}
                  >
                    <span className="co-pay-row__label">
                      {id === "paystack" && "Paystack"}
                    </span>
                    <span className="co-pay-row__label" style={{ opacity: 0.6 }}>
                      {id === "paystack" && ""}
                    </span>
                  </button>
                </div>
              ))}
            </section>
          </div>

          <aside className="co-summary" aria-label="Order summary">
            <h2 className="co-summary__title">Order summary</h2>
            {cartError ? (
              <p className="co-line__name" role="alert">
                {cartError}
              </p>
            ) : null}
            {!cartError && items.length === 0 ? (
              <p className="co-line__name">Your cart is empty.</p>
            ) : null}
            {items.map((item) => {
              const unit = Number(item.price) || 0;
              const q = Number(item.quantity) || 1;
              const thumb =
                Array.isArray(item.images) && item.images[0]
                  ? item.images[0]
                  : "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=200&h=200&fit=crop&q=80";
              return (
                <div key={item.id} className="co-line">
                  <img className="co-line__thumb" src={thumb} alt="" />
                  <div className="co-line__body">
                    <div className="co-line__top">
                      <p className="co-line__name">{item.name || "Item"}</p>
                      <span className="co-line__price">{fmt(unit * q)}</span>
                    </div>
                    <div className="co-line__bottom">
                      <div className="co-qty">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => void bump(item.id, -1)}
                        >
                          −
                        </button>
                        <span>{String(q).padStart(2, "0")}</span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => void bump(item.id, 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="co-remove"
                        onClick={() => void removeLine(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="co-totals">
              <div className="co-totals__row">
                <span>Shipping</span>
                <span>{shipping === 0 ? "Free" : fmt(shipping)}</span>
              </div>
              <div className="co-totals__row co-totals__row--total">
                <span>Total</span>
                <span>{fmt(totalNaira)}</span>
              </div>
            </div>
            <button
              onClick={handlePayClick}
              type="button"
              className="co-cta"
              disabled={items.length === 0 || totalNaira <= 0}
            >
              Continue to payment
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
