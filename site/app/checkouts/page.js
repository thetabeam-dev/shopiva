"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IoCheckmarkCircle, IoLockClosed } from "react-icons/io5";
import "./styles/xxl.css";
import "./styles/s.css";
import "../styles/xxl.css";
import CustomerHeader from "@/components/customers/Header";
import { API_BACKEND, buyerAuthHeaders } from "@/reusables/shopBackendAuth";
import {
  estimateLocationShipping,
  evaluateDeliveryState,
  listAllDeliveryStates,
  normalizeShopDelivery,
  parseShopId,
} from "@/lib/vendorDelivery";

const AUTH_URL = "/api/user/authorization";

const PAYSTACK_PUBLIC_KEY =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY) ||
  "pk_test_9d54d1840154258f2371f52ac12b73e19b25dad";

function isValidEmail(s) {
  const t = String(s || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

function digitCount(s) {
  return (String(s || "").match(/\d/g) || []).length;
}

function isVideoUrl(url) {
  return /\.(mp4|webm|mov|m4v|ogv|ogg|avi|mkv)(\?|#|$)/i.test(String(url || ""));
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
  const [items, setItems] = useState([]);
  const [shopDeliveries, setShopDeliveries] = useState([]);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [selectedDeliveryKey, setSelectedDeliveryKey] = useState("");
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

  const shopIdsKey = useMemo(() => {
    const ids = [...new Set(items.map((item) => parseShopId(item.shopId)).filter(Boolean))];
    ids.sort((a, b) => a - b);
    return ids.join(",");
  }, [items]);

  const cartShops = useMemo(() => {
    const qtyByShop = new Map();
    const nameByShop = new Map();
    for (const item of items) {
      const shopId = parseShopId(item.shopId);
      if (!shopId) continue;
      qtyByShop.set(shopId, (qtyByShop.get(shopId) || 0) + Math.max(1, Number(item.quantity) || 1));
      if (item.shopName && !nameByShop.has(shopId)) {
        nameByShop.set(shopId, String(item.shopName));
      }
    }
    return [...qtyByShop.entries()].map(([shopId, itemCount]) => ({
      shopId,
      itemCount,
      shopName: nameByShop.get(shopId) || `Shop ${shopId}`,
      delivery: shopDeliveries.find((row) => row.shopId === shopId) || null,
    }));
  }, [items, shopDeliveries]);

  const deliveryStates = useMemo(() => listAllDeliveryStates(cartShops), [cartShops]);

  const coverage = useMemo(
    () => (selectedDeliveryKey ? evaluateDeliveryState(cartShops, selectedDeliveryKey) : null),
    [cartShops, selectedDeliveryKey]
  );

  const selectedDelivery = coverage?.allSupported ? coverage.location : null;
  const shipping = selectedDelivery
    ? Number(estimateLocationShipping(selectedDelivery, items) ?? selectedDelivery.checkoutFee) || 0
    : 0;

  const totals = useMemo(() => {
    return items.reduce(
      (acc, row) => {
        const qty = Number(row.quantity) || 0;
        const price = Number(row.price) || 0;
        const compare = Number(row.compareAtPrice) || 0;
        const list = compare > price ? compare : price;
        acc.itemsTotal += list * qty;
        acc.discount += Math.max(0, list - price) * qty;
        acc.payable += price * qty;
        acc.units += qty;
        return acc;
      },
      { itemsTotal: 0, discount: 0, payable: 0, units: 0 }
    );
  }, [items]);

  const totalNaira = totals.payable + shipping;
  const amountKobo = Math.max(100, Math.round(totalNaira * 100));

  const fmt = (n) =>
    `₦${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;

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
    if (typeof document === "undefined") return;
    if (document.querySelector("script[data-paystack-inline]")) return;
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.setAttribute("data-paystack-inline", "true");
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  useEffect(() => {
    const ids = shopIdsKey ? shopIdsKey.split(",").map((id) => Number(id)) : [];
    if (!ids.length) {
      setShopDeliveries([]);
      setDeliveryLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setDeliveryLoading(true);
      const next = [];
      await Promise.all(
        ids.map(async (shopId) => {
          try {
            const res = await fetch(`${API_BACKEND}/storefront/delivery/${shopId}`);
            const data = await res.json().catch(() => null);
            if (!res.ok) return;
            const normalized = normalizeShopDelivery(data);
            if (normalized) next.push(normalized);
          } catch {
            /* shop without delivery zones */
          }
        })
      );
      if (!cancelled) {
        setShopDeliveries(next);
        setDeliveryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopIdsKey]);

  useEffect(() => {
    if (!selectedDeliveryKey) return;
    if (!deliveryStates.some((loc) => loc.key === selectedDeliveryKey)) {
      setSelectedDeliveryKey("");
    }
  }, [deliveryStates, selectedDeliveryKey]);

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
    if (!selectedDeliveryKey) {
      errors.delivery = "Select a delivery state.";
    } else if (coverage && !coverage.allSupported) {
      errors.delivery = "Not all shops in this order ship to the selected state.";
    } else if (!deliveryLoading && items.length > 0 && deliveryStates.length === 0) {
      errors.delivery = "Vendors in this cart have not set delivery states yet.";
    }
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
    const firstInvalid = firstKeys.find((k) => errors[k]) || (errors.delivery ? "delivery" : "");
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
        delivery: "co-delivery-state",
      };
      requestAnimationFrame(() => {
        document.getElementById(idMap[firstInvalid])?.focus();
      });
      return;
    }

    const email = checkoutEmail.trim();

    if (typeof window === "undefined" || !window.PaystackPop) {
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
              value: `${street.trim()}, ${city.trim()} ${zip.trim()}, ${country.trim()}${
                selectedDelivery ? ` · ${selectedDelivery.name}` : ""
              }`,
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

  function Field({ id, label, error, children }) {
    return (
      <div className="co-field">
        <label className="co-label" htmlFor={id}>
          {label}
        </label>
        {children}
        {error ? (
          <p id={`${id}-error`} className="co-field__error">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  const shippingLabel = !selectedDeliveryKey
    ? "Select state"
    : coverage && !coverage.allSupported
      ? "Unavailable"
      : shipping === 0
        ? "FREE"
        : fmt(shipping);

  return (
    <div className="co-shell">
      <div className="buyer-head">
        <CustomerHeader />
      </div>
      <div className="co-page">
        <div className="co-safe" role="note">
          <IoLockClosed size={14} />
          15-day no update refund
        </div>
        <nav className="co-crumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>›</span>
          <span>Checkout</span>
        </nav>

        {cartLoading || profileLoading ? (
          <div className="co-status co-status--loader" role="status" aria-label="Loading">
            <span
              className="site-process-loader__spinner"
              style={{ borderColor: "#ededed", borderTopColor: "#00926e" }}
            />
          </div>
        ) : authRequired ? (
          <p className="co-status" role="status">
            Sign in to continue checkout.
          </p>
        ) : (
          <div className="co-layout">
            <div className="co-main">
              <div className="co-ship">
                <span>
                  <IoCheckmarkCircle size={18} />
                  Free shipping special for you
                </span>
                <small>Limited-time offer</small>
              </div>

              {formSummaryError ? (
                <p className="co-field__error co-field__error--summary" role="alert">
                  {formSummaryError}
                </p>
              ) : null}

              <section className="co-panel" aria-labelledby="co-address-title">
                  <div className="co-panel__head">
                    <h2 id="co-address-title">Shipping address</h2>
                  </div>
                  <Field id="co-fullname" label="Full name" error={fieldErrors.fullName}>
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
                    />
                  </Field>
                  <div className="co-row">
                    <Field id="co-email" label="Email" error={fieldErrors.checkoutEmail}>
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
                      />
                    </Field>
                    <Field id="co-phone" label="Phone" error={fieldErrors.phone}>
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
                      />
                    </Field>
                  </div>
                  <Field id="co-street" label="Street address" error={fieldErrors.street}>
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
                    />
                  </Field>
                  <div className="co-grid-2">
                    <Field id="co-city" label="City" error={fieldErrors.city}>
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
                      />
                    </Field>
                    <Field id="co-zip" label="ZIP / Postal code" error={fieldErrors.zip}>
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
                      />
                    </Field>
                  </div>
                  <div className="co-grid-2">
                    <Field id="co-country" label="Country" error={fieldErrors.country}>
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
                      />
                    </Field>
                    <Field id="co-delivery-state" label="Delivery state" error={fieldErrors.delivery}>
                      <select
                        id="co-delivery-state"
                        className={`co-input${fieldErrors.delivery ? " co-input--error" : ""}`}
                        value={selectedDeliveryKey}
                        disabled={deliveryLoading || deliveryStates.length === 0}
                        onChange={(e) => {
                          setSelectedDeliveryKey(e.target.value);
                          clearFieldError("delivery");
                        }}
                        aria-invalid={Boolean(fieldErrors.delivery)}
                      >
                        <option value="">
                          {deliveryLoading
                            ? "Loading states…"
                            : deliveryStates.length
                              ? "Select a state"
                              : "No delivery states available"}
                        </option>
                        {deliveryStates.map((loc) => (
                          <option key={loc.key} value={loc.key}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  {coverage ? (
                    <p
                      className={`co-coverage${coverage.allSupported ? " is-ok" : " is-warn"}`}
                      role="status"
                    >
                      {coverage.allSupported
                        ? `All shops in this order ship to ${coverage.name}.`
                        : `Not all shops ship to ${coverage.name}. These shops do not deliver there: ${coverage.unsupported.join(", ")}.`}
                    </p>
                  ) : (
                    <p className="co-delivery-hint">
                      Select a delivery state to see whether every shop in this order ships there.
                    </p>
                  )}
              </section>

              <section className="co-items" aria-labelledby="co-items-title">
                <div className="co-panel__head">
                  <h2 id="co-items-title">Item details ({totals.units})</h2>
                  <Link href="/cart">View all ›</Link>
                </div>
                {cartError ? (
                  <p className="co-status" role="alert">
                    {cartError}
                  </p>
                ) : null}
                {!cartError && items.length === 0 ? (
                  <p className="co-status">Your cart is empty.</p>
                ) : null}
                <div className="co-items__rail">
                  {items.map((item) => {
                    const unit = Number(item.price) || 0;
                    const compare = Number(item.compareAtPrice) || 0;
                    const thumb =
                      item.thumbnail ||
                      (Array.isArray(item.images) && item.images[0] ? item.images[0] : "");
                    const href = item.productId ? `/${item.productId}` : "/cart";
                    return (
                      <Link key={String(item.id)} href={href} className="co-item">
                        <div className="co-item__thumb">
                          {thumb && (item.thumbnailIsVideo || isVideoUrl(thumb)) ? (
                            <video src={thumb} muted loop playsInline autoPlay preload="metadata" />
                          ) : thumb ? (
                            <img src={thumb} alt="" />
                          ) : null}
                        </div>
                        <p className="co-item__was">
                          {compare > unit ? <s>{fmt(compare)}</s> : null}
                        </p>
                        <p className="co-item__now">{fmt(unit)}</p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            </div>

            <aside className="co-summary" aria-label="Order summary">
              <h2>Order summary</h2>
              <dl>
                <div>
                  <dt>Item(s) total:</dt>
                  <dd>{fmt(totals.itemsTotal)}</dd>
                </div>
                {totals.discount > 0 ? (
                  <div>
                    <dt>Item(s) discount:</dt>
                    <dd className="is-off">-{fmt(totals.discount)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Subtotal:</dt>
                  <dd>{fmt(totals.payable)}</dd>
                </div>
                <div>
                  <dt>Shipping:</dt>
                  <dd className={selectedDelivery && shipping === 0 ? "is-free" : ""}>
                    {shippingLabel}
                  </dd>
                </div>
              </dl>
              <div className="co-summary__total">
                <span>Order total:</span>
                <strong>{fmt(totalNaira)}</strong>
              </div>
              <p className="co-summary__legal">
                By submitting your order, you agree to our Terms of Use and acknowledge that you have read our Privacy Policy.
              </p>
              <button
                onClick={handlePayClick}
                type="button"
                className="co-cta"
                disabled={items.length === 0 || totalNaira <= 0 || !selectedDelivery}
              >
                Submit order ({totals.units})
              </button>
              <p className="co-summary__lock">
                <IoLockClosed size={14} />
                You will not be charged until you review this order.
              </p>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
