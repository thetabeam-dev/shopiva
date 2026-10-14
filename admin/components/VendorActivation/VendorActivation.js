"use client";

import { useEffect, useState } from "react";
import "./style.css";

const PAGE_SIZE = 25;

async function fetchVendorPage(page, channel, productCount) {
  const params = new URLSearchParams({
    page,
    pageSize: String(PAGE_SIZE),
    channel,
  });
  if (productCount !== "all") params.set("productCount", productCount);
  const response = await fetch(
    `/api/admin/email-automation/shops-without-products?${params.toString()}`,
  );
  const json = await response.json();
  if (!response.ok) {
    const error = new Error(
      json?.error || "Unable to load vendor activation data.",
    );
    error.status = response.status;
    throw error;
  }
  return json;
}

export default function VendorActivation() {
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState("email");
  const [productCount, setProductCount] = useState("all");
  const [data, setData] = useState([]);
  const [totalShops, setTotalShops] = useState(0);
  const [totalVendors, setTotalVendors] = useState(0);
  const [campaignEligibleVendors, setCampaignEligibleVendors] = useState(0);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    fetchVendorPage(page, channel, productCount)
      .then((payload) => {
        if (!active) return;
        setData(payload.data || []);
        setTotalShops(payload.totalShops || 0);
        setTotalVendors(payload.totalVendors || 0);
        setCampaignEligibleVendors(payload.campaignEligibleVendors || 0);
        setError("");
      })
      .catch((loadError) => {
        if (!active) return;
        setData([]);
        setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, channel, productCount, refreshKey]);

  const selectedEntries = Object.values(selected);
  const selectedEligibleEntries = selectedEntries.filter(
    (entry) => entry.campaignEligible,
  );
  const selectedIneligibleCount =
    selectedEntries.length - selectedEligibleEntries.length;
  const pageCount = Math.max(1, Math.ceil(totalShops / PAGE_SIZE));
  const contactLabel =
    channel === "email" ? "email address" : "WhatsApp number";

  function changeChannel(nextChannel) {
    setLoading(true);
    setChannel(nextChannel);
    setSelected({});
    setResult(null);
    setError("");
    setPage(1);
  }

  function changeProductCount(value) {
    setLoading(true);
    setProductCount(value);
    setSelected({});
    setResult(null);
    setError("");
    setPage(1);
  }

  function toggleVendor(row) {
    setSelected((current) => {
      const next = { ...current };
      if (next[row.userId]) {
        delete next[row.userId];
      } else {
        next[row.userId] = {
          userId: row.userId,
          contact: channel === "email" ? row.email : row.ownerPhone,
          campaignEligible: row.campaignEligible,
        };
      }
      return next;
    });
    setResult(null);
  }

  function selectCurrentPage() {
    setSelected((current) => {
      const next = { ...current };
      data.forEach((row) => {
        next[row.userId] = {
          userId: row.userId,
          contact: channel === "email" ? row.email : row.ownerPhone,
          campaignEligible: row.campaignEligible,
        };
      });
      return next;
    });
    setResult(null);
  }

  async function submitCampaign() {
    setSending(true);
    setError("");
    try {
      const response = await fetch(
        "/api/admin/email-automation/shops-without-products",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userIds: selectedEligibleEntries.map((entry) => entry.userId),
            channel,
            requestId: window.crypto.randomUUID(),
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload?.error || "Campaign submission failed.");
      setResult(payload);
      setSelected({});
      setShowConfirmation(false);
      setLoading(true);
      setRefreshKey((value) => value + 1);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="activation-page">
      <header className="activation-header">
        <div>
          <span className="activation-kicker">VENDOR LIFECYCLE</span>
          <h1>Vendor Activation</h1>
          <p>Shops with 0–5 products</p>
        </div>
      </header>

      <div className="activation-stats" aria-label="Vendor activation summary">
        <article className="activation-stat">
          <span>Shops without products</span>
          <strong>{loading ? "—" : totalShops.toLocaleString()}</strong>
        </article>
        <article className="activation-stat">
          <span>Unique vendors</span>
          <strong>{loading ? "—" : totalVendors.toLocaleString()}</strong>
        </article>
        <article className="activation-stat activation-stat--accent">
          <span>
            {channel === "email" ? "Email" : "WhatsApp"} campaign eligible
          </span>
          <strong>
            {loading ? "—" : campaignEligibleVendors.toLocaleString()}
          </strong>
        </article>
      </div>

      <div
        className="activation-channel"
        role="group"
        aria-label="Campaign channel"
      >
        <button
          type="button"
          className={channel === "email" ? "is-active" : ""}
          aria-pressed={channel === "email"}
          onClick={() => changeChannel("email")}
        >
          Email
        </button>
        <button
          type="button"
          className={channel === "whatsapp" ? "is-active" : ""}
          aria-pressed={channel === "whatsapp"}
          onClick={() => changeChannel("whatsapp")}
        >
          WhatsApp
        </button>
      </div>

      <label className="activation-product-filter">
        <span>Products uploaded</span>
        <select
          value={productCount}
          onChange={(event) => changeProductCount(event.target.value)}
        >
          <option value="all">Any count (0–5)</option>
          {[0, 1, 2, 3, 4, 5].map((count) => (
            <option value={String(count)} key={count}>
              {count} product{count === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <div className="activation-alert" role="alert">
          {error}
        </div>
      )}
      {result && (
        <div className="activation-result" role="status">
          Campaign submitted: {result.sent} sent, {result.failed} failed,{" "}
          {result.skipped} skipped.
        </div>
      )}

      <div className="activation-toolbar">
        <label className="activation-select-all">
          <input
            type="checkbox"
            checked={
              data.length > 0 && data.every((row) => selected[row.userId])
            }
            onChange={(event) => {
              if (event.target.checked) {
                selectCurrentPage();
                return;
              }
              setSelected((current) => {
                const next = { ...current };
                data.forEach((row) => delete next[row.userId]);
                return next;
              });
            }}
            disabled={!data.length || loading}
          />
          <span>Select all shops on this page</span>
        </label>
        <div className="activation-actions">
          <span>
            {selectedEntries.length} selected · {selectedEligibleEntries.length}{" "}
            eligible
            {selectedIneligibleCount
              ? ` · ${selectedIneligibleCount} excluded`
              : ""}
          </span>
          <button
            type="button"
            className="activation-button activation-button--primary"
            disabled={!selectedEligibleEntries.length || sending}
            onClick={() => setShowConfirmation(true)}
          >
            Send {channel === "email" ? "Email" : "WhatsApp"} Campaign
          </button>
        </div>
      </div>

      <div className="activation-table-wrap" aria-busy={loading}>
        <table className="activation-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Select</span>
              </th>
              <th scope="col">Vendor email</th>
              <th scope="col">Owner WhatsApp number</th>
              <th scope="col">Shop name</th>
              <th scope="col">Shop ID</th>
              <th scope="col">Products uploaded</th>
              <th scope="col">Campaign status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="7" className="activation-empty">
                  Loading vendor shops…
                </td>
              </tr>
            )}
            {!loading &&
              data.map((row) => (
                <tr key={row.shopId}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.email}`}
                      checked={Boolean(selected[row.userId])}
                      disabled={sending}
                      onChange={() => toggleVendor(row)}
                    />
                  </td>
                  <td className="activation-email">{row.email}</td>
                  <td>{row.ownerPhone || "Not provided"}</td>
                  <td>{row.shopName}</td>
                  <td className="activation-id">{row.shopId}</td>
                  <td>
                    <span className="activation-product-count">
                      {row.productCount}
                    </span>
                  </td>
                  <td>
                    {row.campaignEligible ? (
                      <span className="activation-consent">Eligible</span>
                    ) : (
                      <span className="activation-ineligible">
                        {row.ineligibleReason}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            {!loading && !data.length && !error && (
              <tr>
                <td colSpan="7" className="activation-empty">
                  No entrepreneur-owned shops match this product-count filter.
                </td>
              </tr>
            )}
            {!loading && !data.length && error && (
              <tr>
                <td colSpan="7" className="activation-empty">
                  Vendor data is unavailable.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="activation-pagination">
        <span>
          Page {page} of {pageCount}
        </span>
        <div>
          <button
            type="button"
            className="activation-button"
            disabled={page <= 1 || loading}
            onClick={() => {
              setLoading(true);
              setError("");
              setPage((value) => value - 1);
            }}
          >
            Previous
          </button>
          <button
            type="button"
            className="activation-button"
            disabled={page >= pageCount || loading}
            onClick={() => {
              setLoading(true);
              setError("");
              setPage((value) => value + 1);
            }}
          >
            Next
          </button>
        </div>
      </footer>

      {showConfirmation && (
        <div className="activation-modal-backdrop">
          <section
            className="activation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-confirm-title"
          >
            <button
              type="button"
              className="activation-modal-close"
              aria-label="Close"
              onClick={() => setShowConfirmation(false)}
            >
              ×
            </button>
            <span className="activation-kicker">FINAL REVIEW</span>
            <h2 id="campaign-confirm-title">
              Send vendor activation{" "}
              {channel === "email" ? "email" : "WhatsApp message"}?
            </h2>
            <p>
              {selectedEligibleEntries.length} unique {contactLabel}
              {selectedEligibleEntries.length === 1 ? "" : "s"} will be
              submitted.{" "}
              {selectedIneligibleCount
                ? `${selectedIneligibleCount} selected contact${selectedIneligibleCount === 1 ? "" : "s"} excluded by eligibility rules.`
                : ""}
            </p>
            <ul className="activation-recipient-list">
              {selectedEligibleEntries.map((entry) => (
                <li key={entry.userId}>{entry.contact}</li>
              ))}
            </ul>
            <div className="activation-modal-actions">
              <button
                type="button"
                className="activation-button"
                disabled={sending}
                onClick={() => setShowConfirmation(false)}
              >
                Back
              </button>
              <button
                type="button"
                className="activation-button activation-button--primary"
                disabled={sending}
                onClick={submitCampaign}
              >
                {sending ? "Submitting…" : "Confirm and send"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
