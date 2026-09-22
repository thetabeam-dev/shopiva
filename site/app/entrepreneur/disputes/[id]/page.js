"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import "./styles/s.css"
import "./styles/xxl.css"

/** Placeholder detail — replace with API by dispute id */
const MOCK_DETAIL = {
  title: "Data Breach Incident",
  amountValue: 5500,
  amountCurrency: "NGN",
  status: "Open",
  deadlineText: "10 days to respond",
  created_at: "2024-03-12T14:30:00.000Z",
  customer: "Clara Hensley",
  ordered_at: "2024-03-10T11:20:00.000Z",
  delivery_at: "2024-03-15T00:00:00.000Z",
  lineItems: [{ name: "Enterprise Security Suite", quantity: 2, unitPrice: 2750 }],
  invoiceNo: "INV-HR-9811",
  order: "12842",
  customerNote:
    "Unauthorized access detected. Payment made but we did not initiate the transaction. Requesting urgent resolution.",
  disputeCategory: "Unauthorized or fraudulent charge",
  /** When true, category value uses success styling (e.g. clear-cut type) */
  disputeCategoryAccent: true,
  /** Amount held in escrow for this order; defaults to amountValue in the UI if omitted */
  escrowAmount: 5500,
  refundOption: "Full refund",
  customerAction: "Escalated with bank; requests reversal and account review",
  analysis: {
    account: {
      riskLevel: "LOW",
      fraudIndicators: "0 (None Detected)",
      accountStatus: "NORMAL",
      systemAnalysis: "Clean",
    },
    profile: {
      previousDisputes: "None",
      accountAge: "3+ years",
      purchaseEmail: "support@cybershield.com",
      customerType: "Trusted Partner",
    },
    expectationMismatch: {
      whatCustomerExpected:
        "Two Enterprise Security Suite seats as advertised: checkout completed by them only, payment held in escrow until delivery, then license keys and activation email.",
      whatCustomerGotInstead:
        "Escrow debited after a checkout session they report they did not complete; no license email, and their account shows a login from an unfamiliar device and region.",
    },
    evidence: {
      emailMatch: "Match",
      paymentSecurity: "Verified",
      /** ISO date for the order transaction; falls back to ordered_at in the UI */
      transactionAt: "2024-03-10T11:20:00.000Z",
      invoiceStatusLabel: "Invoice status",
      invoiceStatus: "Available",
      /** Customer-submitted images / video; `kind` optional if URL extension implies type */
      customerMedia: [
        {
          id: "ev-1",
          kind: "image",
          label: "Damaged outer box",
          url: "https://picsum.photos/seed/deedyte-ev1/1200/800",
        },
        {
          id: "ev-2",
          kind: "image",
          label: "Courier handoff at gate",
          url: "https://picsum.photos/seed/deedyte-ev2/1200/800",
        },
        {
          id: "ev-3",
          kind: "video",
          label: "Unboxing — fault visible",
          url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        },
        {
          id: "ev-4",
          kind: "image",
          label: "Serial number plate",
          url: "https://picsum.photos/seed/deedyte-ev4/800/1200",
        },
      ],
    },
  },
}

function formatAmount(value, currency) {
  const num = Number(value)
  if (Number.isNaN(num)) return "—"
  const cur = String(currency ?? "NGN").trim().toUpperCase() || "NGN"
  if (cur === "NGN") {
    const formatted = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num)
    return `₦${formatted}`
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: cur,
  }).format(num)
}

function formatDisputeOpenedAt(raw) {
  if (raw == null || String(raw).trim() === "") return "—"
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return String(raw)
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d)
}

function formatOrderDateOnly(raw) {
  if (raw == null || String(raw).trim() === "") return "—"
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return String(raw)
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(d)
}

function emailMatchIsPositive(raw) {
  const v = String(raw ?? "").trim().toLowerCase()
  return v === "match" || v === "full match" || v === "yes"
}

const EVIDENCE_IMAGE_URL = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|#|$)/i

function evidenceFileKind(item) {
  if (item?.kind === "image" || item?.kind === "video") return item.kind
  const u = String(item?.url ?? "").toLowerCase()
  if (u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov") || u.includes("type=video")) {
    return "video"
  }
  if (EVIDENCE_IMAGE_URL.test(u)) return "image"
  return "image"
}

function evidenceFormatLabel(item) {
  if (item?.format && String(item.format).trim()) return String(item.format).trim().toUpperCase()
  const u = String(item?.url ?? "")
  const ext = u.match(/\.([a-z0-9]+)(\?|#|$)/i)
  if (ext) return ext[1].toUpperCase()
  return evidenceFileKind(item) === "video" ? "VIDEO" : "IMAGE"
}

function disputeDetailStatusBadgeClass(status) {
  const v = String(status ?? "").toLowerCase()
  if (v.includes("resolved") || v.includes("closed") || v === "done") {
    return "dispute-detail-badge-status dispute-detail-badge-status--success"
  }
  if (v.includes("review") || v.includes("mediation") || v.includes("awaiting")) {
    return "dispute-detail-badge-status dispute-detail-badge-status--warning"
  }
  if (v.includes("open") || v.includes("pending")) {
    return "dispute-detail-badge-status dispute-detail-badge-status--info"
  }
  return "dispute-detail-badge-status dispute-detail-badge-status--neutral"
}

function disputeIdFromRoute(params, pathname) {
  const raw = params?.id
  if (raw != null && String(raw).trim() !== "") {
    try {
      return decodeURIComponent(String(raw))
    } catch {
      return String(raw)
    }
  }
  const m = typeof pathname === "string" ? pathname.match(/\/entrepreneur\/disputes\/([^/?#]+)/) : null
  if (!m?.[1]) return ""
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

export default function DisputeDetailPage() {
  const params = useParams()
  const pathname = usePathname()
  const disputeId = useMemo(() => disputeIdFromRoute(params, pathname), [params, pathname])

  const [noteDraft, setNoteDraft] = useState("")
  const [moreOpen, setMoreOpen] = useState(false)
  const [evidenceViewer, setEvidenceViewer] = useState(null)
  const moreWrapRef = useRef(null)

  const detail = MOCK_DETAIL
  const canSave = noteDraft.trim().length > 0

  useEffect(() => {
    if (!moreOpen) return
    const onDoc = (e) => {
      const el = moreWrapRef.current
      if (el && !el.contains(e.target)) setMoreOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [moreOpen])

  useEffect(() => {
    if (!evidenceViewer) return undefined
    const onKey = (e) => {
      if (e.key === "Escape") setEvidenceViewer(null)
    }
    document.addEventListener("keydown", onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [evidenceViewer])

  return (
    <>
      <div className="dispute-detail-narrow" role="status">
        <p className="dispute-detail-narrow-title">Dispute details</p>
        <p className="dispute-detail-narrow-text">
          Open this page on a large display (1200px or wider) for the full dispute workspace.
        </p>
      </div>

      <div className="dispute-detail-page">
        <Link href="/entrepreneur/disputes" className="dispute-detail-back">
          <span aria-hidden>←</span> Back
        </Link>

        <h1 className="dispute-detail-title">
          {detail.title}
          {disputeId ? (
            <span className="dispute-detail-title-id" title="Dispute reference">
              {" "}
              · {disputeId}
            </span>
          ) : null}
        </h1>

        <div className="dispute-detail-hero-row">
          {/* <p className="dispute-detail-amount">
            {formatAmount(detail.amountValue, detail.amountCurrency)}
          </p> */}
          <span className={disputeDetailStatusBadgeClass(detail.status)}>{detail.status ?? "—"}</span>
          
          <span className="dispute-detail-opened" title="Dispute opened">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <time dateTime={detail.created_at ? String(detail.created_at) : undefined}>
              {detail.created_at ? `Opened ${formatDisputeOpenedAt(detail.created_at)}` : "—"}
            </time>
          </span>
          <span className="dispute-detail-deadline">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {detail.deadlineText}
          </span>
        </div>

        <div className="dispute-detail-meta-grid">
          <div>
            <span className="dispute-detail-meta-label">Customer</span>
            <p className="dispute-detail-meta-value">{detail.customer}</p>
          </div>
          <div>
            <span className="dispute-detail-meta-label">Order date</span>
            <p className="dispute-detail-meta-value">
              {detail.ordered_at ? (
                <time dateTime={String(detail.ordered_at)}>{formatOrderDateOnly(detail.ordered_at)}</time>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <span className="dispute-detail-meta-label">Delivery date</span>
            <p className="dispute-detail-meta-value">
              {detail.delivery_at ? (
                <time dateTime={String(detail.delivery_at)}>{formatOrderDateOnly(detail.delivery_at)}</time>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <span className="dispute-detail-meta-label">Order no</span>
            <p className="dispute-detail-meta-value">
              {detail?.order != null && String(detail.order).trim() !== "" ? (
                <Link href={`/entrepreneur/orders/${encodeURIComponent(String(detail.order).trim())}`}>
                  #{String(detail.order).trim()}
                </Link>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div className="dispute-detail-meta-span" style={{padding: "unset"}}>
            {/* <span className="dispute-detail-meta-label">Items ordered</span> */}
            {Array.isArray(detail.lineItems) && detail.lineItems.length > 0 ? (
              <div className="dispute-detail-order-wrap">
                <table className="dispute-detail-order-table">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col" className="dispute-detail-order-th-num">
                        Qty
                      </th>
                      <th scope="col" className="dispute-detail-order-th-num">
                        Unit price
                      </th>
                      <th scope="col" className="dispute-detail-order-th-num">
                        total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lineItems.map((line, i) => {
                      const qty = Number(line.quantity)
                      const unit = Number(line.unitPrice)
                      const lineTotal =
                        Number.isFinite(qty) && Number.isFinite(unit) ? qty * unit : NaN
                      return (
                        <tr key={i}>
                          <td className="dispute-detail-order-td-item">{line.name ?? "—"}</td>
                          <td className="dispute-detail-order-td-num">
                            {Number.isFinite(qty) ? qty : "—"}
                          </td>
                          <td className="dispute-detail-order-td-num">
                            {formatAmount(line.unitPrice, detail.amountCurrency)}
                          </td>
                          <td className="dispute-detail-order-td-num dispute-detail-order-td-line-total">
                            {Number.isFinite(lineTotal)
                              ? formatAmount(lineTotal, detail.amountCurrency)
                              : "—"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="dispute-detail-meta-value">—</p>
            )}
          </div>
          {/* <div>
            <span className="dispute-detail-meta-label">Order total</span>
            <p className="dispute-detail-meta-value">
              {formatAmount(detail.amountValue, detail.amountCurrency)}
            </p>
          </div> */}
          
        </div>

        <section className="dispute-detail-note-section" aria-labelledby="customer-note-heading">
          <h2 id="customer-note-heading" className="dispute-detail-note-head">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 4h16v12H8l-4 4V4z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
            Customer note:
          </h2>
          <p className="dispute-detail-note-body">&ldquo;{detail.customerNote}&rdquo;</p>
        </section>

        <h2 className="dispute-detail-section-title">Dispute Analysis Summary</h2>
        <div className="dispute-detail-cards">
          <article className="dispute-detail-card">
            <h3 className="dispute-detail-card-head">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 3l7 4v5c0 5-3.5 9-7 11-3.5-2-7-6-7-11V7l7-4z" stroke="currentColor" strokeWidth="2" />
              </svg>
              Dispute Details
            </h3>

            
            
            <div className="dispute-detail-card-row">
              <span className="dispute-detail-card-label">Dispute reason</span>
              <span
                className={
                  detail.disputeCategoryAccent
                    ? "dispute-detail-card-value dispute-detail-text-success"
                    : "dispute-detail-card-value"
                }
              >
                {detail.disputeCategory ?? "—"}
              </span>
            </div>

            <div className="dispute-detail-card-row">
              <span className="dispute-detail-card-label">Item condition</span>
              <span
                className={
                  emailMatchIsPositive(detail.analysis?.evidence?.emailMatch)
                    ? "dispute-detail-card-value dispute-detail-text-success"
                    : "dispute-detail-card-value"
                }
              >
                Damaged
              </span>
            </div>
            <div className="dispute-detail-card-row">
              <span className="dispute-detail-card-label">Payment made to Escrow</span>
              <span className="dispute-detail-card-value">
                {formatAmount(detail.escrowAmount ?? detail.amountValue, detail.amountCurrency)}
              </span>
            </div>
            <div className="dispute-detail-card-row">
              <span className="dispute-detail-card-label">Customer preferred resolution</span>
              <span className="dispute-detail-card-value">{detail.refundOption ?? "—"}</span>
            </div>
            {/* <div className="dispute-detail-card-row">
              <span className="dispute-detail-card-label">Customer action</span>
              <span className="dispute-detail-card-value">{detail.customerAction ?? "—"}</span>
            </div> */}
          </article>

          <article className="dispute-detail-card">
            <h3 className="dispute-detail-card-head">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" />
              </svg>
              Evidence
            </h3>
            
            <div className="dispute-detail-card-row dispute-detail-card-row--media">
              <span className="dispute-detail-card-label">{"Customer photos & video"}</span>
              {Array.isArray(detail.analysis?.evidence?.customerMedia) &&
              detail.analysis.evidence.customerMedia.length > 0 ? (
                <ul
                  className="dispute-detail-media-gallery"
                  role="list"
                  aria-label="Photos and video evidence from the customer"
                >
                  {detail.analysis.evidence.customerMedia.map((item, idx) => {
                    const kind = evidenceFileKind(item)
                    const fmt = evidenceFormatLabel(item)
                    const label = item.label ?? item.filename ?? "Evidence"
                    return (
                      <li key={item.id ?? item.url ?? `media-${idx}`} className="dispute-detail-media-item">
                        <button
                          type="button"
                          className="dispute-detail-media-tile"
                          onClick={() => setEvidenceViewer(item)}
                          aria-haspopup="dialog"
                          aria-label={`Open ${kind === "video" ? "video" : "image"}: ${label}`}
                        >
                          <span className="dispute-detail-media-badge">{fmt}</span>
                          <div className="dispute-detail-media-frame">
                            {kind === "video" ? (
                              <div className="dispute-detail-media-thumb-video">
                                <svg
                                  className="dispute-detail-media-play-icon"
                                  width="48"
                                  height="48"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  aria-hidden
                                >
                                  <circle cx="12" cy="12" r="11" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.5)" />
                                  <path d="M10 8l8 4-8 4V8z" fill="#fff" />
                                </svg>
                              </div>
                            ) : (
                              <div className="dispute-detail-media-thumb-img-wrap">
                                <img
                                  src={item.url}
                                  alt=""
                                  className="dispute-detail-media-thumb-img"
                                  loading="lazy"
                                  decoding="async"
                                />
                              </div>
                            )}
                          </div>
                          <p className="dispute-detail-media-caption">{label}</p>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="dispute-detail-media-empty">No photos or video evidence provided.</p>
              )}
            </div>
            {/* <div className="dispute-detail-card-row">
              <span className="dispute-detail-card-label">
                {detail.analysis?.evidence?.invoiceStatusLabel ?? "Invoice"}
              </span>
              <div className="dispute-detail-invoice-actions">
                <span className="dispute-detail-card-value">{detail.analysis?.evidence?.invoiceStatus ?? "—"}</span>
                <button type="button" className="dispute-detail-download">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 4v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Download PDF
                </button>
              </div>
            </div> */}
          </article>

          <article className="dispute-detail-card">
            <h3 className="dispute-detail-card-head">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
                <path d="M6 20v-1a6 6 0 0 1 12 0v1" stroke="currentColor" strokeWidth="2" />
              </svg>
              Customer Expectation Mismatch
            </h3>
            <div className="dispute-detail-card-row">
              <span className="dispute-detail-card-label">What the customer expected</span>
              <span className="dispute-detail-card-value">
                {detail.analysis?.expectationMismatch?.whatCustomerExpected ?? "—"}
              </span>
            </div>
            <div className="dispute-detail-card-row">
              <span className="dispute-detail-card-label">What the customer got instead</span>
              <span className="dispute-detail-card-value">
                {detail.analysis?.expectationMismatch?.whatCustomerGotInstead ?? "—"}
              </span>
            </div>
            {/* <div className="dispute-detail-card-row">
              <span className="dispute-detail-card-label">Purchase email</span>
              <span className="dispute-detail-card-value">{detail.analysis?.profile?.purchaseEmail ?? "—"}</span>
            </div>
            <div className="dispute-detail-card-row">
              <span className="dispute-detail-card-label">Customer type</span>
              <span className="dispute-detail-card-value">{detail.analysis?.profile?.customerType ?? "—"}</span>
            </div> */}
          </article>
        </div>

        {/* <div className="dispute-detail-notes-grid">
          <section className="dispute-detail-notes-prev" aria-labelledby="prev-notes-heading">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden style={{ color: "#cbd5e1" }}>
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            <h2 id="prev-notes-heading" className="dispute-detail-notes-prev-title">
              No notes yet
            </h2>
            <p className="dispute-detail-notes-prev-sub">Internal notes will appear here once added.</p>
          </section>

          <section className="dispute-detail-notes-add" aria-labelledby="add-note-heading">
            <h2 id="add-note-heading" className="visually-hidden">
              Add note
            </h2>
            <div className="dispute-detail-notes-add-head">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Add note
            </div>
            <textarea
              className="dispute-detail-textarea"
              placeholder="Add a note for context, next steps, or internal escalation.."
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              aria-label="Internal note"
            />
            <div className="dispute-detail-save-row">
              <button type="button" className="dispute-detail-save" disabled={!canSave}>
                Save
              </button>
            </div>
          </section>
        </div> */}

        <div className="dispute-detail-fab-wrap" role="toolbar" aria-label="Dispute actions">
          <button type="button" className="dispute-detail-fab dispute-detail-fab--accept">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Accept
          </button>
          <button type="button" className="dispute-detail-fab dispute-detail-fab--secondary">
            Submit evidence
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="dispute-detail-more-wrap" ref={moreWrapRef}>
            <button
              type="button"
              className="dispute-detail-fab dispute-detail-fab--more"
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              onClick={() => setMoreOpen((o) => !o)}
            >
              More
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            {moreOpen ? (
              <div className="dispute-detail-more-menu" role="menu">
                <button type="button" className="dispute-detail-more-item" role="menuitem">
                  Escalate
                </button>
                <button type="button" className="dispute-detail-more-item" role="menuitem">
                  Request info from customer
                </button>
                <button type="button" className="dispute-detail-more-item" role="menuitem">
                  Close dispute
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {evidenceViewer ? (
        <div
          className="dispute-detail-evidence-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dispute-evidence-modal-title"
        >
          <button
            type="button"
            className="dispute-detail-evidence-modal-backdrop"
            aria-label="Close evidence viewer"
            onClick={() => setEvidenceViewer(null)}
          />
          <div
            className="dispute-detail-evidence-modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dispute-detail-evidence-modal-head">
              <h2 id="dispute-evidence-modal-title" className="dispute-detail-evidence-modal-title">
                {evidenceViewer.label ?? evidenceViewer.filename ?? "Evidence"}
              </h2>
              <button
                type="button"
                className="dispute-detail-evidence-modal-close"
                aria-label="Close"
                onClick={() => setEvidenceViewer(null)}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="dispute-detail-evidence-modal-body">
              {evidenceFileKind(evidenceViewer) === "video" ? (
                <video
                  key={evidenceViewer.id ?? evidenceViewer.url}
                  className="dispute-detail-evidence-modal-video"
                  controls
                  playsInline
                  preload="metadata"
                  src={evidenceViewer.url}
                >
                  <a href={evidenceViewer.url}>Download this video</a>
                </video>
              ) : (
                <img
                  key={evidenceViewer.id ?? evidenceViewer.url}
                  src={evidenceViewer.url}
                  alt=""
                  className="dispute-detail-evidence-modal-img"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
