"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "./styles/global.css";
import "./styles/s.css";
// import "./styles/m.css";
// import "./styles/l.css";
import "./styles/xxl.css";
import logo_img from "../../../images/Deedyte.png";
import {
  getTopLevelCategoryOptions,
  humanizeCategoryKey,
} from "../../../reusables/getCategoryOptions";

const NAME_MAX = 255;
const SLUG_MAX = 255;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SHOP_CATEGORIES = 3;

function toCategoryLabel(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  return text
    .split(/[\s_]+/)
    .map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}` : word))
    .join(" ");
}

/** Normalize GET /categories rows or static JSON into { value, label }[]. */
function normalizeCategoryOptions(rows) {
  if (!Array.isArray(rows) || !rows.length) return getTopLevelCategoryOptions();
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    const value = String(row?.category ?? row?.value ?? row?.key ?? "")
      .trim()
      .toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push({
      value,
      label: toCategoryLabel(row?.label ?? value) || humanizeCategoryKey(value),
    });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out.length ? out : getTopLevelCategoryOptions();
}

/** Default location shape matching DB schema */
const DEFAULT_LOCATION = {
  address: null,
  city: null,
  state: null,
  country: null,
  zipcode: null,
  coordinates: null,
};

/** Reverse geocode using OpenStreetMap Nominatim (no API key) */
async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&format=json`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Deedyte-Vendor-App/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const a = data.address || {};
  return {
    address: data.display_name || null,
    city: a.city || a.town || a.village || a.municipality || null,
    state: a.state || a.region || null,
    country: a.country || null,
    zipcode: a.postcode || null,
    coordinates: { lat: Number(lat), lng: Number(lon) },
  };
}

function getCookie(name) {
  if (typeof document === "undefined") return null;
  const cookieName = `${name}=`;
  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.indexOf(cookieName) === 0) {
      return cookie.substring(cookieName.length, cookie.length);
    }
  }
  return null;
}

function slugify(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, SLUG_MAX) || "shop";
}

export default function ShopCreate() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState(() => getTopLevelCategoryOptions());
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [errors, setErrors] = useState({ name: "", slug: "", location: "", categories: "" });
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [screenWidth, setScreenWidth] = useState(0);

  useEffect(() => {
    const read = () => setScreenWidth(window.innerWidth);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  useEffect(() => {
    const token = getCookie("entrepreneur_secret");
    setIsLoggedIn(!!token);
    setIsAuthChecked(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCategoriesLoading(true);
      setCategoriesError("");
      try {
        const res = await fetch("/api/backend/categories", { credentials: "include" });
        if (!res.ok) throw new Error(`Could not load categories (${res.status}).`);
        const data = await res.json();
        if (cancelled) return;
        setCategoryOptions(normalizeCategoryOptions(data));
      } catch {
        if (cancelled) return;
        setCategoryOptions(getTopLevelCategoryOptions());
        setCategoriesError("Using built-in categories. Live list could not be loaded.");
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const deriveSlug = useCallback((shopName) => {
    return slugify(shopName);
  }, []);

  useEffect(() => {
    if (!slugTouched && name) setSlug(deriveSlug(name));
  }, [name, slugTouched, deriveSlug]);

  const hasLocation = location?.coordinates != null;

  const requestDeviceLocation = useCallback(() => {
    setLocationError("");
    setLocationLoading(true);
    if (!navigator.geolocation) {
      setLocationError("Location is not supported by your browser.");
      setLocationLoading(false);
      return;
    }

    // Geolocation requires a secure context (HTTPS or localhost). When debugging from phone via http://10.x.x.x, the browser denies without prompting.
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setLocationError(
        "Location requires a secure connection (HTTPS). You’re opening this page over HTTP, so the browser blocks location. When testing from your phone, use HTTPS (e.g. the same URL with https:// and a certificate, or a tunnel like ngrok) and try again."
      );
      setLocationLoading(false);
      return;
    }

    const onSuccess = async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const locale = await reverseGeocode(latitude, longitude);
        if (locale) {
          setLocation(locale);
          setErrors((prev) => ({ ...prev, location: "" }));
        } else {
          setLocation({
            ...DEFAULT_LOCATION,
            coordinates: { lat: latitude, lng: longitude },
          });
          setErrors((prev) => ({ ...prev, location: "" }));
        }
      } catch (err) {
        setLocation({
          ...DEFAULT_LOCATION,
          coordinates: { lat: latitude, lng: longitude },
        });
        setErrors((prev) => ({ ...prev, location: "" }));
      }
      setLocationLoading(false);
    };

    const showFinalError = (code) => {
      setLocationLoading(false);
      if (code === 1) {
        setLocationError(
          "Location was denied. If you’re testing from your phone over HTTP, use HTTPS instead (location only works on secure pages). Otherwise, allow location for this site in your browser or device settings and try again."
        );
      } else if (code === 2) {
        setLocationError(
          "Your device couldn’t determine your position. Try moving to a window or outdoors, " +
            "enable location services in your system settings, then click “Use my location” again."
        );
      } else if (code === 3) {
        setLocationError("Location request timed out. Please try again.");
      } else {
        setLocationError("Could not get your location. Please try again.");
      }
    };

    // Use watchPosition from the start so we don’t fail on the first kCLErrorLocationUnknown.
    // CoreLocation often logs "location unknown" several times then delivers a fix; we wait for it.
    const WATCH_TIMEOUT_MS = 40000;
    let resolved = false;
    let timeoutId = null;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (resolved) return;
        resolved = true;
        navigator.geolocation.clearWatch(watchId);
        if (timeoutId != null) clearTimeout(timeoutId);
        onSuccess(position);
      },
      (err) => {
        if (resolved) return;
        if (err.code === 1) {
          resolved = true;
          navigator.geolocation.clearWatch(watchId);
          if (timeoutId != null) clearTimeout(timeoutId);
          showFinalError(1);
        }
        // Ignore code 2 (kCLErrorLocationUnknown) and 3 (timeout) – keep waiting for a fix
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 300000 }
    );
    timeoutId = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      navigator.geolocation.clearWatch(watchId);
      showFinalError(2);
    }, WATCH_TIMEOUT_MS);
  }, []);

  const toggleCategory = useCallback((value) => {
    setCategories((current) => {
      if (current.includes(value)) {
        return current.filter((item) => item !== value);
      }
      if (current.length >= MAX_SHOP_CATEGORIES) {
        setErrors((prev) => ({
          ...prev,
          categories: `A shop can have at most ${MAX_SHOP_CATEGORIES} categories.`,
        }));
        return current;
      }
      return [...current, value];
    });
    setErrors((prev) => ({ ...prev, categories: "" }));
  }, []);

  const validateForm = useCallback(() => {
    const next = { name: "", slug: "", location: "", categories: "" };
    if (!name.trim()) next.name = "Shop name is required.";
    else if (name.length > NAME_MAX) next.name = `Name must be ${NAME_MAX} characters or less.`;
    const s = slug.trim().toLowerCase();
    if (!s) next.slug = "Shop URL is required.";
    else if (s.length > SLUG_MAX) next.slug = `URL must be ${SLUG_MAX} characters or less.`;
    else if (!SLUG_REGEX.test(s)) next.slug = "Use only lowercase letters, numbers, and hyphens.";
    if (!hasLocation) next.location = "Please set your shop location using your device.";
    if (!categories.length) next.categories = "Select at least one category.";
    else if (categories.length > MAX_SHOP_CATEGORIES) {
      next.categories = `A shop can have at most ${MAX_SHOP_CATEGORIES} categories.`;
    }
    setErrors(next);
    return !next.name && !next.slug && !next.location && !next.categories;
  }, [name, slug, hasLocation, categories]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!validateForm()) return;
    const token = getCookie("entrepreneur_secret");
    if (!token) {
      setSubmitError("Please sign in to create a shop.");
      router.push("/entrepreneur/login");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/shop/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          description: description.trim() || undefined,
          category: categories,
          location,
        }),
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        setSubmitError(
          res.ok
            ? "Invalid response from server."
            : `Request failed (${res.status}). If this persists, ensure the Node API is running and NEXT_PUBLIC_BACKEND_URL in .env matches it, then restart npm run dev.`
        );
        return;
      }
      if (!res.ok) {
        setSubmitError(data?.error || `Request failed (${res.status}). Please try again.`);
        return;
      }
      router.push("/entrepreneur?shop=created");
    } catch (err) {
      const message = err?.message || "";
      if (message.includes("Failed to fetch") || message.includes("NetworkError") || message.includes("Load failed")) {
        setSubmitError(
          "Could not reach this app’s API. Check that Next.js is running. If the error persists, the server cannot reach your backend—set NEXT_PUBLIC_BACKEND_URL (e.g. http://localhost:3456 when Node runs on this machine) and restart npm run dev."
        );
      } else {
        setSubmitError(err?.message || "Could not create shop. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthChecked) {
    return (
      <div className="shop-cnt">
        <div className="right" style={{ width: "100%" }}>
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="shop-cnt">
        <div className="left">
          <img src={logo_img.src} alt="Deedyte" style={{ height: 50, width: 50 }} />
          <h2 className="shop-header">Create your shop</h2>
          <p className="shop-body">
            Sign in or sign up as a vendor to create your shop and start selling on Deedyte.
          </p>
        </div>
        <div className="right">
          <div className="input-cnt">
            <p style={{ marginBottom: 16 }}>You need to be signed in to create a shop.</p>
            <Link href="/entrepreneur/login" style={{ color: "#005c45", fontWeight: 600 }}>
              Sign in
            </Link>
            <span style={{ margin: "0 8px" }}>or</span>
            <Link href="/entrepreneur/signup" style={{ color: "#005c45", fontWeight: 600 }}>
              Sign up
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-cnt">
      <div className="left">
        <img src={logo_img.src} alt="Deedyte" style={{ height: 50, width: 50 }} />
        <h2 className="shop-header">Create your shop</h2>
        <p className="shop-body">
          Give your store a name and a short URL. You can add more details and verification later.
        </p>
      </div>
      <div className="right">
        <form onSubmit={handleSubmit} noValidate style={{ width: "100%", maxWidth: 420 }}>
          <h4
            style={{
              color: "#005c45",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {screenWidth > 0 && screenWidth <= 480 ? (
              <img
                src={logo_img.src}
                alt="Deedyte"
                width={50}
                height={50}
                style={{ height: 50, width: 50, flexShrink: 0 }}
              />
            ) : null}
            <b>New shop</b>
          </h4>
          <div className="input-cnt" style={{ marginBottom: 16 }}>
            <label htmlFor="shop-name">Shop name</label>
            <input
              id="shop-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
              }}
              placeholder="e.g. My Fashion Store"
              maxLength={NAME_MAX}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <span className="shop-err" role="alert">
                {errors.name}
              </span>
            )}
          </div>
          <div className="input-cnt" style={{ marginBottom: 16 }}>
            <label htmlFor="shop-slug">Shop URL</label>
            <input
              id="shop-slug"
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                setSlugTouched(true);
                if (errors.slug) setErrors((prev) => ({ ...prev, slug: "" }));
              }}
              onBlur={() => setSlugTouched(true)}
              placeholder="my-fashion-store"
              maxLength={SLUG_MAX}
              aria-invalid={!!errors.slug}
            />
            <span className="shop-hint">deedyte.com/store/{slug || "your-url"}</span>
            {errors.slug && (
              <span className="shop-err" role="alert">
                {errors.slug}
              </span>
            )}
          </div>
          <div className="input-cnt" style={{ marginBottom: 16 }}>
            <label>Shop location</label>
            <p className="shop-hint" style={{ marginBottom: 8 }}>
              We use your device location to set your shop&apos;s locale accurately. If the browser asks for permission, choose &quot;Allow&quot; to continue.
            </p>
            <button
              type="button"
              className="shop-location-btn"
              onClick={requestDeviceLocation}
              disabled={locationLoading}
            >
              {locationLoading ? "Getting location… (may take 10–40 sec)" : "Use my location"}
            </button>
            {locationError && (
              <span className="shop-err" role="alert" style={{ marginTop: 8 }}>
                {locationError}
              </span>
            )}
            {errors.location && (
              <span className="shop-err" role="alert">
                {errors.location}
              </span>
            )}
            {hasLocation && !locationLoading && (
              <div className="shop-location-summary" aria-live="polite">
                <span className="shop-location-check">✓</span>
                {location.address || (
                  <>Coordinates: {location.coordinates?.lat?.toFixed(5)}, {location.coordinates?.lng?.toFixed(5)}</>
                )}
              </div>
            )}
          </div>
          <div className="input-cnt" style={{ marginBottom: 16 }}>
            <label id="shop-categories-label">Categories</label>
            <p className="shop-hint" style={{ marginBottom: 8 }}>
              Select up to {MAX_SHOP_CATEGORIES} categories this shop sells.
            </p>
            {categoriesLoading ? (
              <p className="shop-hint">Loading categories…</p>
            ) : (
              <div
                className="shop-category-list"
                role="group"
                aria-labelledby="shop-categories-label"
              >
                {categoryOptions.map((opt) => {
                  const selected = categories.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className={`shop-category-option${selected ? " is-selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleCategory(opt.value)}
                        disabled={submitting}
                      />
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {categoriesError && !errors.categories && (
              <span className="shop-hint" style={{ marginTop: 8 }}>
                {categoriesError}
              </span>
            )}
            {errors.categories && (
              <span className="shop-err" role="alert">
                {errors.categories}
              </span>
            )}
          </div>
          <div className="input-cnt" style={{ marginBottom: 20 }}>
            <label htmlFor="shop-description">Description (optional)</label>
            <textarea
              id="shop-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your shop"
              rows={3}
            />
          </div>
          <div className="input-cnt">
            {submitError && (
              <span className="shop-err" role="alert" style={{ marginBottom: 8 }}>
                {submitError}
              </span>
            )}
            <button type="submit" disabled={submitting || categoriesLoading}>
              {submitting ? "Creating…" : "Create shop"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
