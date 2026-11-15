"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import "./styles/s.css"
import "./styles/xxl.css"

const TABS = [
  { id: "my-tasks", label: "My Tasks" },
  { id: "in-review", label: "In Review" },
  { id: "in-progress", label: "In Progress" },
  { id: "done", label: "Done" },
]

/** Placeholder rows — replace with API data when available */
const MOCK_ROWS = [
  {
    id: "d1",
    tab: "my-tasks",
    disputeId: "DSP-1042",
    customer: "Ada Okafor",
    order: "#88291",
    reason: "Office supplies order error",
    amount: 6200,
    status: "Open",
    actionRequired: "Respond within 48h",
    created: "2024-03-12T14:30:00.000Z",
  },
  {
    id: "d2",
    tab: "my-tasks",
    disputeId: "DSP-1043",
    customer: "Chidi Nwosu",
    order: "#88102",
    reason: "Late delivery — customs hold",
    amount: 12400,
    status: "Awaiting seller",
    actionRequired: "Provide tracking proof",
    created: "2024-03-10T09:15:00.000Z",
  },
  {
    id: "d3",
    tab: "in-review",
    disputeId: "DSP-1038",
    customer: "Fatima Bello",
    order: "#87944",
    reason: "Invoice mismatch",
    amount: 890,
    status: "In review",
    actionRequired: "—",
    created: "2024-03-08T16:00:00.000Z",
  },
  {
    id: "d4",
    tab: "in-progress",
    disputeId: "DSP-1031",
    customer: "Emeka Obi",
    order: "#87720",
    reason: "Damaged packaging",
    amount: 450,
    status: "Mediation",
    actionRequired: "Upload photos",
    created: "2024-03-05T11:45:00.000Z",
  },
  {
    id: "d5",
    tab: "done",
    disputeId: "DSP-1015",
    customer: "Yewande Ade",
    order: "#87101",
    reason: "Refund requested",
    amount: 2100,
    status: "Resolved",
    actionRequired: "None",
    created: "2024-02-28T08:00:00.000Z",
  },
]

function formatMoney(n) {
  const num = Number(n)
  if (Number.isNaN(num)) return "—"
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num)
  return `₦${formatted}`
}

function formatCreated(iso) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

function statusPillClass(status) {
  const v = String(status ?? "").toLowerCase()
  if (v.includes("resolved") || v.includes("closed") || v === "done") {
    return "disputes-pill disputes-pill--success"
  }
  if (v.includes("review") || v.includes("mediation") || v.includes("awaiting")) {
    return "disputes-pill disputes-pill--warning"
  }
  if (v.includes("open") || v.includes("pending")) {
    return "disputes-pill disputes-pill--info"
  }
  return "disputes-pill disputes-pill--neutral"
}

export default function DisputesPage() {
  const [tab, setTab] = useState("my-tasks")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)

  const filtered = useMemo(() => MOCK_ROWS.filter((r) => r.tab === tab), [tab])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * perPage
  const pageRows = filtered.slice(start, start + perPage)
  const showingFrom = total === 0 ? 0 : start + 1
  const showingTo = Math.min(start + perPage, total)

  const onTabChange = (id) => {
    setTab(id)
    setPage(1)
  }

  const onPerPageChange = (e) => {
    setPerPage(Number(e.target.value))
    setPage(1)
  }

  return (
    <>
      {/* <div className="disputes-narrow" role="status">
        <p className="disputes-narrow-title">Disputes</p>
        <p className="disputes-narrow-text">Open this page on a large display (1200px or wider) for the full disputes workspace.</p>
      </div> */}

      <div className="disputes-page">
        <header className="disputes-header" style={{background: "unset"}}>
          <h1 className="disputes-title">Vendor disputes — Making Commerce Safe For Everyone</h1>
          <div className="disputes-header-actions">
            <button type="button" className="disputes-btn disputes-btn--muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 6h16M7 12h10M10 18h4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Filter
            </button>
            <button type="button" className="disputes-btn disputes-btn--primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Export
            </button>
          </div>
        </header>

        <nav className="disputes-tabs" aria-label="Dispute status">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === tab ? "disputes-tab disputes-tab--active" : "disputes-tab"}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="disputes-card">
          <div className="disputes-table-wrap">
            <table className="disputes-table">
              <thead>
                <tr>
                  <th>Dispute ID</th>
                  <th>Customer</th>
                  <th>Order</th>
                  <th>Reason</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action Required</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id}>
                    <td className="disputes-td-id">
                      <Link href={`/entrepreneur/disputes/${encodeURIComponent(row.id)}`}>{row.disputeId}</Link>
                    </td>
                    <td className="disputes-td-strong">{row.customer}</td>
                    <td className="disputes-td-order">{row.order}</td>
                    <td className="disputes-td-reason">{row.reason}</td>
                    <td>{formatMoney(row.amount)}</td>
                    <td>
                      <span className={statusPillClass(row.status)}>{row.status}</span>
                    </td>
                    <td className="disputes-td-action">{row.actionRequired}</td>
                    <td className="disputes-td-created">{formatCreated(row.created)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="disputes-footer">
            <p className="disputes-footer-summary">
              Showing {showingFrom} to {showingTo} of {total} results
            </p>
            <div className="disputes-footer-controls">
              <label className="disputes-per-page">
                <span className="visually-hidden">Rows per page</span>
                <select value={perPage} onChange={onPerPageChange} aria-label="Rows per page">
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </label>
              <div className="disputes-pager">
                <button
                  type="button"
                  className="disputes-pager-btn"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="disputes-pager-btn"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}
