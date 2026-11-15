"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useDispatch, useSelector } from "react-redux"
import { deleteProduct, getShopsByOwner, getProducts } from "../../../lib/productApi"
import { set_entrepreneur_shop_details } from "../../../redux/entrepreneur/entrepreneur_shop"
import "./styles/xxl.css"
import "./styles/s.css"

function shopRowId(s) {
  return s?.id ?? s?.shop_id
}

/** @param {unknown} images */
function firstImageUrl(images) {
  let list = images
  if (typeof list === "string") {
    try {
      list = JSON.parse(list)
    } catch {
      return list.trim() || null
    }
  }
  if (!Array.isArray(list) || list.length === 0) return null
  const raw = list[0]
  if (typeof raw !== "string" || !raw.trim()) return null
  const u = raw.trim()
  if (/^https?:\/\//i.test(u)) return u
  if (u.startsWith("/")) return `/api/backend${u}`
  return u
}

function formatCreatedAt(value) {
  if (value == null || value === "") return "—"
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatSalesCount(n) {
  if (n == null || n === "") return "—"
  const num = Number(n)
  if (Number.isNaN(num)) return "—"
  return num.toLocaleString()
}

function formatRevenue(n, currency) {
  if (n == null || n === "") return "—"
  const num = Number(n)
  if (Number.isNaN(num)) return "—"
  const cur = typeof currency === "string" && currency.trim() ? currency.trim() : "NGN"
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(num)
  } catch {
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
}

function ProductTableRow({
  item,
  menuOpenId,
  onToggleMenu,
  shopIdStr,
  onDeleteProduct,
}) {
  const productId = item?.id ?? item?.product_id
  const name = item?.name ?? item?.Name ?? "—"
  const status = item?.status ?? item?.Status ?? "—"
  const createdAt = item?.created_at ?? item?.createdAt
  const totalSales = item?.total_sales ?? item?.totalSales
  const totalRevenue = item?.total_revenue ?? item?.totalRevenue
  const revenueCurrency = item?.revenue_currency ?? item?.currency
  const thumb = firstImageUrl(item?.images)
  const menuOpen = productId != null && menuOpenId === productId
  const editHref =
    productId != null
      ? `/entrepreneur/product/create-product?edit=${encodeURIComponent(String(productId))}&shop=${encodeURIComponent(shopIdStr || "")}`
      : "#"

  return (
    <tr>
      <td>
        <div className="product-list-cell-product">
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="product-list-thumb" src={thumb} alt="" width={44} height={44} />
          ) : (
            <span className="product-list-thumb-placeholder" aria-hidden />
          )}
          <span className="product-list-title">{name}</span>
        </div>
      </td>
      <td>{status}</td>
      <td className="product-list-num">{formatSalesCount(totalSales)}</td>
      <td className="product-list-num">{formatRevenue(totalRevenue, revenueCurrency)}</td>
      <td className="product-list-num">{formatCreatedAt(createdAt)}</td>
      <td className="product-list-actions-cell">
        <div className="product-list-actions">
          <button
            type="button"
            className="product-list-actions-trigger"
            aria-label="Product actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation()
              if (productId != null) onToggleMenu(productId)
            }}
          >
            ⋮
          </button>
          {menuOpen ? (
            <div
              className="product-list-actions-menu"
              role="menu"
              onClick={(e) => e.stopPropagation()}
            >
              <Link
                href={editHref}
                className="product-list-actions-item"
                role="menuitem"
                onClick={() => onToggleMenu(null)}
              >
                Edit
              </Link>
              <button
                type="button"
                className="product-list-actions-item product-list-actions-item-danger"
                role="menuitem"
                onClick={() => {
                  if (productId != null) onDeleteProduct(productId)
                }}
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  )
}

export default function ProductListPage() {
  const dispatch = useDispatch()
  const entrepreneur_id = useSelector((s) => s.entrepreneur_id?.entrepreneur_id)
  const shopFromStore = useSelector((s) => s.entrepreneur_shop?.shop)
  const [shops, setShops] = useState([])
  const [prods, setProds] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState("")
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [deleteError, setDeleteError] = useState("")

  useEffect(() => {
    if (menuOpenId == null) return
    const onDocClick = () => setMenuOpenId(null)
    const onKeyDown = (e) => {
      if (e.key === "Escape") setMenuOpenId(null)
    }
    document.addEventListener("click", onDocClick)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("click", onDocClick)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [menuOpenId])

  useEffect(() => {
    if (entrepreneur_id == null) {
      setLoading(false)
      setProds([])
      return
    }

    let cancelled = false;
    (async () => {
      setLoading(true)
      setListError("")
      try {
        const data = await getShopsByOwner(entrepreneur_id)
        if (cancelled) return
        const shopList = Array.isArray(data?.shops) ? data.shops : []
        setShops(shopList)

        if (shopList.length === 0) {
          setProds([])
          setListError("No shop found. Create a shop first.")
          return
        }

        const preferredId = shopFromStore?.id ?? shopFromStore?.shop_id
        const sid =
          preferredId != null &&
          shopList.some((s) => String(shopRowId(s)) === String(preferredId))
            ? preferredId
            : shopRowId(shopList[0])

        if (sid == null) {
          setProds([])
          setListError("No shop selected.")
          return
        }

        if (cancelled) return

        const { products } = await getProducts(sid, entrepreneur_id)
        if (cancelled) return
        setProds(Array.isArray(products) ? products : [])
      } catch (e) {
        if (!cancelled) {
          setProds([])
          setListError(e?.message || "Could not load products.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [entrepreneur_id, shopFromStore?.id, shopFromStore?.shop_id])

  const selectedShopId = useMemo(() => {
    if (!shops.length) return ""
    const pid = shopFromStore?.id ?? shopFromStore?.shop_id
    if (pid != null && shops.some((s) => String(shopRowId(s)) === String(pid))) {
      return String(pid)
    }
    return String(shopRowId(shops[0]) ?? "")
  }, [shops, shopFromStore?.id, shopFromStore?.shop_id])

  const onShopSelect = useCallback(
    (e) => {
      const id = e.target.value
      const shop = shops.find((s) => String(shopRowId(s)) === String(id))
      if (shop) dispatch(set_entrepreneur_shop_details(shop))
    },
    [shops, dispatch]
  )

  const toggleActionMenu = useCallback((id) => {
    if (id == null) {
      setMenuOpenId(null)
      return
    }
    setMenuOpenId((cur) => (cur === id ? null : id))
  }, [])

  const onDeleteProduct = useCallback(
    async (productId) => {
      setDeleteError("")
      const shopIdNum = Number.parseInt(String(selectedShopId), 10)
      if (entrepreneur_id == null || Number.isNaN(shopIdNum)) {
        setDeleteError("Missing shop or account.")
        return
      }
      if (!window.confirm("Delete this product? Inventory for this product will be removed. This cannot be undone.")) {
        return
      }
      try {
        await deleteProduct(shopIdNum, productId, entrepreneur_id)
        setProds((prev) =>
          prev.filter((p) => String(p?.id ?? p?.product_id) !== String(productId))
        )
        setMenuOpenId(null)
      } catch (err) {
        setDeleteError(err?.message || "Could not delete product.")
      }
    },
    [entrepreneur_id, selectedShopId]
  )

  return (
    <div style={{
      height: "calc(100vh - 60px)",
      overflow: "auto"
    }}>
      <h1 className="page-h1 page-h1--compact">Your products — Making Commerce Safe For Everyone</h1>
      <div className="product-list-header">
        <span>
          {shops.length > 0 ? (
            <small style={{ color: "#666" }}>
              <div className="input-cnt">
                <select
                  aria-label="Shop"
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
              </div>
              {/* {shops.map((s) => s?.name ?? s?.Name ?? "—").join(" · ")} */}
            </small>
          ) : null}
        </span>

        <span className="add_btn">
          <button onClick={e => window.location.href = "/entrepreneur/product/create-product"}>
            + Add Product
          </button>
        </span>
      </div>


      {loading ? <p>Loading products…</p> : null}
      {!loading && listError ? <p style={{ color: "#c00" }}>{listError}</p> : null}
      {!loading && deleteError ? <p style={{ color: "#c00" }}>{deleteError}</p> : null}

      <div className="product-list-wrap">
        <table className="product-list-table">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Status</th>
              <th scope="col">Total sales</th>
              <th scope="col">Total revenue</th>
              <th scope="col">Created</th>
              <th scope="col" className="product-list-actions-th">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {!loading &&
              prods.map((prod, index) => (
                <ProductTableRow
                  key={prod?.id ?? prod?.product_id ?? `prod-${index}`}
                  item={prod}
                  menuOpenId={menuOpenId}
                  onToggleMenu={toggleActionMenu}
                  shopIdStr={selectedShopId}
                  onDeleteProduct={onDeleteProduct}
                />
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
