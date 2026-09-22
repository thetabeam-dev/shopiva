"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useDispatch, useSelector } from "react-redux"
import { getOrdersByShop, getShopsByOwner, patchShopOrderStatus } from "../../../../lib/productApi"
import { set_entrepreneur_shop_details } from "../../../../redux/entrepreneur/entrepreneur_shop"
import "./styles/s.css"
import "./styles/xxl.css"

const VendorOrderLocationMap = dynamic(() => import("./VendorOrderLocationMap"), { ssr: false })

const VENDOR_PROGRESS_STEPS = [
  { key: "received", label: "Order accepted", actionLabel: "Start " },
  { key: "processing", label: "Getting order ready", actionLabel: "Get order ready" },
  { key: "quality_check", label: "Checking item", actionLabel: "Check item" },
  { key: "shipped", label: "On the way", actionLabel: "Ship order" },
  { key: "ready_for_pickup", label: "Ready for pickup", actionLabel: "Mark ready for pickup" },
]

/** Last step in the row — not advanced by the vendor; set when the customer confirms delivery. */
const CUSTOMER_SATISFACTION_STEP = { key: "fulfilled", label: "Fulfilled" }

const VENDOR_ORDER_STEPPER_STEPS = [...VENDOR_PROGRESS_STEPS, CUSTOMER_SATISFACTION_STEP]

/** Saved browser progress must not override server for these statuses (e.g. order reset to pending in DB). */
function shouldResetSavedVendorProgress(status) {
  const n = String(status ?? "").trim().toLowerCase()
  return n === "pending" || n === "cancelled" || n === "refunded"
}

function shopRowId(s) {
  return s?.id ?? s?.shop_id
}

function formatAmount(n) {
  const num = Number(n)
  if (Number.isNaN(num)) return "—"
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "NGN" }).format(num)
}

function productThumbLetters(product) {
  const p = String(product ?? "").trim()
  if (!p) return "?"
  const w = p.split(/\s+/).filter(Boolean)
  if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase()
  return p.slice(0, 2).toUpperCase()
}

function jsAgo(value) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 10) return "Just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleString()
}

function isLockedOrderStatus(status) {
  const normalized = String(status ?? "").trim().toLowerCase()
  return (
    normalized === "completed" ||
    normalized === "confirmed" ||
    normalized === "accepted"
  )
}

/** Accept / decline bar only while the order is still awaiting that decision. */
function shouldShowVendorAcceptDeclineBar(status) {
  if (isCancelledOrderStatus(status)) return false
  if (isLockedOrderStatus(status)) return false
  const n = String(status ?? "").trim().toLowerCase()
  const afterAccept = new Set([
    "processing",
    "approved",
    "in_progress",
    "in progress",
    "fulfilled",
    "shipped",
    "delivered",
    "awaiting_shipment",
    "preparing",
  ])
  return !afterAccept.has(n)
}

/** Once the order is past accept/decline, step 0 "Order accepted" is implied — floor progress at 1. */
function minVendorProgressStepForStatus(status) {
  if (isCancelledOrderStatus(status)) return 0
  if (shouldShowVendorAcceptDeclineBar(status)) return 0
  return 1
}

function isCancelledOrderStatus(status) {
  const normalized = String(status ?? "").trim().toLowerCase()
  return normalized === "cancelled" || normalized === "canceled"
}

function customerConfirmedDelivery(status) {
  const n = String(status ?? "").trim().toLowerCase()
  return n === "delivered" || n === "completed"
}

function orderRowCustomerId(row) {
  const v = row?.customer_id ?? row?.customerId
  if (v == null || v === "") return null
  return v
}

function buildOrderInboxHref({ customerId, orderId, shopId }) {
  const params = new URLSearchParams()
  params.set("customerId", String(customerId))
  if (orderId != null && String(orderId) !== "") params.set("orderId", String(orderId))
  if (shopId != null && String(shopId) !== "") params.set("shopId", String(shopId))
  return `/entrepreneur/inbox?${params.toString()}`
}

function workspaceStorageKey(shopId, orderId) {
  return `deedyte_vendor_order_workspace_v1_${shopId}_${orderId}`
}

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function loadWorkspace(shopId, orderId) {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(workspaceStorageKey(shopId, orderId))
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== "object") return null
    return data
  } catch {
    return null
  }
}

function saveWorkspace(shopId, orderId, payload) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(workspaceStorageKey(shopId, orderId), JSON.stringify(payload))
  } catch {
    /* ignore quota */
  }
}

function pickAddressField(obj, keys) {
  if (!obj || typeof obj !== "object") return ""
  for (const k of keys) {
    const v = obj[k]
    if (v != null && String(v).trim() !== "") return String(v).trim()
  }
  return ""
}

function formatVendorShippingAddress(raw) {
  if (raw == null) return "—"

  let data = raw
  if (typeof raw === "string") {
    const t = raw.trim()
    if (t === "") return "—"
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try {
        data = JSON.parse(t)
      } catch {
        return `Address:\n${t}`
      }
    } else {
      return `Address:\n${t}`
    }
  }

  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const oneLine = pickAddressField(data, [
      "formatted_address",
      "formattedAddress",
      "full_address",
      "fullAddress",
      "label",
      "summary",
    ])
    if (oneLine) return `Full address:\n${oneLine}`

    const nested = data.shipping ?? data.Shipping ?? data.delivery ?? data.address
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const inner = formatVendorShippingAddress(nested)
      if (inner && inner !== "—") return inner
    }

    const city = pickAddressField(data, ["city", "town", "lga", "municipality"])
    const state = pickAddressField(data, ["state", "province", "region", "state_code", "stateCode"])
    const line1 = pickAddressField(data, [
      "street",
      "address",
      "street_address",
      "streetAddress",
      "address_line_1",
      "addressLine1",
      "line1",
    ])
    const line2 = pickAddressField(data, [
      "address_line_2",
      "addressLine2",
      "line2",
      "area",
      "district",
      "neighborhood",
      "landmark",
    ])
    const zip = pickAddressField(data, ["zip", "postal_code", "postalCode", "zip_code", "zipCode"])
    const country = pickAddressField(data, ["country", "country_name", "countryName"])

    const locality =
      city && state && city.toLowerCase() !== state.toLowerCase()
        ? `${city} · ${state}`
        : city || state || ""

    const streetPart = [line1, line2].filter(Boolean).join(" · ")

    const blocks = []
    if (locality) blocks.push(`City / state: ${locality}`)
    if (streetPart) blocks.push(`Street address: ${streetPart}`)
    if (zip) blocks.push(`Postal code: ${zip}`)
    if (country) blocks.push(`Country: ${country}`)

    if (blocks.length) return blocks.join("\n\n")

    return "—"
  }

  if (Array.isArray(data)) {
    const parts = data.map((x) => formatVendorShippingAddress(x)).filter((s) => s && s !== "—")
    if (!parts.length) return "—"
    if (parts.length === 1) return parts[0]
    return parts.map((inner, i) => `Address ${i + 1}:\n${inner}`).join("\n\n")
  }

  const s = String(data).trim()
  if (s === "[object Object]") return "—"
  return s ? `Address:\n${s}` : "—"
}

function resolveOrderAddress(order) {
  if (!order) return "—"
  const candidates = [
    order?.shipping_address,
    order?.delivery_address,
    order?.address,
    order?.shippingaddress,
    order?.customer_address,
    order?.customeraddress,
    order?.shipping,
    order?.delivery,
  ]
  for (const v of candidates) {
    if (v == null) continue
    const out = formatVendorShippingAddress(v)
    if (out && out !== "—") return out
  }
  return "—"
}

function pickFiniteCoord(...candidates) {
  for (const c of candidates) {
    const n = Number(c)
    if (Number.isFinite(n)) return n
  }
  return null
}

function resolveOrderDate(order) {
  const raw = order?.date ?? order?.ordered_at ?? order?.created_at
  if (!raw) return "—"
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return String(raw)
  return d.toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  })
}

function paymentLooksSettled(paymentText) {
  const t = String(paymentText ?? "").toLowerCase()
  return t.includes("paid") || t.includes("success") || t.includes("complete")
}

export default function VendorOrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const dispatch = useDispatch()
  const orderIdParam = params?.id != null ? String(params.id) : ""

  const entrepreneurId = useSelector((s) => s.entrepreneur_id?.entrepreneur_id)
  const shopFromStore = useSelector((s) => s.entrepreneur_shop?.shop)

  const [shops, setShops] = useState([])
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [progressStep, setProgressStep] = useState(0)
  const [tags, setTags] = useState("")
  const [timeline, setTimeline] = useState([])
  const [commentDraft, setCommentDraft] = useState("")

  const [moreOpen, setMoreOpen] = useState(false)
  const moreWrapRef = useRef(null)

  const [statusAction, setStatusAction] = useState(null)
  const [statusActionError, setStatusActionError] = useState("")
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [acceptDeclineGuardOpen, setAcceptDeclineGuardOpen] = useState(false)
  const [declinedOrderModalOpen, setDeclinedOrderModalOpen] = useState(false)

  const [mapPoint, setMapPoint] = useState(null)
  const [mapStatus, setMapStatus] = useState("")

  const selectedShopId = useMemo(() => {
    if (!shops.length) return ""
    const pid = shopFromStore?.id ?? shopFromStore?.shop_id
    if (pid != null && shops.some((s) => String(shopRowId(s)) === String(pid))) return String(pid)
    return String(shopRowId(shops[0]) ?? "")
  }, [shops, shopFromStore?.id, shopFromStore?.shop_id])

  const persistWorkspace = useCallback(
    (patch) => {
      const shopId = selectedShopId
      const oid = order?.order_id
      if (!shopId || oid == null) return
      const prev = loadWorkspace(shopId, oid) || {}
      const next = { ...prev, ...patch }
      saveWorkspace(shopId, oid, next)
    },
    [order?.order_id, selectedShopId]
  )

  const shippingAddressLine = useMemo(() => resolveOrderAddress(order), [order])

  const orderLat = useMemo(
    () => pickFiniteCoord(order?.customer_lat, order?.latitude, order?.lat),
    [order?.customer_lat, order?.latitude, order?.lat, order?.order_id]
  )
  const orderLng = useMemo(
    () => pickFiniteCoord(order?.customer_lng, order?.longitude, order?.lng, order?.lon),
    [order?.customer_lng, order?.longitude, order?.lng, order?.lon, order?.order_id]
  )

  useEffect(() => {
    setMapPoint(null)
    setMapStatus("")
    if (!order) return

    if (orderLat != null && orderLng != null) {
      setMapPoint({ lat: orderLat, lng: orderLng })
      setMapStatus("Location from order coordinates.")
      return
    }

    const addr = shippingAddressLine
    if (!addr || addr === "—") {
      setMapStatus("No coordinates or shipping address on file for this order.")
      return
    }

    let cancelled = false
    setMapStatus("Placing address on the map…")

    ;(async () => {
      try {
        const q = encodeURIComponent(addr)
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ng`,
          {
            headers: {
              Accept: "application/json",
              "User-Agent": "DeedyteVendorOrderMap/1.0 (https://deedyte.com)",
            },
          }
        )
        if (cancelled) return
        if (!res.ok) {
          setMapStatus("Could not look up this address on the map.")
          return
        }
        const arr = await res.json().catch(() => [])
        const hit = Array.isArray(arr) && arr[0] ? arr[0] : null
        if (!hit) {
          setMapStatus("No map match for this address.")
          return
        }
        const lat = Number(hit.lat)
        const lng = Number(hit.lon)
        if (cancelled || !Number.isFinite(lat) || !Number.isFinite(lng)) {
          if (!cancelled) setMapStatus("Could not read coordinates for this address.")
          return
        }
        setMapPoint({ lat, lng })
        setMapStatus("Approximate pin from shipping address (OpenStreetMap).")
      } catch {
        if (!cancelled) setMapStatus("Could not load map lookup.")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [order?.order_id, orderLat, orderLng, shippingAddressLine])

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
    if (!cancelModalOpen && !acceptDeclineGuardOpen && !declinedOrderModalOpen) return
    const onKey = (e) => {
      if (e.key === "Escape") {
        setStatusActionError("")
        setCancelModalOpen(false)
        setAcceptDeclineGuardOpen(false)
        setDeclinedOrderModalOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [cancelModalOpen, acceptDeclineGuardOpen, declinedOrderModalOpen])

  useEffect(() => {
    setCancelModalOpen(false)
    setAcceptDeclineGuardOpen(false)
    setDeclinedOrderModalOpen(false)
  }, [order?.order_id])

  useEffect(() => {
    if (order && !shouldShowVendorAcceptDeclineBar(order.status)) {
      setCancelModalOpen(false)
      setAcceptDeclineGuardOpen(false)
      setStatusActionError("")
    }
  }, [order?.status, order?.order_id])

  useEffect(() => {
    if (entrepreneurId == null) {
      setLoading(false)
      setOrder(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setOrder(null)
      setError("")
      try {
        const shopsRes = await getShopsByOwner(entrepreneurId)
        if (cancelled) return
        const shopList = Array.isArray(shopsRes?.shops) ? shopsRes.shops : []
        setShops(shopList)
        if (shopList.length === 0) {
          setOrder(null)
          setError("No shop found.")
          return
        }
        const preferredId = shopFromStore?.id ?? shopFromStore?.shop_id
        const shopId =
          preferredId != null && shopList.some((s) => String(shopRowId(s)) === String(preferredId))
            ? preferredId
            : shopRowId(shopList[0])
        if (shopId == null) {
          setOrder(null)
          setError("No shop selected.")
          return
        }
        const { orders } = await getOrdersByShop(shopId, entrepreneurId)
        if (cancelled) return
        const rows = Array.isArray(orders) ? orders : []
        const found = rows.find((r) => String(r?.order_id ?? "") === orderIdParam) || null
        if (!found) {
          setOrder(null)
          setError("Order not found for this shop.")
          return
        }
        setOrder(found)

        const ws = loadWorkspace(String(shopId), found.order_id)
        const floor = minVendorProgressStepForStatus(found?.status)
        if (shouldResetSavedVendorProgress(found?.status)) {
          setProgressStep(0)
          setTags(ws && typeof ws === "object" && typeof ws.tags === "string" ? ws.tags : "")
          setTimeline([])
        } else if (ws && typeof ws === "object") {
          const ps = Number(ws.progressStep)
          const base = Number.isFinite(ps) && ps >= 0 ? Math.min(ps, VENDOR_PROGRESS_STEPS.length) : 0
          setProgressStep(Math.max(base, floor))
          setTags(typeof ws.tags === "string" ? ws.tags : "")
          setTimeline(Array.isArray(ws.timeline) ? ws.timeline : [])
        } else {
          setProgressStep(floor)
          setTags("")
          setTimeline([])
        }
      } catch (e) {
        if (!cancelled) {
          setOrder(null)
          setError(e?.message || "Could not load order.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [entrepreneurId, shopFromStore?.id, shopFromStore?.shop_id, orderIdParam])

  useEffect(() => {
    if (!order?.order_id || !selectedShopId) return
    persistWorkspace({ progressStep, tags, timeline })
  }, [order?.order_id, persistWorkspace, progressStep, tags, timeline])

  const onShopSelect = (e) => {
    const id = e.target.value
    const shop = shops.find((s) => String(shopRowId(s)) === String(id))
    if (shop) dispatch(set_entrepreneur_shop_details(shop))
  }

  const paymentSettled = paymentLooksSettled(order?.payment)
  const vendorStagesComplete = progressStep >= VENDOR_PROGRESS_STEPS.length
  const customerFulfillmentComplete = customerConfirmedDelivery(order?.status)
  const fulfillmentBadgeOk = customerFulfillmentComplete
  const fulfillmentBadgeText = customerFulfillmentComplete
    ? "Fulfilled"
    : vendorStagesComplete
      ? "Awaiting customer"
      : "Unfulfilled"
  const isCancelled = isCancelledOrderStatus(order?.status)
  const canCollectPayment =
    customerFulfillmentComplete && !paymentSettled && !isCancelled && statusAction == null

  /** If order still needs accept/decline, open guard modal and return true (caller should abort). */
  const requireAcceptOrDeclineResolved = useCallback(() => {
    if (order && isCancelledOrderStatus(order.status)) {
      setCancelModalOpen(false)
      setAcceptDeclineGuardOpen(false)
      setDeclinedOrderModalOpen(true)
      return true
    }
    if (order && shouldShowVendorAcceptDeclineBar(order.status)) {
      setCancelModalOpen(false)
      setAcceptDeclineGuardOpen(true)
      return true
    }
    return false
  }, [order])

  const chatHref = useMemo(() => {
    const cid = orderRowCustomerId(order)
    if (cid == null || !order) return ""
    return buildOrderInboxHref({
      customerId: cid,
      orderId: order?.order_id,
      shopId: selectedShopId,
    })
  }, [order, selectedShopId])

  const advanceProgress = () => {
    if (!order || progressStep >= VENDOR_PROGRESS_STEPS.length) return
    if (requireAcceptOrDeclineResolved()) return
    const label = VENDOR_PROGRESS_STEPS[progressStep]?.label
    const next = progressStep + 1
    setProgressStep(next)
    setTimeline((prev) => [
      {
        id: newId(),
        at: new Date().toISOString(),
        kind: "system",
        text:
          next >= VENDOR_PROGRESS_STEPS.length
            ? `Your stages are complete (last: ${label}). Fulfillment will show when the customer confirms delivery.`
            : `Stage completed: ${label}. Now working on: ${VENDOR_PROGRESS_STEPS[next]?.label ?? ""}.`,
      },
      ...prev,
    ])
  }

  const postComment = () => {
    const t = commentDraft.trim()
    if (!t || !order) return
    if (requireAcceptOrDeclineResolved()) return
    setTimeline((prev) => [
      {
        id: newId(),
        at: new Date().toISOString(),
        kind: "comment",
        text: t,
      },
      ...prev,
    ])
    setCommentDraft("")
  }

  const submitOrderStatus = async (nextStatus, actionKey) => {
    if (!order || entrepreneurId == null) return false
    if (isCancelledOrderStatus(order?.status)) return false
    if (isLockedOrderStatus(order?.status)) return false
    const shopId = Number(selectedShopId)
    const orderId = Number(order?.order_id)
    if (!Number.isFinite(shopId) || shopId <= 0 || !Number.isFinite(orderId) || orderId <= 0) return false

    setStatusActionError("")
    setStatusAction(actionKey)
    try {
      await patchShopOrderStatus(shopId, orderId, entrepreneurId, nextStatus)
      setOrder((prev) => (prev ? { ...prev, status: nextStatus } : prev))
      setProgressStep((p) => {
        if (nextStatus !== "confirmed") return p
        return Math.max(p, 1)
      })
      setTimeline((prev) => {
        const statusLine = {
          id: newId(),
          at: new Date().toISOString(),
          kind: "system",
          text: `Order status updated to “${nextStatus === "confirmed" ? "Confirmed" : nextStatus === "cancelled" ? "Cancelled" : nextStatus}”.`,
        }
        if (nextStatus !== "confirmed" || progressStep >= 1) return [statusLine, ...prev]
        const acceptedLabel = VENDOR_PROGRESS_STEPS[0]?.label ?? "Order accepted"
        const nextLabel = VENDOR_PROGRESS_STEPS[1]?.label ?? ""
        const progressLine = {
          id: newId(),
          at: new Date().toISOString(),
          kind: "system",
          text: `Stage completed: ${acceptedLabel}. Now working on: ${nextLabel}.`,
        }
        return [statusLine, progressLine, ...prev]
      })
      return true
    } catch (e) {
      setStatusActionError(e?.message || "Could not update status.")
      return false
    } finally {
      setStatusAction(null)
    }
  }

  const nextProgressLabel =
    progressStep < VENDOR_PROGRESS_STEPS.length
      ? VENDOR_PROGRESS_STEPS[progressStep]?.actionLabel ?? VENDOR_PROGRESS_STEPS[progressStep]?.label
      : null

  const amountNum = Number(order?.amount)
  const subtotal = Number.isFinite(amountNum) ? amountNum : 0
  const qtySafe = Math.max(1, Number(order?.qty) || 1)
  const unitPrice = Number.isFinite(amountNum) ? amountNum / qtySafe : 0

  return (
    <>
      <div className="vendor-order-narrow" role="status">
        <p className="vendor-order-narrow-title">Order details</p>
        <p className="vendor-order-narrow-text">
          Open this page on a large display (1200px or wider) for the full order workspace.
        </p>
      </div>

      <div
        className={`vendor-order-page${
          !loading && order && shouldShowVendorAcceptDeclineBar(order?.status) ? " vendor-order-page--order-actions" : ""
        }${!loading && order && isCancelled ? " vendor-order-page--declined" : ""}`}
      >
        {loading ? <p className="vendor-order-loading">Loading order…</p> : null}
        {!loading && error ? <p className="vendor-order-status-err">{error}</p> : null}

        {!loading && order ? (
          <>
            <Link href="/entrepreneur/orders" className="vendor-order-back">
              <span aria-hidden>←</span> Orders
            </Link>

            <div className="vendor-order-interactive-root">
              {isCancelled ? (
                <div
                  className="vendor-order-decline-shield"
                  role="presentation"
                  onClick={() => setDeclinedOrderModalOpen(true)}
                />
              ) : null}
              <div className={isCancelled ? "vendor-order-interactive-under-shield" : undefined}>
            <div className="vendor-order-top">
              <div>
                <div className="vendor-order-title-row">
                  <h1 className="vendor-order-title">
                    #{order.order_id}
                    <span className="visually-hidden">Order details</span>
                  </h1>
                  <div className="vendor-order-badges" aria-label="Order status">
                    <span
                      className={`vendor-order-badge ${
                        paymentSettled ? "vendor-order-badge--payment-ok" : "vendor-order-badge--payment-warn"
                      }`}
                    >
                      {paymentSettled ? "Paid" : "Money in escrow"}
                    </span>
                    <span
                      className={`vendor-order-badge ${
                        fulfillmentBadgeOk ? "vendor-order-badge--fulfill-ok" : "vendor-order-badge--fulfill-warn"
                      }`}
                    >
                      {fulfillmentBadgeText}
                    </span>
                    <span className="vendor-order-badge vendor-order-badge--payment-ok" style={{ opacity: 0.9 }}>
                      {order.status ?? "—"}
                    </span>
                  </div>
                </div>
                <p className="vendor-order-subline">{resolveOrderDate(order)}</p>
              </div>

              <div className="vendor-order-actions">
                {/* {shops.length > 1 ? (
                  <select
                    aria-label="Shop"
                    className="vendor-order-btn vendor-order-btn--ghost"
                    value={selectedShopId}
                    onChange={onShopSelect}
                  >
                    {shops.map((shop, index) => {
                      const id = shopRowId(shop)
                      return (
                        <option value={String(id ?? "")} key={id != null ? String(id) : `shop-opt-${index}`}>
                          {shop?.name ?? shop?.Name ?? "—"}
                        </option>
                      )
                    })}
                  </select>
                ) : null} */}
                <button type="button" className="vendor-order-btn vendor-order-btn--ghost" disabled title="Coming soon">
                  Restock
                </button>
                <button type="button" className="vendor-order-btn vendor-order-btn--ghost" disabled title="Coming soon">
                  Edit
                </button>
                <div className="vendor-order-more-wrap" ref={moreWrapRef}>
                  {/* <button
                    type="button"
                    className="vendor-order-btn vendor-order-btn--ghost"
                    aria-expanded={moreOpen}
                    onClick={() => setMoreOpen((o) => !o)}
                  >
                    More actions
                  </button> */}
                  {moreOpen ? (
                    <div className="vendor-order-more-panel" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMoreOpen(false)
                          window.print()
                        }}
                      >
                        Print page
                      </button>
                      <button type="button" role="menuitem" onClick={() => setMoreOpen(false)}>
                        Export (soon)
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="vendor-order-layout">
              <div className="vendor-order-main">
                <section className="vendor-order-card" aria-labelledby="vo-items-heading">
                  <div className="vendor-order-card-body">
                    <div className="vendor-order-card-head">
                      {/* <h2 id="vo-items-heading" className="vendor-order-card-title">
                        Order items
                      </h2>
                      <span
                        className={`vendor-order-badge ${
                          fulfillmentBadgeOk ? "vendor-order-badge--fulfill-ok" : "vendor-order-badge--fulfill-warn"
                        }`}
                      >
                        {fulfillmentBadgeText}
                      </span> */}
                      <div className="vendor-order-thumb" aria-hidden>
                        {productThumbLetters(order.product)}
                      </div>
                    </div>
                    <div className="vendor-order-item-row">
                      
                      <div>
                        <p className="vendor-order-item-name">{order.product ?? "—"}</p>
                        <p className="vendor-order-item-meta">
                          Qty {order.qty ?? 0}
                          {" · "}
                          {order.payment ?? "—"}
                          {order.delivery ? ` · ${order.delivery}` : ""}
                        </p>
                      </div>
                      <div className="vendor-order-item-price">
                        <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280" }}>
                          {formatAmount(unitPrice)} × {qtySafe}
                        </div>
                        &nbsp;&nbsp;=&nbsp;&nbsp;
                        {formatAmount(order.amount)}
                      </div>
                      {/* <div className="vendor-order-item-actions">
                        <button type="button" className="vendor-order-btn vendor-order-btn--ghost" disabled title="Coming soon">
                          Fulfill item
                        </button>
                        <button type="button" className="vendor-order-btn vendor-order-btn--primary" disabled title="Coming soon">
                          Create shipping
                        </button>
                      </div> */}
                    </div>
                  </div>

                  <div className="vendor-order-stepper">
                    <p className="vendor-order-stepper-label">Your production progress</p>
                    <div className="vendor-order-steps-row">
                      {VENDOR_ORDER_STEPPER_STEPS.map((step, i) => {
                        const vendorLen = VENDOR_PROGRESS_STEPS.length
                        const isCustomerStep = i === vendorLen
                        const done = isCustomerStep
                          ? customerFulfillmentComplete
                          : i < progressStep
                        const current = isCustomerStep
                          ? vendorStagesComplete && !customerFulfillmentComplete
                          : i === progressStep && progressStep < vendorLen
                        const isLastVendorBar = i === vendorLen - 1
                        const barDone = isLastVendorBar
                          ? customerFulfillmentComplete
                          : i < progressStep
                        const cellClass = [
                          "vendor-order-step-cell",
                          done ? "vendor-order-step-cell--done" : "",
                          current ? "vendor-order-step-cell--current" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")
                        return (
                          <div key={step.key} className={cellClass}>
                            <div className="vendor-order-step-top">
                              <div className="vendor-order-step-node" aria-current={current ? "step" : undefined}>
                                {done ? "✓" : i + 1}
                              </div>
                              {i < VENDOR_ORDER_STEPPER_STEPS.length - 1 ? (
                                <div
                                  className={`vendor-order-step-bar ${barDone ? "vendor-order-step-bar--done" : ""}`}
                                  aria-hidden
                                />
                              ) : null}
                            </div>
                            <p
                              className="vendor-order-step-caption"
                              title={
                                isCustomerStep
                                  ? "Marked complete when the customer confirms they are satisfied with delivery."
                                  : undefined
                              }
                            >
                              {step.label}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                    <div className="vendor-order-item-actions">
                      <button
                        type="button"
                        className="vendor-order-btn vendor-order-btn--primary"
                        disabled={
                          isCancelled ||
                          progressStep >= VENDOR_PROGRESS_STEPS.length ||
                          statusAction != null
                        }
                        onClick={advanceProgress}
                      >
                        {progressStep >= VENDOR_PROGRESS_STEPS.length
                          ? customerFulfillmentComplete
                            ? "Delivery confirmed"
                            : "Awaiting customer confirmation"
                          : `${nextProgressLabel}`}
                      </button>
                      <button
                        type="button"
                        className="vendor-order-btn vendor-order-btn--ghost"
                        disabled={!chatHref || isCancelled}
                        onClick={() => {
                          if (requireAcceptOrDeclineResolved()) return
                          if (chatHref) router.push(chatHref)
                        }}
                      >
                        Message customer
                      </button>
                    </div>
                  </div>
                </section>

                <section className="vendor-order-card" aria-labelledby="vo-pay-heading">
                  <div className="vendor-order-card-head">
                    <h2 id="vo-pay-heading" className="vendor-order-card-title">
                      Payment
                    </h2>
                    <span
                      className={`vendor-order-badge ${
                        paymentSettled ? "vendor-order-badge--payment-ok" : "vendor-order-badge--payment-warn"
                      }`}
                    >
                      {paymentSettled ? "Paid" : "Money in escrow"}
                    </span>
                  </div>
                  <div className="vendor-order-money-rows">
                    <div className="vendor-order-money-row">
                      <span>Subtotal</span>
                      <span className="vendor-order-money-val">{formatAmount(subtotal)}</span>
                    </div>
                    <div className="vendor-order-money-row">
                      <span>Charge</span>
                      <span className="vendor-order-money-val">Free</span>
                    </div>
                    <div className="vendor-order-money-row">
                      <span>Shipping</span>
                      <span className="vendor-order-money-val">{order.delivery ? String(order.delivery) : "—"}</span>
                    </div>
                    <div className="vendor-order-money-row vendor-order-money-row--total">
                      <span>Total</span>
                      <span className="vendor-order-money-val">{formatAmount(order.amount)}</span>
                    </div>
                  </div>
                  <p style={{ margin: "14px 0 0", fontSize: "0.875rem", color: "#6b7280" }}>
                    {paymentSettled
                      ? "Payment recorded on this order."
                      : "Customer funds are in escrow until this order is paid out — follow up in Messages if needed."}
                  </p>
                  <div className="vendor-order-item-actions" style={{ marginTop: 16 }}>
                    {/* <button type="button" className="vendor-order-btn vendor-order-btn--ghost" disabled title="Coming soon">
                      Send invoice
                    </button> */}
                    <button
                      type="button"
                      className="vendor-order-btn vendor-order-btn--primary"
                      disabled={!canCollectPayment}
                      title={
                        isCancelled
                          ? undefined
                          : !customerFulfillmentComplete
                            ? "Available after the customer confirms delivery and the order is fulfilled."
                            : paymentSettled
                              ? "Payment is already recorded for this order."
                              : "Coming soon"
                      }
                    >
                      Collect payment
                    </button>
                  </div>
                </section>

                <section className="vendor-order-card" aria-labelledby="vo-timeline-heading">
                  <h2 id="vo-timeline-heading" className="vendor-order-card-title" style={{ marginBottom: 14 }}>
                    Timeline
                  </h2>
                  <div className="vendor-order-timeline-compose">
                    <textarea
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder="Leave an internal note…"
                      aria-label="Timeline comment"
                      readOnly={isCancelled}
                      disabled={isCancelled}
                    />
                    <button
                      type="button"
                      className="vendor-order-btn vendor-order-btn--primary"
                      disabled={isCancelled}
                      onClick={postComment}
                    >
                      Post
                    </button>
                  </div>
                  <ul className="vendor-order-timeline-list">
                    {timeline.map((ev) => (
                      <li key={ev.id} className="vendor-order-timeline-item">
                        <div className="vendor-order-timeline-icon" aria-hidden>
                          {ev.kind === "comment" ? "💬" : "●"}
                        </div>
                        <div className="vendor-order-timeline-body">
                          <p className="vendor-order-timeline-text">{ev.text}</p>
                          <time className="vendor-order-timeline-time" dateTime={ev.at}>
                            {jsAgo(ev.at)}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>

                {statusActionError ? <p className="vendor-order-status-err">{statusActionError}</p> : null}
              </div>

              <aside className="vendor-order-aside" aria-label="Order sidebar">
                <section className="vendor-order-card">
                  <h2 className="vendor-order-card-title" style={{ marginBottom: 10 }}>
                    Customer location
                  </h2>
                  <VendorOrderLocationMap
                    lat={mapPoint?.lat}
                    lng={mapPoint?.lng}
                    hasPin={mapPoint != null}
                    label="Delivery location"
                  />
                  <p className="vendor-order-map-status" role="status">
                    {mapStatus}
                  </p>
                </section>

                <section className="vendor-order-card">
                  <h2 className="vendor-order-card-title" style={{ marginBottom: 12 }}>
                    Buyer
                  </h2>
                  <p className="vendor-order-customer-name">{order?.customer ?? "Anonymous buyer"}</p>
                  <p className="vendor-order-customer-meta">
                    Deedyte keeps buyers anonymous on this side. You do not receive email, phone, or the buyer’s real
                    name—only what you need to ship below.
                  </p>
                </section>

                <section className="vendor-order-card">
                  <h2 className="vendor-order-card-title" style={{ marginBottom: 10 }}>
                    Shipping address
                  </h2>
                  {shippingAddressLine === "—" ? (
                    <p className="vendor-order-address vendor-order-muted">Not on file</p>
                  ) : (
                    <p className="vendor-order-address">{shippingAddressLine}</p>
                  )}
                </section>

                <section className="vendor-order-card">
                  <h2 className="vendor-order-card-title" style={{ marginBottom: 10 }}>
                    Fraud analysis
                  </h2>
                  <div className="vendor-order-fraud">
                    <div className="vendor-order-fraud-track" aria-hidden>
                      <span className="vendor-order-fraud-marker" />
                    </div>
                    <div className="vendor-order-fraud-labels">
                      <span>Low</span>
                      <span>Medium</span>
                      <span>High</span>
                    </div>
                    <p className="vendor-order-fraud-result">Low risk (placeholder)</p>
                  </div>
                </section>

                {/* <section className="vendor-order-card">
                  <h2 className="vendor-order-card-title" style={{ marginBottom: 10 }}>
                    Tags
                  </h2>
                  <input
                    className="vendor-order-tags-input"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="e.g. rush, wholesale"
                    aria-label="Order tags"
                  />
                </section> */}
              </aside>
            </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {!loading && order && shouldShowVendorAcceptDeclineBar(order?.status) ? (
        <>
          <div className="vendor-order-foot-actions" role="region" aria-label="Accept or decline order">
            <button
              type="button"
              className="vendor-order-btn floating-btn vendor-order-btn--ghost"
              disabled={statusAction != null}
              onClick={() => {
                setStatusActionError("")
                setAcceptDeclineGuardOpen(false)
                setCancelModalOpen(true)
              }}
            >
              Decline order
            </button>
            <button
              type="button"
              className="vendor-order-btn floating-btn vendor-order-btn--primary"
              disabled={statusAction != null}
              onClick={() => submitOrderStatus("confirmed", "accept")}
            >
              {statusAction === "accept" ? "Updating…" : "Accept order"}
            </button>
          </div>

          {cancelModalOpen ? (
            <div
              className="vendor-order-modal-backdrop"
              role="presentation"
              onClick={() => {
                setStatusActionError("")
                setCancelModalOpen(false)
              }}
            >
              <div
                className="vendor-order-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="vendor-decline-order-title"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 id="vendor-decline-order-title" className="vendor-order-modal-title">
                  Decline this order?
                </h2>
                <p className="vendor-order-modal-body">
                  If you continue, this order will be cancelled for your shop. The buyer may be notified according to
                  your policies. This action is not reversible from this screen.
                </p>
                {statusActionError ? <p className="vendor-order-modal-err">{statusActionError}</p> : null}
                <div className="vendor-order-modal-actions">
                  <button
                    type="button"
                    className="vendor-order-btn vendor-order-btn--ghost"
                    onClick={() => {
                      setStatusActionError("")
                      setCancelModalOpen(false)
                    }}
                  >
                    Keep order
                  </button>
                  <button
                    type="button"
                    className="vendor-order-btn vendor-order-btn--danger"
                    disabled={statusAction != null}
                    onClick={async () => {
                      const ok = await submitOrderStatus("cancelled", "cancel")
                      if (ok) setCancelModalOpen(false)
                    }}
                  >
                    {statusAction === "cancel" ? "Cancelling…" : "Yes, decline order"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {!loading && order && acceptDeclineGuardOpen && shouldShowVendorAcceptDeclineBar(order?.status) ? (
        <div
          className="vendor-order-modal-backdrop vendor-order-modal-backdrop--guard"
          role="presentation"
          onClick={() => setAcceptDeclineGuardOpen(false)}
        >
          <div
            className="vendor-order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vendor-accept-decline-guard-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="vendor-accept-decline-guard-title" className="vendor-order-modal-title">
              Accept or decline this order first
            </h2>
            <p className="vendor-order-modal-body">
              You need to choose <strong>Accept order</strong> or <strong>Decline order</strong> at the bottom of the
              screen before you can update production progress, timeline notes, or message the customer for this order.
            </p>
            <div className="vendor-order-modal-actions">
              <button
                type="button"
                className="vendor-order-btn vendor-order-btn--primary"
                onClick={() => setAcceptDeclineGuardOpen(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && order && declinedOrderModalOpen && isCancelledOrderStatus(order?.status) ? (
        <div
          className="vendor-order-modal-backdrop vendor-order-modal-backdrop--guard"
          role="presentation"
          onClick={() => setDeclinedOrderModalOpen(false)}
        >
          <div
            className="vendor-order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vendor-declined-order-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="vendor-declined-order-title" className="vendor-order-modal-title">
              Order declined
            </h2>
            <p className="vendor-order-modal-body">
              You declined this order, so you cannot update production progress, add timeline notes, message the
              customer, or change payment from this page. Use <strong>Orders</strong> above to leave this view.
            </p>
            <div className="vendor-order-modal-actions">
              <button
                type="button"
                className="vendor-order-btn vendor-order-btn--primary"
                onClick={() => setDeclinedOrderModalOpen(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
