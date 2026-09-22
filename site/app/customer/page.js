
"use client"
/**
 * Customer Home Page
 * 
 * Main landing page for customers.
 * Redirects to appropriate dashboard or displays landing content.
 * 
 * @module app/customer/page
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "./styles/xxl.css";

const CustomerHomeMap = dynamic(() => import("./CustomerHomeMap"), { ssr: false });
import "./styles/s.css"
import Select from "react-select";
import mvp_data from "../../json/mvp_category.json";
import locationIcon from "../../svgs/target-3-svgrepo-com.svg";
import logo from "../../images/Deedyte.png";
import {
  stateKeyFromNominatimData,
  haversineKm,
  buyerStateMatchesVendorState,
} from "./geoUtils";
const categoryOptions = Object.keys(mvp_data).map((key) => ({
  value: key,
  label: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase(),
}));



const categorySelectStyles = {
  container: (base) => ({
    ...base,
    width: "100%",
    maxWidth: "100%",
  }),
  control: (base) => ({
    ...base,
    width: "100%",
    minHeight: 32,
    minWidth: "100%",
    paddingTop: 0,
    paddingBottom: 0,
    boxSizing: "border-box",
  }),
  valueContainer: (base) => ({
    ...base,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 10,
    paddingRight: 6,
  }),
  indicatorsContainer: (base) => ({
    ...base,
    minHeight: 28,
    height: 28,
    alignSelf: "center",
  }),
  dropdownIndicator: (base) => ({ ...base, padding: 4 }),
  clearIndicator: (base) => ({ ...base, padding: 4 }),
  input: (base) => ({ ...base, margin: 0, paddingTop: 0, paddingBottom: 0 }),
  placeholder: (base) => ({ ...base, lineHeight: 1.25, margin: 0 }),
  singleValue: (base) => ({ ...base, lineHeight: 1.25, margin: 0 }),
  menu: (base) => ({ ...base, width: "100%", minWidth: "100%" }),
  menuList: (base) => ({ ...base, maxHeight: 280 }),
};

/**
 * Reverse geocode via Nominatim from buyer lat/lng: display label + normalized state for vendor matching.
 * `zoom` biases results toward state-level admin boundaries.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{ label: string, stateKey: string }>}
 */
function buildLabelFromNominatim(data) {
  const a = data.address || {};
  const line1 = a.city || a.town || a.village || a.suburb || a.hamlet || a.neighbourhood || "";
  const line2 = a.state || a.region || a.county || "";
  const country = a.country || "";
  const parts = [line1, line2, country].filter((p) => p && String(p).trim());
  if (parts.length) return parts.join(", ");
  if (typeof data.display_name === "string" && data.display_name.trim()) {
    return data.display_name.split(",").slice(0, 3).join(",").trim();
  }
  return "";
}

async function reverseGeocodeAddress(lat, lon) {
  const fetchReverse = async (zoom) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&format=json&zoom=${zoom}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "DeedyteCustomerMap/1.0 (contact: support@deedyte.com)",
      },
    });
    if (!res.ok) throw new Error("Geocode request failed");
    const data = await res.json().catch(() => ({}));
    const label = buildLabelFromNominatim(data);
    const stateKey = stateKeyFromNominatimData(data);
    return { data, label, stateKey };
  };

  let { data, label, stateKey } = await fetchReverse(10);
  const cc = (data.address?.country_code || "").toString().toLowerCase();
  if (!stateKey && cc === "ng") {
    try {
      const wider = await fetchReverse(5);
      if (wider.stateKey) {
        stateKey = wider.stateKey;
        if (wider.label) label = wider.label;
      }
    } catch {
      /* keep first response */
    }
  }

  if (!label) throw new Error("No address in response");
  return { label, stateKey };
}

function geolocationErrorMessage(code) {
  if (code === 1) return "Location access was denied. Allow location in your browser settings, or type an area above.";
  if (code === 2) return "Your position could not be determined. Try again or enter a location manually.";
  if (code === 3) return "Location request timed out. Try again.";
  return "Could not read your location. Try again or type an area above.";
}

/** On desktop Wi-Fi geolocation, anything beyond this is often city-level guesswork. */
const MAX_ACCEPTABLE_ACCURACY_METERS = 1200;

/**
 * One-shot browser geolocation (same strategy as the map target control).
 * @returns {Promise<GeolocationPosition>}
 */
function fetchGeolocationPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(Object.assign(new Error("unsupported"), { code: 0 }));
      return;
    }
    const SAMPLE_MS = 4000;
    const HARD_TIMEOUT_MS = 35000;
    const GOOD_ACCURACY_METERS = 60;
    let settled = false;
    let sampleTimer = null;
    let hardTimer = null;
    let bestPos = null;
    let bestAccuracy = Number.POSITIVE_INFINITY;
    const accuracyMeters = (pos) =>
      typeof pos?.coords?.accuracy === "number" && Number.isFinite(pos.coords.accuracy)
        ? pos.coords.accuracy
        : Number.POSITIVE_INFINITY;

    const cleanup = () => {
      navigator.geolocation.clearWatch(watchId);
      if (sampleTimer != null) clearTimeout(sampleTimer);
      if (hardTimer != null) clearTimeout(hardTimer);
    };

    const succeed = (pos) => {
      if (settled) return;
      settled = true;
      cleanup();
      const acc = accuracyMeters(pos);
      if (Number.isFinite(acc) && acc > MAX_ACCEPTABLE_ACCURACY_METERS) {
        reject(
          Object.assign(new Error("low_accuracy"), {
            code: 2,
            accuracyMeters: Math.round(acc),
          })
        );
        return;
      }
      resolve(pos);
    };

    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const consider = (pos) => {
      const acc = accuracyMeters(pos);
      if (acc < bestAccuracy) {
        bestAccuracy = acc;
        bestPos = pos;
      }
      if (acc <= GOOD_ACCURACY_METERS) {
        succeed(pos);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      consider,
      (err) => {
        if (err?.code === 1) fail(err);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );

    sampleTimer = setTimeout(() => {
      if (settled) return;
      if (bestPos) {
        succeed(bestPos);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        succeed,
        fail,
        { enableHighAccuracy: false, timeout: 25000, maximumAge: 60000 }
      );
    }, SAMPLE_MS);

    hardTimer = setTimeout(() => {
      if (settled) return;
      if (bestPos) {
        succeed(bestPos);
        return;
      }
      fail(Object.assign(new Error("timeout"), { code: 2 }));
    }, HARD_TIMEOUT_MS);
  });
}

/** Top-level JSON values are arrays of objects; collect unique subcategory keys (e.g. clothing, jewelry). */
function subcategoryKeysForTopLevel(data, topKey) {
  const bucket = data?.[topKey];
  if (!Array.isArray(bucket)) return [];
  const seen = new Set();
  for (const obj of bucket) {
    if (obj && typeof obj === "object") {
      Object.keys(obj).forEach((k) => seen.add(k));
    }
  }
  return Array.from(seen).sort();
}

// ============================================================================
// HOME PAGE COMPONENT
// ============================================================================

/**
 * Customer home page component
 *
 * @returns {JSX.Element} The home page content
 */
export default function Home() {
  const router = useRouter();
  const [locale, setLocale] = useState("");
  const [geo, setGeo] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryGateError, setCategoryGateError] = useState("");
  const [vendorsOnMap, setVendorsOnMap] = useState([]);
  const [vendorsMapLoading, setVendorsMapLoading] = useState(false);
  const [vendorsMapError, setVendorsMapError] = useState("");
  const [mapExploreSession, setMapExploreSession] = useState(0);
  const [buyerStateNormalized, setBuyerStateNormalized] = useState("");
  const [locateSession, setLocateSession] = useState(0);
  const watchIdRef = useRef(null);
  /** Last coordinates we used for a successful state lookup (throttle watchPosition). */
  const lastGeocodedPositionRef = useRef(null);

  const requireCategorySelected = useCallback(() => {
    if (!selectedCategory?.value) {
      setCategoryGateError(
        "Please select a category before exploring vendors or using location on the map."
      );
      return false;
    }
    setCategoryGateError("");
    return true;
  }, [selectedCategory]);

  const stopWatching = useCallback(() => {
    if (typeof navigator === "undefined" || watchIdRef.current == null) return;
    navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
  }, []);

  useEffect(() => () => stopWatching(), [stopWatching]);

  useEffect(() => {
    setVendorsOnMap([]);
    setVendorsMapError("");
  }, [selectedCategory?.value]);

  const subcategoryKeys = selectedCategory?.value
    ? subcategoryKeysForTopLevel(mvp_data, selectedCategory.value)
    : [];

  const handleUseCurrentLocation = useCallback(() => {
    if (!requireCategorySelected()) return;

    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationError("Location is not supported in this browser. Type an area above.");
      return;
    }

    setLocationError("");
    setLocationLoading(true);

    const applyPosition = async (pos) => {
      const { latitude, longitude } = pos.coords;
      setGeo({ lat: latitude, lng: longitude });
      try {
        const { label, stateKey } = await reverseGeocodeAddress(latitude, longitude);
        setLocale(label);
        setBuyerStateNormalized(stateKey);
        lastGeocodedPositionRef.current = { lat: latitude, lng: longitude };
      } catch {
        setLocale(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setBuyerStateNormalized("");
        lastGeocodedPositionRef.current = null;
      } finally {
        setLocationLoading(false);
        setLocateSession((s) => s + 1);
      }
      stopWatching();
      watchIdRef.current = navigator.geolocation.watchPosition(
        (p) => {
          const { latitude: la, longitude: lo } = p.coords;
          setGeo({ lat: la, lng: lo });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
      );
    };

    const onError = (err) => {
      stopWatching();
      setLocationLoading(false);
      setGeo(null);
      setBuyerStateNormalized("");
      lastGeocodedPositionRef.current = null;
      if (Number.isFinite(err?.accuracyMeters)) {
        setLocationError(
          `Location is too coarse (~${err.accuracyMeters}m). In Chrome on macOS, allow precise location, stay on Wi-Fi for a few seconds, and try again.`
        );
        return;
      }
      setLocationError(geolocationErrorMessage(err.code));
    };

    fetchGeolocationPosition().then(applyPosition).catch(onError);
  }, [stopWatching, requireCategorySelected]);

  /**
   * When GPS updates, re-derive state from lat/lng (debounced, skip tiny jitter moves).
   */
  useEffect(() => {
    if (
      geo == null ||
      !Number.isFinite(geo.lat) ||
      !Number.isFinite(geo.lng)
    ) {
      return undefined;
    }
    const last = lastGeocodedPositionRef.current;
    if (last && haversineKm(last, geo) < 0.25) {
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { stateKey, label } = await reverseGeocodeAddress(geo.lat, geo.lng);
        if (cancelled) return;
        lastGeocodedPositionRef.current = { lat: geo.lat, lng: geo.lng };
        if (stateKey) setBuyerStateNormalized(stateKey);
        setLocale((prev) => {
          const coordsOnly = /^\s*-?\d+\.\d+,\s*-?\d+\.\d+\s*$/.test(prev || "");
          if (coordsOnly || !prev) return label;
          return prev;
        });
      } catch {
        /* keep previous buyerStateNormalized */
      }
    }, 1200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [geo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (buyerStateNormalized) {
      sessionStorage.setItem("deedyte_buyer_state", buyerStateNormalized);
    }
  }, [buyerStateNormalized]);

  const handleExploreVendors = useCallback(() => {
    if (!requireCategorySelected()) return;
    const cat = selectedCategory?.value;
    if (!cat) return;
    /**
     * Map discovery paused for now:
     * - no geolocation lookup
     * - no nearby map search
     * - direct route to vendor shops list by category
     */
    router.push(`/customer/vendors?category=${encodeURIComponent(cat)}`);
  }, [requireCategorySelected, selectedCategory, router]);

  const vendorsForMap = useMemo(() => {
    const buyerKey = buyerStateNormalized;
    return vendorsOnMap.map((v) => ({
      ...v,
      sameState: buyerStateMatchesVendorState(buyerKey, v.state),
    }));
  }, [vendorsOnMap, buyerStateNormalized]);

  const vendorsInStateCount = useMemo(
    () => vendorsForMap.filter((v) => v.sameState).length,
    [vendorsForMap]
  );

  const discoverFabSummary = useMemo(() => {
    const n = vendorsOnMap.length;
    const s = vendorsInStateCount;
    if (n === 0) return "";
    const found = n === 1 ? "1 vendor found" : `${n} vendors found`;
    let inStatePhrase;
    if (s === 0) {
      inStatePhrase = n === 1 ? "none is in your state" : "none are in your state";
    } else if (s === 1) {
      inStatePhrase = "1 is in your state";
    } else {
      inStatePhrase = `${s} are in your state`;
    }
    return `${found} & ${inStatePhrase}`;
  }, [vendorsOnMap.length, vendorsInStateCount]);

  const discoverHref =
    selectedCategory?.value != null && selectedCategory.value !== ""
      ? `/customer/vendors?category=${encodeURIComponent(selectedCategory.value)}${
          buyerStateNormalized
            ? `&state=${encodeURIComponent(buyerStateNormalized)}`
            : ""
        }`
      : "/customer/vendors";

  return (
    <div className="customer-home-page" style={{background: "transparent"}}>
      {/* <img className="inscription" src={logo.src} alt="" /> */}

      {/* <div className="customer-home-page__map-wrap">
        <button
          type="button"
          disabled={locationLoading}
          onClick={handleUseCurrentLocation}
          className="locator"
          aria-label="Use your current location on the map"
        >
          <img src={locationIcon.src} alt="" width={22} height={22} />
        </button>
        <CustomerHomeMap
          position={geo}
          locateSession={locateSession}
          vendors={vendorsForMap}
          exploreSession={mapExploreSession}
        />
        {vendorsOnMap.length > 0 ? (
          <Link
            href={discoverHref}
            className="customer-discovered-vendors-fab"
            aria-label={discoverFabSummary}
          >
            <img src={locationIcon.src} alt="" width={22} height={22} />
            <span className="customer-discovered-vendors-fab__text">
              {discoverFabSummary}
            </span>
          </Link>
        ) : null}
      </div> */}

      <div className="customer-home-page__overlay" style={{background: "transparent"}}>
        {/* <div className="customer-home-page__hero">
          <h5>Delivery straight to your doorstep — within minutes.</h5>
        </div> */}

        <div className="customer-home-tools-cnt" style={{background: "transparent", justifyContent: "center"}}>
          <h2 style={{color: "#fff"}}>Delivery straight to your doorstep — within minutes.</h2>
          <br />
          <div className="input-cnt input-cnt--category-select">
            <label htmlFor="category"><h4 style={{color: "#fff"}}>What category of product do you like?</h4></label>
            <br />
            <Select
              inputId="category"
              classNamePrefix="customer-category-select"
              className="customer-category-select"
              styles={categorySelectStyles}
              options={categoryOptions}
              value={selectedCategory}
              onChange={(option) => {
                setSelectedCategory(option ?? null);
                setCategoryGateError("");
                setVendorsMapError("");
              }}
              placeholder="Search and select category"
              isClearable
              isSearchable
            />
          </div>
          {categoryGateError ? (
            <p className="customer-category-gate-warning" role="alert">
              {categoryGateError}
            </p>
          ) : null}
          {vendorsMapError ? (
            <p className="customer-vendors-map-warning" role="status">
              {vendorsMapError}
            </p>
          ) : null}
          {/* <br /> */}
          {/* {subcategoryKeys.length > 0 ? (
            <>
              <style>{`
                @keyframes customer-subcat-marquee-scroll {
                  from { transform: translateX(0); }
                  to { transform: translateX(-50%); }
                }
                .customer-subcat-marquee-viewport {
                  overflow: hidden;
                  width: 100%;
                }
                .customer-subcat-marquee-track {
                  display: flex;
                  width: max-content;
                  animation: customer-subcat-marquee-scroll 90s linear infinite;
                }
                .customer-subcat-marquee-track > ul {
                  display: flex;
                  flex-direction: row;
                  align-items: center;
                  justify-content: flex-start;
                  gap: 10px;
                  list-style-type: none;
                  margin: 0;
                  padding: 0 8px;
                  flex-shrink: 0;
                  width: auto;
                }
                .customer-subcat-marquee-track ul li {
                  margin: 0;
                }
                @media (prefers-reduced-motion: reduce) {
                  .customer-subcat-marquee-track {
                    animation: none;
                  }
                }
              `}</style>
              <div className="customer-subcat-marquee-viewport">
                <div className="customer-subcat-marquee-track">
                  <ul>
                    {subcategoryKeys.map((key) => (
                      <li key={`marquee-a-${key}`}>{key}</li>
                    ))}
                  </ul>
                  <ul aria-hidden="true">
                    {subcategoryKeys.map((key) => (
                      <li key={`marquee-b-${key}`}>{key}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          ) : null} */}


        </div>
        <div className="submit_btn" style={{background: "transparent"}}>
          <button
            type="button"
            onClick={handleExploreVendors}
            disabled={vendorsMapLoading}
          >
            {vendorsMapLoading ? "Loading vendors…" : "Explore vendors"}
          </button>
        </div>
      </div>
    </div>
  );
}
