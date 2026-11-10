"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import backSvg from "@/svgs/backward-arrow-svgrepo-com.svg";
import { formatDeliveryWindow, formatDisplayDate } from "@/lib/formatDisplayDate";
import { API_BACKEND, buyerAuthHeaders } from "@/reusables/shopBackendAuth";
import "./styles/xxl.css";
import "./styles/s.css";

const ONGOING_STATUSES = new Set(["waiting", "delivered"]);

const ORDER_THUMB =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#e5e5e5"/></svg>`
  );

function normalizeCardStatus(st) {
  const s = String(st || "").toLowerCase();
  if (s.includes("cancel")) return "canceled";
  if (s.includes("return")) return "returned";
  if (s.includes("deliver") || s.includes("complete")) return "delivered";
  return "waiting";
}

function mapApiRowToCard(row) {
  const status = normalizeCardStatus(row.status);
  const id = String(row.order_id);
  const dateIso = row.date ? new Date(row.date).toISOString() : null;
  const o = {
    id,
    orderNo: id,
    title: row.product || "Order",
    thumb: ORDER_THUMB,
    status,
    variation: Number(row.qty) > 1 ? `Qty: ${row.qty}` : undefined,
  };
  if (status === "waiting" && dateIso) {
    o.deliveryStartAt = dateIso;
    o.deliveryEndAt = dateIso;
  }
  if (status === "delivered" && dateIso) o.deliveredAt = dateIso;
  if (status === "canceled" && dateIso) o.canceledAt = dateIso;
  if (status === "returned" && dateIso) o.returnCompletedAt = dateIso;
  return o;
}

function statusLabel(status) {
  switch (status) {
    case "waiting":
      return "WAITING TO BE SHIPPED";
    case "delivered":
      return "DELIVERED";
    case "canceled":
      return "CANCELED";
    case "returned":
      return "RETURNED";
    default:
      return String(status).toUpperCase();
  }
}

export default function OrdersPage() {
  const [tab, setTab] = useState("ongoing");
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BACKEND}/buyer/orders`, {
          method: "GET",
          credentials: "include",
          headers: buyerAuthHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setOrders([]);
          return;
        }
        const rows = Array.isArray(data.orders) ? data.orders : [];
        setOrders(rows.map(mapApiRowToCard));
      } catch {
        if (!cancelled) setOrders([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { ongoing, canceled } = useMemo(() => {
    const ongoingList = [];
    const canceledList = [];
    for (const o of orders) {
      if (ONGOING_STATUSES.has(o.status)) ongoingList.push(o);
      else canceledList.push(o);
    }
    return { ongoing: ongoingList, canceled: canceledList };
  }, [orders]);

  const list = tab === "ongoing" ? ongoing : canceled;

  return (
    <div className="ord-page">
      <header className="ord-mheader" aria-label="Orders">
        <Link href="/" className="ord-mheader__back" aria-label="Back">
          <img src={backSvg.src} alt="" width={20} height={20} />
        </Link>
        <h1 className="ord-mheader__title">Orders</h1>
      </header>

      <div className="ord-main">
        <h1 className="ord-title ord-title--desktop">Orders</h1>

        <div className="ord-tabs" role="tablist" aria-label="Order filters">
          <button
            type="button"
            role="tab"
            id="tab-ongoing"
            aria-selected={tab === "ongoing"}
            className={`ord-tab ${tab === "ongoing" ? "ord-tab--active" : ""}`}
            onClick={() => setTab("ongoing")}
          >
            ONGOING/DELIVERED ({ongoing.length})
          </button>
          <button
            type="button"
            role="tab"
            id="tab-canceled"
            aria-selected={tab === "canceled"}
            className={`ord-tab ${tab === "canceled" ? "ord-tab--active" : ""}`}
            onClick={() => setTab("canceled")}
          >
            CANCELED/RETURNED ({canceled.length})
          </button>
        </div>

        <ul className="ord-list">
          {list.map((order) => (
            <li key={order.id} className="ord-card" id={`order-${order.id}`} onClick={e=> {
              window.location.href=`/store/orders/${order.id}`;
            }}>
              <div className="ord-card__thumb-wrap">
                <img
                  className="ord-card__thumb"
                  src={order.thumb}
                  alt=""
                  width={96}
                  height={96}
                />
              </div>
              <div className="ord-card__body">
                <div className="ord-card__primary">
                  <p className="ord-card__title">{order.title}</p>
                  <p className="ord-card__meta">Order {order.orderNo}</p>
                  {order.variation ? (
                    <p className="ord-card__variation">Variation: {order.variation}</p>
                  ) : null}
                </div>
                <div className="ord-card__secondary">
                  <span
                    className={`ord-badge ord-badge--${order.status}`}
                    aria-label={`Status: ${statusLabel(order.status)}`}
                  >
                    {statusLabel(order.status)}
                  </span>
                  {order.deliveryStartAt && order.deliveryEndAt ? (
                    <p className="ord-card__delivery">
                      {formatDeliveryWindow(
                        order.deliveryStartAt,
                        order.deliveryEndAt
                      )}
                    </p>
                  ) : null}
                  {order.deliveredAt ? (
                    <p className="ord-card__delivery">
                      Delivered {formatDisplayDate(order.deliveredAt)}
                    </p>
                  ) : null}
                  {order.canceledAt ? (
                    <p className="ord-card__delivery">
                      Canceled {formatDisplayDate(order.canceledAt)}
                    </p>
                  ) : null}
                  {order.returnCompletedAt ? (
                    <p className="ord-card__delivery">
                      Return completed {formatDisplayDate(order.returnCompletedAt)}
                    </p>
                  ) : null}
                </div>
              </div>
              <Link
                href={`/store/orders/${order.id}`}
                className="ord-card__details"
                target="_blank"
                rel="noopener noreferrer"
              >
                See details
              </Link>
            </li>
          ))}
        </ul>

        {list.length === 0 ? (
          <p className="ord-empty">No orders in this tab yet.</p>
        ) : null}
      </div>
    </div>
  );
}
