"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getShopsByOwner } from "../../../lib/productApi";
import { set_entrepreneur_shop_details } from "../../../redux/entrepreneur/entrepreneur_shop";
import "./styles/xxl.css";
import "./styles/s.css";

function formatCurrency(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(num);
}

function shopRowId(s) {
  return s?.id ?? s?.shop_id ?? s?.shopId;
}

export default function TransactionsPage() {
  const dispatch = useDispatch();
  const entrepreneurId = useSelector((s) => s.entrepreneur_id?.entrepreneur_id);
  const shopFromStore = useSelector((s) => s.entrepreneur_shop?.shop);
  const [shops, setShops] = useState([]);
  const [rows, setRows] = useState([]);
  const [overview, setOverview] = useState({
    available_balance: 0,
    pending_escrow: 0,
    total_earnings: 0,
    total_withdrawal: 0,
    currency: "NGN",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (entrepreneurId == null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const shopsRes = await getShopsByOwner(entrepreneurId);
        if (cancelled) return;
        const shopList = Array.isArray(shopsRes?.shops) ? shopsRes.shops : [];
        setShops(shopList);
        if (!shopList.length) {
          setRows([]);
          setError("No shop found. Create a shop first.");
          return;
        }
        const preferredId = shopFromStore?.id ?? shopFromStore?.shop_id;
        const shopId =
          preferredId != null && shopList.some((s) => String(shopRowId(s)) === String(preferredId))
            ? preferredId
            : shopRowId(shopList[0]);
        if (shopId == null) {
          setRows([]);
          setError("No shop selected.");
          return;
        }
        const selectedShop = shopList.find((s) => String(shopRowId(s)) === String(shopId));
        if (selectedShop) dispatch(set_entrepreneur_shop_details(selectedShop));
        const res = await fetch(`/api/backend/shop/${shopId}/transactions/${entrepreneurId}`, {
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Could not load transactions.");
        if (cancelled) return;
        setOverview({
          available_balance: Number(json?.overview?.available_balance ?? 0),
          pending_escrow: Number(json?.overview?.pending_escrow ?? 0),
          total_earnings: Number(json?.overview?.total_earnings ?? 0),
          total_withdrawal: Number(json?.overview?.total_withdrawal ?? 0),
          currency: String(json?.overview?.currency ?? "NGN"),
        });
        setRows(Array.isArray(json?.transactions) ? json.transactions : []);
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setError(e?.message || "Could not load transactions.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entrepreneurId, shopFromStore?.id, shopFromStore?.shop_id, dispatch]);

  const selectedShopId = useMemo(() => {
    if (!shops.length) return "";
    const pid = shopFromStore?.id ?? shopFromStore?.shop_id;
    if (pid != null && shops.some((s) => String(shopRowId(s)) === String(pid))) return String(pid);
    return String(shopRowId(shops[0]) ?? "");
  }, [shops, shopFromStore?.id, shopFromStore?.shop_id]);

  const onShopSelect = (e) => {
    const id = e.target.value;
    const shop = shops.find((s) => String(shopRowId(s)) === String(id));
    if (shop) dispatch(set_entrepreneur_shop_details(shop));
  };

  return (
    <div className="transactions-page">
      <div className="transactions-header">
        <h1 className="page-h1 page-h1--compact">Transactions — Making Commerce Safe For Everyone</h1>
        <p>Track your sales, payouts and refunds in one place.</p>
      </div>
      {shops.length > 0 ? (
        <div className="transactions-shop-select">
          <select aria-label="Shop" value={selectedShopId} onChange={onShopSelect}>
            {shops.map((shop, index) => {
              const id = shopRowId(shop);
              return (
                <option value={String(id ?? "")} key={id != null ? String(id) : `shop-opt-${index}`}>
                  {shop?.name ?? shop?.Name ?? "—"}
                </option>
              );
            })}
          </select>
        </div>
      ) : null}

      <section className="transactions-overview">
        <article className="trx-card">
          <span>Available Balance</span>
          <h4>{formatCurrency(overview.available_balance)}</h4>
        </article>
        <article className="trx-card">
          <span>Pending Escrow</span>
          <h4>{formatCurrency(overview.pending_escrow)}</h4>
        </article>
        <article className="trx-card">
          <span>Total Earnings</span>
          <h4>{formatCurrency(overview.total_earnings)}</h4>
        </article>
        <article className="trx-card">
          <span>Total Withdrawal</span>
          <h4>{formatCurrency(overview.total_withdrawal)}</h4>
        </article>
      </section>
      {loading ? <p>Loading transactions...</p> : null}
      {!loading && error ? <p className="transactions-error">{error}</p> : null}

      <section className="transactions-table-wrap">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.reference}>
                <td>{row?.date ? String(row.date).slice(0, 10) : "—"}</td>
                <td>{row.type}</td>
                <td>{row?.reference ?? `REF-${index + 1}`}</td>
                <td className={Number(row?.amount) < 0 ? "amount-out" : "amount-in"}>
                  {row.amount < 0 ? "-" : "+"}
                  {formatCurrency(Math.abs(row.amount))}
                </td>
                <td>
                  <span className={`status-pill status-${String(row?.status ?? "pending").toLowerCase()}`}>{row?.status ?? "Pending"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
