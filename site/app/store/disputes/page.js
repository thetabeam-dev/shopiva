"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import backSvg from "@/svgs/backward-arrow-svgrepo-com.svg";
import { formatDisplayDate } from "@/lib/formatDisplayDate";
import { API_BACKEND, buyerAuthHeaders } from "@/reusables/shopBackendAuth";
import "./styles/s.css";
import "./styles/xxl.css";

const DISPUTE_THUMB =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#e8e4dc"/><path fill="#92400e" d="M48 22L58 38h20l-14 12 5 18-15-9-15 9 5-18-14-12h20z"/></svg>`
  );

const MOBILE_APP_DOWNLOAD_URL = "https://play.google.com/store/apps";

function isClosedStatus(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  return (
    s.includes("resolved") ||
    s.includes("closed") ||
    s.includes("won") ||
    s.includes("lost") ||
    s.includes("denied") ||
    s.includes("dismissed") ||
    s.includes("refunded")
  );
}

function isOpenDisputeStatus(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  if (!s) return false;
  return !isClosedStatus(s);
}

/**
 * @param {Record<string, unknown>} row
 */
function mapApiOrderToDisputeCard(row) {
  const orderId = row.order_id != null && String(row.order_id).trim() !== ""
    ? String(row.order_id)
    : row.orderId != null
      ? String(row.orderId)
      : "";
  const rawStatus = row.status ?? row.state ?? row.dispute_status;
  const statusLabel =
    typeof rawStatus === "string" && rawStatus.trim() ? rawStatus.trim() : "Dispute open";
  const reason =
    (typeof row.reason === "string" && row.reason.trim()) ||
    (typeof row.title === "string" && row.title.trim()) ||
    (typeof row.product === "string" && row.product.trim()) ||
    "Dispute raised for this order";
  const created =
    row.created_at ?? row.createdAt ?? row.date ?? row.opened_at ?? row.created ?? null;
  return {
    id: orderId || String(row.id ?? "").trim(),
    orderNo: orderId,
    reason,
    thumb: DISPUTE_THUMB,
    status: "open",
    statusLabel,
    createdAt: created,
  };
}

function shortReason(value) {
  const s = String(value || "").trim();
  if (!s) return "Dispute raised for this order";
  if (s.length <= 96) return s;
  return `${s.slice(0, 93)}...`;
}

export default function BuyerDisputesPage() {
  const [disputes, setDisputes] = useState([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError("");
      try {
        const res = await fetch(`${API_BACKEND}/buyer/disputes`, {
          method: "GET",
          credentials: "include",
          headers: buyerAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setDisputes([]);
          setLoadError(
            typeof data.error === "string" && data.error
              ? data.error
              : "Could not load disputes."
          );
          return;
        }
        const rows = Array.isArray(data.disputes) ? data.disputes : [];
        setDisputes(
          rows
            .filter((row) => isOpenDisputeStatus(row?.status ?? row?.state ?? row?.dispute_status))
            .map(mapApiOrderToDisputeCard)
            .filter((d) => d.id)
        );
      } catch {
        if (!cancelled) {
          setDisputes([]);
          setLoadError("Could not load disputes.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openDisputes = useMemo(() => {
    const openList = [];
    for (const d of disputes) {
      if (d.status !== "closed") openList.push(d);
    }
    return openList;
  }, [disputes]);

  return (
    <div className="ord-page" style={{background: "#f9f9f9", height: "100%", overflow: "auto"}}>
      <header className="ord-mheader" aria-label="Disputes">
        <Link href="/" className="ord-mheader__back" aria-label="Back">
          <img src={backSvg.src} alt="" width={20} height={20} />
        </Link>
        <h1 className="ord-mheader__title">Disputes</h1>
      </header>

      <div className="ord-main">
        <h1 className="ord-title ord-title--desktop">Disputes</h1>
        <p className="dsp-subtitle">Open disputes tied to your customer account.</p>

        {loadError ? (
          <p className="ord-empty" role="alert">
            {loadError}
          </p>
        ) : null}

        <ul className="ord-list">
          {openDisputes.map((d) => (
            <li key={d.id} className="ord-card" id={`dispute-${d.id}`}>
              <div className="ord-card__thumb-wrap">
                <img
                  className="ord-card__thumb"
                  src={d.thumb}
                  alt=""
                  width={96}
                  height={96}
                />
              </div>
              <div className="ord-card__body">
                <div className="ord-card__primary">
                  <div className="ord-card-meta">
                    <div className="dsp-card-field">
                      <span className="dsp-card-field__label">Order ref</span>
                      <span className="dsp-card-field__value">
                        {d.orderNo ? `#${d.orderNo}` : "—"}
                      </span>
                    </div>
                    <div className="dsp-card-field">
                      <span className="dsp-card-field__label">Dispute status</span>
                      <span className="dsp-card-field__value">
                        <span
                          className="ord-badge ord-badge--open"
                          aria-label={`Status: ${d.statusLabel}`}
                        >
                          {String(d.statusLabel || "Open").toUpperCase()}
                        </span>
                      </span>
                    </div>
                  </div>
                 
                  <div className="dsp-card-field">
                    <span className="dsp-card-field__label">Short reason</span>
                    <span className="dsp-card-field__value">{shortReason(d.reason)}</span>
                  </div>
                </div>
                <div className="ord-card__secondary" >
                  <div className="dsp-card-field">
                    <span className="dsp-card-field__label">Date raised</span>
                    <span className="dsp-card-field__value">
                      {d.createdAt ? formatDisplayDate(d.createdAt) : "—"}
                    </span>
                  </div>
                  <Link
                    href={MOBILE_APP_DOWNLOAD_URL}
                    className="dsp-card-cta"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View details
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {!loadError && openDisputes.length === 0 ? (
          <p className="ord-empty">No open disputes tied to your account.</p>
        ) : null}
      </div>
    </div>
  );
}
