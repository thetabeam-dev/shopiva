"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getVendorsOnMapByCategory } from "../../../lib/productApi";
import "./styles/s.css";
import "./styles/xxl.css";
import Select from "react-select";
import {
  NIGERIAN_STATE_OPTIONS,
  buyerStateMatchesVendorState,
} from "../geoUtils";

import logo from "../../../images/Deedyte.png";

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

function LocationIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M12 13.5C13.933 13.5 15.5 11.933 15.5 10C15.5 8.067 13.933 6.5 12 6.5C10.067 6.5 8.5 8.067 8.5 10C8.5 11.933 10.067 13.5 12 13.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 21C15.8 17.8 18.5 14.4 18.5 10.3C18.5 6.7 15.6 4 12 4C8.4 4 5.5 6.7 5.5 10.3C5.5 14.4 8.2 17.8 12 21Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
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
    if (!category) {
      setErr("Pick a category on the home map, then open this list again.");
      setLoading(false);
      return;
    }
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
            {
              [1,2,3,4].map((product, index) => (
                <img key={index} tyle={{
                  height: "12px",
                  width: "12px"
                }} src={""} alt="" className="product-img" />
              ))
            }
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
                window.location.href = `/customer/store/${vendor.slug}`;
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
      <div className="customer-vendor-page-header">
        <img className="inscription" src={logo.src} alt="" />

        <h3 className="customer-vendor-page-category" style={{textTransform: "capitalize", color: "#00926e"}}>{category}</h3>
        
        
        <div className="customer-vendor-page-locale-filter">
          <button
            type="button"
            className="customer-vendor-page-locale-filter__mobile-btn"
            onClick={() => setIsLocationSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isLocationSheetOpen}
            aria-label={selectedState ? `Change location: ${selectedState.label}` : "Select location"}
          >
            <LocationIcon />
          </button>
          <div className="customer-vendor-page-locale-filter__desktop-select">
            <Select
              inputId="customer-vendors-state"
              instanceId="customer-vendors-state"
              options={stateSelectOptions}
              value={selectedState}
              onChange={setSelectedState}
              placeholder="Select location"
              isClearable
              isSearchable
              formatOptionLabel={formatStateOptionLabel}
              getOptionValue={(o) => o.value}
            />
          </div>
        </div>
        {/* <small>Viewing {rows.length} vendors in your state</small> */}
      </div>
      {/* <Link href="/customer" className="customer-vendors-page__back">
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
