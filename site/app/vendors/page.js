"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getVendorsOnMapByCategory } from "../../lib/productApi";
import "./styles/s.css";
import "./styles/xxl.css";
import Select from "react-select";
import {
  NIGERIAN_STATE_OPTIONS,
  buyerStateMatchesVendorState,
} from "../geoUtils";
import { useRegisterVendorLocationFilter } from "../../layouts/Customer/vendorLocationFilterContext";


function EmptyVendorsIcon() {
  return (
    <svg
      width={56}
      height={56}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M3.5 9.5L5 5.5H19L20.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 9.5H20V19.5C20 20.05 19.55 20.5 19 20.5H5C4.45 20.5 4 20.05 4 19.5V9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 20.5V14.5H15V20.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4 9.5C4 11 5.2 12 6.7 12C8.2 12 9.2 11 9.2 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9.2 9.5C9.2 11 10.4 12 11.9 12C13.4 12 14.6 11 14.6 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M14.6 9.5C14.6 11 15.8 12 17.3 12C18.8 12 20 11 20 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExploreArrowIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M14.6470979,6.30372605 L14.7197247,6.21961512 C14.9860188,5.95337607 15.402685,5.92921307 15.6962739,6.14709787 L15.7803849,6.21972471 L20.7769976,11.21737 C21.0430885,11.4835159 21.0673924,11.8999028 20.8498298,12.1934928 L20.777305,12.2776129 L15.7806923,17.2810585 C15.4879993,17.5741518 15.0131257,17.5744763 14.7200324,17.2817833 C14.453584,17.0156987 14.4290932,16.5990517 14.646747,16.3052914 L14.7193077,16.2211234 L18.4301989,12.504 L3.75019891,12.504946 C3.37050315,12.504946 3.05670795,12.2227922 3.00704553,11.8567166 L3.00019891,11.754946 C3.00019891,11.3752503 3.28235279,11.0614551 3.64842835,11.0117927 L3.75019891,11.004946 L18.4431989,11.004 L14.7196151,7.28027529 C14.4533761,7.01398122 14.4292131,6.59731504 14.6470979,6.30372605 L14.7197247,6.21961512 L14.6470979,6.30372605 Z"
      />
    </svg>
  );
}

function VendorsDiscoverContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category")?.trim() || "";
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  /**
   * Do not auto-filter by buyer state on page open; users expect all discovered
   * vendors first, then optional filtering via the dropdown.
   */
  const [selectedState, setSelectedState] = useState(null);
  const [isLocationSheetOpen, setIsLocationSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await getVendorsOnMapByCategory(category);
        if (!cancelled) setRows(v);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Could not load vendors.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category]);

  const displayedRows = useMemo(() => {
    if (!selectedState?.value) return rows;
    return rows.filter((v) =>
      buyerStateMatchesVendorState(selectedState.value, v.state)
    );
  }, [rows, selectedState]);

  const vendorCountByStateKey = useMemo(() => {
    const counts = new Map();
    for (const o of NIGERIAN_STATE_OPTIONS) {
      let n = 0;
      for (const v of rows) {
        if (buyerStateMatchesVendorState(o.value, v.state)) n += 1;
      }
      counts.set(o.value, n);
    }
    return counts;
  }, [rows]);

  const stateSelectOptions = useMemo(() => {
    return [...NIGERIAN_STATE_OPTIONS].sort((a, b) => {
      const na = vendorCountByStateKey.get(a.value) ?? 0;
      const nb = vendorCountByStateKey.get(b.value) ?? 0;
      if (nb !== na) return nb - na;
      return a.label.localeCompare(b.label);
    });
  }, [vendorCountByStateKey]);

  const formatStateOptionLabel = useCallback(
    (option) => {
      const n = vendorCountByStateKey.get(option.value) ?? 0;
      return `${option.label} (${n})`;
    },
    [vendorCountByStateKey]
  );

  const handleStateChange = useCallback((option) => {
    setSelectedState(option ?? null);
    setIsLocationSheetOpen(false);
  }, []);

  const locationFilter = useMemo(
    () => ({
      selectedState,
      stateSelectOptions,
      isLocationSheetOpen,
      setIsLocationSheetOpen,
      formatStateOptionLabel,
      onChange: handleStateChange,
    }),
    [
      selectedState,
      stateSelectOptions,
      isLocationSheetOpen,
      formatStateOptionLabel,
      handleStateChange,
    ],
  );

  useRegisterVendorLocationFilter(locationFilter);

  useEffect(() => {
    if (!isLocationSheetOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isLocationSheetOpen]);

  const renderVendorCard = useCallback((vendor, index) => {


    return(
      <>
        <div className="vendor-card" key={index}>
          <div className="vendor-card-product-img-cnt">
            {Array.from({ length: 4 }, (_, imageIndex) => {
              const product = Array.isArray(vendor.products) ? vendor.products[imageIndex] : null;
              if (product?.thumbnail_url) {
                return (
                  <img
                    key={`${vendor.id}-${imageIndex}`}
                    src={product.thumbnail_url}
                    alt=""
                    className="product-img"
                  />
                );
              }
              return (
                <div
                  key={`${vendor.id}-placeholder-${imageIndex}`}
                  className="product-img product-img--placeholder"
                  aria-hidden
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 16.5L8.2 12.3C8.6 11.9 9.2 11.9 9.6 12.3L13 15.7L14.6 14.1C15 13.7 15.6 13.7 16 14.1L20 18.1"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 6.5H20V17.5C20 18.05 19.55 18.5 19 18.5H5C4.45 18.5 4 18.05 4 17.5V6.5Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <circle cx="8.5" cy="10" r="1.2" fill="currentColor" />
                  </svg>
                </div>
              );
            })}
          </div>
          <div className="vendor-card-details-cnt">
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between"
            }}>
              {/* <img src="" tyle={{
                height: "12px",
                width: "12px"
              }} alt="" className="vendor-img" /> */}
              <h5 className="vendor-name" style={{color: "#00926e"}}>{vendor.name}</h5>
              <small>Explore now</small>
            </div>

            <button
              type="button"
              className="explore-vendor-btn"
              onClick={() => {
                window.location.href = `/store/${vendor.slug}`;
              }}
              aria-label={`Open ${vendor.name}`}
            >
              <ExploreArrowIcon />
            </button>
          </div>
        </div>
      </>
    )
  })

  return (
    <div className="customer-vendors-page">
      {/* <Link href="/" className="customer-vendors-page__back">
        ← Back to map
      </Link>
      <h1>Discovered vendors</h1>
      <p className="customer-vendors-page__meta">
        {category ? `Category: ${category}` : "No category selected"}
      </p>
      {loading ? (
        <p className="customer-vendors-page__loading">Loading…</p>
      ) : null}
      {err ? (
        <p className="customer-vendors-page__error" role="alert">
          {err}
        </p>
      ) : null}
      {!loading && !err && rows.length === 0 ? (
        <p className="customer-vendors-page__empty">No vendors in this category.</p>
      ) : null}
      {!loading && !err && rows.length > 0 ? (
        <ul>
          {rows.map((v) => (
            <li key={v.id}>
              <p className="customer-vendors-page__shop-name">{v.name}</p>
              <p className="customer-vendors-page__shop-meta">
                {[v.address, v.city].filter(Boolean).join(" · ") ||
                  "Address not on file"}
                {v.state ? ` · ${v.state}` : ""}
                {v.slug ? ` · ${v.slug}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null} */}
      
      <div className="vendor-card-cnt">
        {displayedRows.map((vendor, index) =>
          renderVendorCard(vendor, index)
        )}

        {!loading && !err && displayedRows.length === 0 ? (
          <div
            style={{
              height: "100%",
              width: "100%",
              minHeight: "280px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              color: "#00926e",
              textAlign: "center",
              padding: "24px",
            }}
          >
            <EmptyVendorsIcon />
            <span style={{ color: "#3d3d3d", fontSize: "15px", maxWidth: "280px" }}>
              No available vendors at the moment.
            </span>
          </div>
        ) : null}
      </div>

      {isLocationSheetOpen ? (
        <div
          className="customer-vendor-locale-sheet-backdrop"
          role="presentation"
          onClick={() => setIsLocationSheetOpen(false)}
        >
          <div
            className="customer-vendor-locale-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Select location"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="customer-vendor-locale-sheet__grabber" aria-hidden />
            <div className="customer-vendor-locale-sheet__header">
              <h4>Select location</h4>
              <button
                type="button"
                className="customer-vendor-locale-sheet__close"
                onClick={() => setIsLocationSheetOpen(false)}
                aria-label="Close location selector"
              >
                ×
              </button>
            </div>
            <Select
              inputId="customer-vendors-state-mobile"
              instanceId="customer-vendors-state-mobile"
              options={stateSelectOptions}
              value={selectedState}
              onChange={handleStateChange}
              placeholder="Search and select location"
              isClearable
              // isSearchable={false}
              formatOptionLabel={formatStateOptionLabel}
              getOptionValue={(o) => o.value}
            />
          </div>
        </div>
      ) : null}

    </div>
  );
}

export default function CustomerVendorsPage() {
  return (
    <Suspense
      fallback={
        <div className="customer-vendors-page">
          <p className="customer-vendors-page__loading">Loading…</p>
        </div>
      }
    >
      <VendorsDiscoverContent />
    </Suspense>
  );
}
