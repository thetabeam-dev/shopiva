 "use client"

import React, { useEffect, useMemo, useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { getInventoryByShop, getShopsByOwner } from "../../../lib/productApi"
import { set_entrepreneur_shop_details } from "../../../redux/entrepreneur/entrepreneur_shop"
import "./styles/xxl.css"
import "./styles/s.css"

function shopRowId(s) {
  return s?.id ?? s?.shop_id
}

function jsAgo(value) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 10) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(days / 365)
  return `${years}y ago`
}

export default function InventoryPage() {
  const dispatch = useDispatch()
  const entrepreneurId = useSelector((s) => s.entrepreneur_id?.entrepreneur_id)
  const shopFromStore = useSelector((s) => s.entrepreneur_shop?.shop)

  const [shops, setShops] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (entrepreneurId == null) {
      setLoading(false)
      setRows([])
      return
    }
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError("")
      try {
        const shopsRes = await getShopsByOwner(entrepreneurId)
        if (cancelled) return
        const shopList = Array.isArray(shopsRes?.shops) ? shopsRes.shops : []
        setShops(shopList)
        if (shopList.length === 0) {
          setRows([])
          setError("No shop found. Create a shop first.")
          return
        }

        const preferred = shopFromStore?.id ?? shopFromStore?.shop_id
        const shopId =
          preferred != null &&
          shopList.some((s) => String(shopRowId(s)) === String(preferred))
            ? preferred
            : shopRowId(shopList[0])

        if (shopId == null) {
          setRows([])
          setError("No shop selected.")
          return
        }

        const inventoryRes = await getInventoryByShop(shopId, entrepreneurId)
        if (cancelled) return
        setRows(Array.isArray(inventoryRes?.inventory) ? inventoryRes.inventory : [])
      } catch (e) {
        if (!cancelled) {
          setRows([])
          setError(e?.message || "Could not load inventory.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [entrepreneurId, shopFromStore?.id, shopFromStore?.shop_id])

  const selectedShopId = useMemo(() => {
    if (!shops.length) return ""
    const preferred = shopFromStore?.id ?? shopFromStore?.shop_id
    if (preferred != null && shops.some((s) => String(shopRowId(s)) === String(preferred))) {
      return String(preferred)
    }
    return String(shopRowId(shops[0]) ?? "")
  }, [shops, shopFromStore?.id, shopFromStore?.shop_id])

  const onShopSelect = (e) => {
    const id = e.target.value
    const shop = shops.find((s) => String(shopRowId(s)) === String(id))
    if (shop) dispatch(set_entrepreneur_shop_details(shop))
  }

  return (
    <div className="inventory-page">
      <div className="inventory-header">
        <h1 className="page-h1 page-h1--compact">Inventory — Making Commerce Safe For Everyone</h1>
        {shops.length > 0 ? (
          <div className="inventory-shop-select">
            <select aria-label="Shop" value={selectedShopId} onChange={onShopSelect}>
              {shops.map((shop, index) => {
                const id = shopRowId(shop)
                return (
                  <option key={id != null ? String(id) : `shop-${index}`} value={String(id ?? "")}>
                    {shop?.name ?? shop?.Name ?? "—"}
                  </option>
                )
              })}
            </select>
          </div>
        ) : null}
      </div>

      {loading ? <p>Loading inventory…</p> : null}
      {!loading && error ? <p style={{ color: "#c00" }}>{error}</p> : null}

      <div className="inventory-table-wrap">
        <table className="inventory-table">
          <thead>
            <tr>
                <th>id</th>
                <th>product</th>
                <th>sku</th>
                <th>price</th>
                <th>currency</th>
                <th>stock</th>
                <th>reserved</th>
                <th>low_stock</th>
                <th>active</th>
                <th>created</th>
                <th>updated</th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              rows.map((r, index) => (
                <tr key={r?.id ?? `inv-${index}`}>
                  <td>{r?.id ?? "—"}</td>
                  <td>{r?.product_name ?? "—"}</td>
                  <td>{r?.sku ?? "—"}</td>
                  <td>{r?.price ?? "—"}</td>
                  <td>{r?.currency ?? "—"}</td>
                  <td>{r?.quantity_available ?? "—"}</td>
                  <td>{r?.quantity_reserved ?? "—"}</td>
                  <td>{r?.low_stock_threshold ?? "—"}</td>
                  <td>{typeof r?.is_active === "boolean" ? (r.is_active ? "true" : "false") : "—"}</td>
                  <td>{jsAgo(r?.created_at)}</td>
                  <td>{jsAgo(r?.updated_at)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
