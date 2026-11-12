"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductVariantCardPicker, {
  formatAttributeLabel,
} from "@/components/customers/ProductVariantCardPicker";
import { emitChatSocketAck } from "@/lib/chatSocket";
import { NIGERIAN_STATE_OPTIONS } from "@/app/geoUtils";
import { getCookie } from "@/reusables/shopBackendAuth";
import "./inbox.css";

function formatNgn(n) {
  return `₦${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function parseCard(content) {
  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    if (!parsed || typeof parsed !== "object") return null;
    const kind = String(parsed.kind ?? parsed.type ?? "").trim();
    if (
      [
        "invoice",
        "shipping",
        "inquiry",
        "invoice_cancelled",
        "invoice_paid",
        "invoice_request",
      ].includes(kind)
    ) {
      return { ...parsed, kind };
    }
  } catch {
    /* plain text */
  }
  return null;
}

function mapMessage(row, userId) {
  const senderId = Number(row.sender);
  const outgoing = Number.isFinite(senderId) && Number(userId) === senderId;
  const card = parseCard(row.content);
  const d = new Date(row.created_at ?? row.updated_at ?? Date.now());
  const timeLabel = Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const base = {
    id: String(row.id ?? `msg-${Date.now()}`),
    outgoing,
    timeLabel,
    text: "",
    invoice: null,
    shipping: null,
    inquiry: null,
    invoiceRequest: null,
    invoicePaid: null,
    invoiceCancel: null,
  };
  if (card?.kind === "invoice_request") {
    return { ...base, text: "Checkout invoice requested", invoiceRequest: card };
  }
  if (card?.kind === "invoice" || card?.type === "invoice") {
    return { ...base, text: "Checkout invoice", invoice: card };
  }
  if (card?.kind === "shipping") {
    return { ...base, text: "Shipping details", shipping: card };
  }
  if (card?.kind === "inquiry") {
    return { ...base, text: "Product inquiry", inquiry: card };
  }
  if (card?.kind === "invoice_paid") {
    return { ...base, text: "Order placed", invoicePaid: card };
  }
  if (card?.kind === "invoice_cancelled") {
    return {
      ...base,
      text: outgoing ? "You cancelled the checkout invoice." : "Buyer cancelled the checkout invoice.",
      invoiceCancel: card,
    };
  }
  return { ...base, text: String(row.content ?? "") };
}

function formatShipping(addr) {
  if (!addr || typeof addr !== "object") return "";
  return [addr.street, addr.area1, addr.area2, addr.city, addr.state, addr.zip]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

function unitPriceForBulk(base, tiers, quantity) {
  const qty = Math.max(1, Math.trunc(Number(quantity) || 1));
  let chosen = null;
  for (const tier of tiers) {
    if (tier.minQuantity <= qty) chosen = tier;
  }
  if (!chosen) return base;
  const unit = chosen.totalPrice / chosen.minQuantity;
  return Number.isFinite(unit) && unit > 0 ? unit : base;
}

function InboxInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopId = Number(searchParams.get("shopId")) || 0;
  const shopName = String(searchParams.get("shopName") ?? "").trim() || "Vendor";
  const productId = Number(searchParams.get("productId")) || 0;
  const itemTitle = String(searchParams.get("itemTitle") ?? "").trim() || "Product";
  const itemImage = String(searchParams.get("itemImage") ?? "").trim();
  const itemAmountParam = Number(searchParams.get("itemAmount")) || 0;
  const initialVariantId = Number(searchParams.get("variantId")) || 0;

  const [userId, setUserId] = useState(0);
  const [roomId, setRoomId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("Connecting…");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [requestSending, setRequestSending] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [shippingDraft, setShippingDraft] = useState({
    street: "",
    area1: "",
    area2: "",
    state: "",
    city: "",
    zip: "",
  });
  const [qtyText, setQtyText] = useState("1");
  const [variants, setVariants] = useState([]);
  const [bulkTiers, setBulkTiers] = useState([]);
  const [productPrice, setProductPrice] = useState(itemAmountParam);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const listRef = useRef(null);
  const inquiryPostedRef = useRef(false);
  const shippingRef = useRef(null);

  const attrKeys = useMemo(() => {
    const keys = new Set();
    for (const variant of variants) {
      const attrs =
        variant?.attributes && typeof variant.attributes === "object" ? variant.attributes : {};
      Object.keys(attrs).forEach((key) => keys.add(key));
    }
    return Array.from(keys);
  }, [variants]);

  const hasVariants = variants.length > 0;
  const qty = Math.max(1, Math.min(9999, parseInt(qtyText, 10) || 0));
  const variantPrice = Number(selectedVariant?.price);
  const basePrice =
    Number.isFinite(variantPrice) && variantPrice > 0
      ? variantPrice
      : hasVariants
        ? 0
        : productPrice || itemAmountParam;
  const unitPrice = basePrice > 0 ? unitPriceForBulk(basePrice, bulkTiers, qty) : 0;

  const pendingRequestId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.invoice) return "";
      if (messages[i]?.invoiceRequest) return messages[i].id;
    }
    return "";
  }, [messages]);

  const openInvoicePending = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const row = messages[i];
      if (row?.invoiceRequest) return false;
      if (row?.invoice) return true;
    }
    return false;
  }, [messages]);

  const latestBuyerShipping = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i]?.shipping) return messages[i].shipping;
      if (messages[i]?.invoiceRequest?.shippingAddress) {
        return messages[i].invoiceRequest.shippingAddress;
      }
    }
    return null;
  }, [messages]);

  const appendMessage = useCallback((row) => {
    if (!row) return;
    setMessages((prev) => (prev.some((item) => item.id === row.id) ? prev : [...prev, row]));
  }, []);

  useEffect(() => {
    if (!getCookie("customer_secret")) {
      const next = encodeURIComponent(
        typeof window !== "undefined" ? window.location.pathname + window.location.search : "/store/inbox",
      );
      router.replace(`/auth/login?role=customer&next=${next}`);
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/authorization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ role: "customer" }),
        });
        const result = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && result?.data?.id != null) {
          setUserId(Number(result.data.id) || 0);
        }
      } catch {
        /* guest */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!(productId > 0)) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/product/details?id=${productId}`, { cache: "no-store" });
        const payload = await res.json().catch(() => ({}));
        const detail = payload?.data && typeof payload.data === "object" ? payload.data : null;
        if (cancelled || !detail) return;
        setProductPrice(Number(detail.price) || itemAmountParam);
        const raw = Array.isArray(detail.bulkDiscount) ? detail.bulkDiscount : [];
        setBulkTiers(
          raw
            .map((tier) => {
              const minQuantity = Number(String(tier?.minQuantity ?? "").replace(/[^\d]/g, ""));
              const totalPrice = Number(
                String(tier?.totalPrice ?? "").replace(/[^\d.]/g, "").replace(/\.(?=.*\.)/g, ""),
              );
              if (!Number.isFinite(minQuantity) || minQuantity < 2) return null;
              if (!Number.isFinite(totalPrice) || totalPrice <= 0) return null;
              return { minQuantity, totalPrice };
            })
            .filter(Boolean),
        );
        const rows = Array.isArray(detail.variants)
          ? detail.variants.filter((row) => row && typeof row === "object")
          : [];
        const mapped = rows.map((variant, index) => {
          const attrs =
            variant.attributes && typeof variant.attributes === "object" ? variant.attributes : {};
          const attributes = {};
          Object.keys(attrs).forEach((key) => {
            attributes[key] = String(attrs[key] ?? "").trim();
          });
          return {
            ...variant,
            attributes,
            optionKey: `${String(variant.id ?? "variant")}-${index}`,
          };
        });
        setVariants(mapped);
        const preset =
          initialVariantId > 0
            ? mapped.find((row) => Number(row.id) === Number(initialVariantId))
            : null;
        if (preset) setSelectedVariant(preset);
        else if (mapped.length === 1) setSelectedVariant(mapped[0]);
      } catch {
        /* keep query params */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, initialVariantId, itemAmountParam]);

  useEffect(() => {
    if (!(shopId > 0) || !(userId > 0)) return undefined;
    let cancelled = false;
    (async () => {
      setStatus("Opening chat…");
      setError("");
      const created = await emitChatSocketAck("create_room", {
        shop_id: shopId,
        app_role: "customer",
        initiator_role: "buyer",
        recipient_role: "seller",
      });
      if (cancelled) return;
      const room =
        created?.result && typeof created.result === "object" ? created.result.room : null;
      const activeRoomId = String(room?.id ?? room?.roomId ?? "").trim();
      if (!created?.success || !activeRoomId) {
        // Room may already exist — try listing rooms.
        const listed = await emitChatSocketAck("get_rooms", { app_role: "customer" });
        const rooms = Array.isArray(listed?.result?.rooms)
          ? listed.result.rooms
          : Array.isArray(listed?.list)
            ? listed.list
            : [];
        const match = rooms.find((row) => Number(row?.shop_id ?? row?.shopId) === shopId);
        const existingId = String(match?.id ?? match?.roomId ?? "").trim();
        if (!existingId) {
          setError(created?.message || "Could not start this chat.");
          setStatus("");
          return;
        }
        setRoomId(existingId);
      } else {
        setRoomId(activeRoomId);
      }
      setStatus("");
    })();
    return () => {
      cancelled = true;
    };
  }, [shopId, userId]);

  useEffect(() => {
    if (!roomId || !(userId > 0)) return undefined;
    let cancelled = false;
    (async () => {
      const out = await emitChatSocketAck("get_room_messages", {
        room_id: roomId,
        app_role: "customer",
      });
      if (cancelled) return;
      const rows = Array.isArray(out?.result?.messages)
        ? out.result.messages
        : Array.isArray(out?.result)
          ? out.result
          : [];
      setMessages(rows.map((row) => mapMessage(row, userId)));
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, userId]);

  useEffect(() => {
    if (!roomId || !(userId > 0) || inquiryPostedRef.current) return;
    if (!(productId > 0) && !(itemAmountParam > 0)) return;
    const already = messages.some((row) => {
      const pid = Number(row?.inquiry?.productId ?? row?.shipping?.productId) || 0;
      return productId > 0 && pid === productId;
    });
    if (already) {
      inquiryPostedRef.current = true;
      return;
    }
    inquiryPostedRef.current = true;
    void emitChatSocketAck("create_message", {
      room_id: roomId,
      type: "system",
      content: JSON.stringify({
        kind: "inquiry",
        itemAmount: itemAmountParam || undefined,
        itemTitle: itemTitle || undefined,
        itemImage: itemImage || undefined,
        productId: productId || undefined,
      }),
      app_role: "customer",
    }).then((out) => {
      if (!out?.success) {
        inquiryPostedRef.current = false;
        return;
      }
      const resultMsg =
        out.result && typeof out.result === "object" && "message" in out.result
          ? out.result.message
          : null;
      if (resultMsg) appendMessage(mapMessage(resultMsg, userId));
    });
  }, [
    roomId,
    userId,
    productId,
    itemAmountParam,
    itemTitle,
    itemImage,
    messages,
    appendMessage,
  ]);

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || !roomId || sending) return;
    setSending(true);
    try {
      const out = await emitChatSocketAck("create_message", {
        room_id: roomId,
        type: "text",
        content: text,
        app_role: "customer",
      });
      if (!out.success) {
        setError(out.message || "Message not sent.");
        return;
      }
      setInput("");
      const resultMsg =
        out.result && typeof out.result === "object" && "message" in out.result
          ? out.result.message
          : null;
      if (resultMsg) appendMessage(mapMessage(resultMsg, userId));
    } finally {
      setSending(false);
    }
  };

  const postInvoiceRequest = async (shippingAddress, nextQty, variant) => {
    if (!roomId) return false;
    const out = await emitChatSocketAck("create_message", {
      room_id: roomId,
      type: "system",
      content: JSON.stringify({
        kind: "invoice_request",
        qty: Math.max(1, Number(nextQty) || 1),
        shippingAddress: shippingAddress || undefined,
        inventoryId: variant?.inventoryId || undefined,
        variantLabel: variant?.label || undefined,
        variantName: variant?.name || undefined,
        variantDetails: variant?.details?.length ? variant.details : undefined,
        itemAmount: variant?.price || unitPrice || itemAmountParam || undefined,
        itemTitle: itemTitle || undefined,
        itemImage: itemImage || undefined,
        productId: productId || undefined,
      }),
      app_role: "customer",
    });
    if (!out.success) {
      setError(out.message || "Request not sent.");
      return false;
    }
    const resultMsg =
      out.result && typeof out.result === "object" && "message" in out.result
        ? out.result.message
        : null;
    if (resultMsg) appendMessage(mapMessage(resultMsg, userId));
    return true;
  };

  const onRequestInvoice = () => {
    setError("");
    if (requestSending || pendingRequestId || openInvoicePending) return;
    if (!latestBuyerShipping) {
      setShippingOpen(true);
      return;
    }
    shippingRef.current = latestBuyerShipping;
    setQtyText("1");
    setQtyOpen(true);
  };

  const onSubmitShipping = async (event) => {
    event.preventDefault();
    if (requestSending || !roomId) return;
    const payload = {
      street: shippingDraft.street.trim(),
      area1: shippingDraft.area1.trim(),
      area2: shippingDraft.area2.trim(),
      state: shippingDraft.state.trim(),
      city: shippingDraft.city.trim(),
      zip: shippingDraft.zip.trim(),
    };
    if (payload.street.length < 2 || !payload.area1 || !payload.state || !payload.city) {
      setError("Enter street, area, state, and city.");
      return;
    }
    setRequestSending(true);
    try {
      const out = await emitChatSocketAck("create_message", {
        room_id: roomId,
        type: "system",
        content: JSON.stringify({
          kind: "shipping",
          ...payload,
          itemAmount: itemAmountParam || undefined,
          itemTitle: itemTitle || undefined,
          itemImage: itemImage || undefined,
          productId: productId || undefined,
        }),
        app_role: "customer",
      });
      if (!out.success) {
        setError(out.message || "Address not sent.");
        return;
      }
      const resultMsg =
        out.result && typeof out.result === "object" && "message" in out.result
          ? out.result.message
          : null;
      if (resultMsg) appendMessage(mapMessage(resultMsg, userId));
      shippingRef.current = { kind: "shipping", ...payload };
      setShippingOpen(false);
      setQtyText("1");
      setQtyOpen(true);
    } finally {
      setRequestSending(false);
    }
  };

  const onSubmitQty = async (event) => {
    event.preventDefault();
    if (requestSending) return;
    if (hasVariants && !selectedVariant) {
      setError("Select a variant before requesting an invoice.");
      return;
    }
    if (!(qty > 0)) {
      setError("Enter a quantity of at least 1.");
      return;
    }
    let variant = null;
    if (selectedVariant) {
      const attrs =
        selectedVariant.attributes && typeof selectedVariant.attributes === "object"
          ? selectedVariant.attributes
          : {};
      const details = attrKeys
        .filter((key) => attrs[key])
        .map((key) => ({ label: formatAttributeLabel(key), value: String(attrs[key]) }));
      const index = variants.findIndex((row) => row.optionKey === selectedVariant.optionKey);
      const inventoryId = Number(selectedVariant.id);
      variant = {
        inventoryId: Number.isFinite(inventoryId) && inventoryId > 0 ? inventoryId : undefined,
        label: details.map((row) => `${row.label}: ${row.value}`).join(" · "),
        name:
          index >= 0 && index < 26
            ? `Variant ${String.fromCharCode(65 + index)}`
            : `Variant ${index + 1}`,
        details,
        price: unitPrice > 0 ? unitPrice : undefined,
      };
    }
    setRequestSending(true);
    try {
      const sent = await postInvoiceRequest(
        shippingRef.current || latestBuyerShipping,
        qty,
        variant,
      );
      if (sent) setQtyOpen(false);
    } finally {
      setRequestSending(false);
    }
  };

  const openInvoiceCheckout = (invoice) => {
    if (!invoice) return;
    const amount = Number(invoice.amount) || 0;
    const shipping = Number(invoice.shipping) || 0;
    const sid = Number(invoice.shopId ?? invoice.shop_id ?? shopId) || 0;
    const params = new URLSearchParams({
      source: "chat_invoice",
      roomId: roomId || "",
      shipping: String(shipping),
      amount: String(amount),
      qty: String(Math.max(1, Number(invoice.qty) || 1)),
      productId: String(invoice.productId || productId || ""),
      title: String(invoice.itemTitle || itemTitle || "Product"),
      image: String(invoice.itemImage || itemImage || ""),
      shopId: String(sid || ""),
      inventoryId: String(invoice.inventoryId || ""),
      variantLabel: String(invoice.variantLabel || ""),
    });
    router.push(`/checkouts?${params.toString()}`);
  };

  if (!(shopId > 0)) {
    return (
      <div className="buyer-inbox">
        <p className="buyer-inbox__error">Open a chat from a product page to start a purchase.</p>
        <Link href="/vendors">Browse shops</Link>
      </div>
    );
  }

  return (
    <div className="buyer-inbox">
      <header className="buyer-inbox__header">
        <Link href={productId > 0 ? `/${productId}` : "/vendors"} className="buyer-inbox__back">
          ← Back
        </Link>
        <div>
          <h1 className="buyer-inbox__title">{shopName}</h1>
          <p className="buyer-inbox__sub">{itemTitle}</p>
        </div>
      </header>

      <div className="buyer-inbox__monitor">
        All messages in this chat are monitored and may be moderated to keep Deedyte scam-free.
        Never pay or share personal details outside the app.
      </div>

      <button
        type="button"
        className="buyer-inbox__request"
        disabled={Boolean(pendingRequestId) || openInvoicePending || requestSending || !roomId}
        onClick={onRequestInvoice}
      >
        {pendingRequestId
          ? "Checkout invoice requested"
          : openInvoicePending
            ? "Invoice open — wait for payment or cancel"
            : "Request checkout invoice"}
      </button>

      {status ? <p className="buyer-inbox__status">{status}</p> : null}
      {error ? (
        <p className="buyer-inbox__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="buyer-inbox__messages" ref={listRef}>
        {messages.length === 0 ? (
          <p className="buyer-inbox__empty">No messages yet. Say hello or request a checkout invoice.</p>
        ) : (
          messages.map((item) => {
            if (item.invoiceRequest) {
              const request = item.invoiceRequest;
              return (
                <article
                  key={item.id}
                  className={`buyer-inbox__bubble ${item.outgoing ? "is-out" : "is-in"}`}
                >
                  <p className="buyer-inbox__kicker">
                    {item.outgoing
                      ? "You requested a checkout invoice"
                      : "Buyer requested a checkout invoice"}
                  </p>
                  <p className="buyer-inbox__strong">{String(request.itemTitle || itemTitle)}</p>
                  <p>
                    Qty {Math.max(1, Number(request.qty) || 1)}
                    {Number(request.itemAmount) > 0
                      ? ` · ${formatNgn(request.itemAmount)} each`
                      : ""}
                  </p>
                  {request.variantLabel ? <p>{String(request.variantLabel)}</p> : null}
                  {formatShipping(request.shippingAddress) ? (
                    <p>Ship to: {formatShipping(request.shippingAddress)}</p>
                  ) : null}
                  <time>{item.timeLabel}</time>
                </article>
              );
            }
            if (item.invoice) {
              const invoice = item.invoice;
              const invoiceQty = Math.max(1, Number(invoice.qty) || 1);
              const amount = (Number(invoice.amount) || 0) * invoiceQty;
              const shippingFee = Number(invoice.shipping) || 0;
              const total = amount + shippingFee;
              return (
                <article
                  key={item.id}
                  className={`buyer-inbox__bubble ${item.outgoing ? "is-out" : "is-in"}`}
                >
                  <p className="buyer-inbox__strong">{formatNgn(total)} is your checkout total.</p>
                  {invoice.variantLabel ? <p>Variant {String(invoice.variantLabel)}</p> : null}
                  <p>
                    Items {invoiceQty} × {formatNgn(Number(invoice.amount) || 0)}. Shipping{" "}
                    {formatNgn(shippingFee)}.
                  </p>
                  <button
                    type="button"
                    className="buyer-inbox__pay"
                    onClick={() => openInvoiceCheckout(invoice)}
                  >
                    Pay invoice
                  </button>
                  <time>{item.timeLabel}</time>
                </article>
              );
            }
            if (item.shipping) {
              return (
                <article
                  key={item.id}
                  className={`buyer-inbox__bubble ${item.outgoing ? "is-out" : "is-in"}`}
                >
                  <p className="buyer-inbox__kicker">
                    {item.outgoing ? "Shipping details sent" : "Buyer shipping details"}
                  </p>
                  <p>{formatShipping(item.shipping)}</p>
                  <time>{item.timeLabel}</time>
                </article>
              );
            }
            return (
              <article
                key={item.id}
                className={`buyer-inbox__bubble ${item.outgoing ? "is-out" : "is-in"}`}
              >
                <p>{item.text}</p>
                <time>{item.timeLabel}</time>
              </article>
            );
          })
        )}
      </div>

      <form
        className="buyer-inbox__composer"
        onSubmit={(event) => {
          event.preventDefault();
          void onSend();
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Message"
          aria-label="Message"
        />
        <button type="submit" disabled={!input.trim() || sending || !roomId}>
          Send
        </button>
      </form>

      {shippingOpen ? (
        <div className="buyer-inbox__modal" role="dialog" aria-modal="true">
          <form className="buyer-inbox__sheet" onSubmit={onSubmitShipping}>
            <h2>Shipping address</h2>
            <p>Add where the vendor should deliver this order.</p>
            <label>
              Street
              <input
                value={shippingDraft.street}
                onChange={(event) =>
                  setShippingDraft((prev) => ({ ...prev, street: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Area / landmark
              <input
                value={shippingDraft.area1}
                onChange={(event) =>
                  setShippingDraft((prev) => ({ ...prev, area1: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Area 2 (optional)
              <input
                value={shippingDraft.area2}
                onChange={(event) =>
                  setShippingDraft((prev) => ({ ...prev, area2: event.target.value }))
                }
              />
            </label>
            <label>
              State
              <select
                value={shippingDraft.state}
                onChange={(event) =>
                  setShippingDraft((prev) => ({ ...prev, state: event.target.value, city: "" }))
                }
                required
              >
                <option value="">Select a state</option>
                {NIGERIAN_STATE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              City
              <input
                value={shippingDraft.city}
                onChange={(event) =>
                  setShippingDraft((prev) => ({ ...prev, city: event.target.value }))
                }
                required
              />
            </label>
            <label>
              ZIP (optional)
              <input
                value={shippingDraft.zip}
                onChange={(event) =>
                  setShippingDraft((prev) => ({ ...prev, zip: event.target.value }))
                }
              />
            </label>
            <div className="buyer-inbox__sheet-actions">
              <button type="button" onClick={() => setShippingOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={requestSending}>
                Continue
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {qtyOpen ? (
        <div className="buyer-inbox__modal" role="dialog" aria-modal="true">
          <form className="buyer-inbox__sheet" onSubmit={onSubmitQty}>
            <h2>How many do you need?</h2>
            <p>The vendor uses this to prepare your checkout invoice.</p>
            <div className="buyer-inbox__product">
              {itemImage ? <img src={itemImage} alt="" /> : null}
              <div>
                <strong>{itemTitle}</strong>
                {unitPrice > 0 ? <p>{formatNgn(unitPrice)}</p> : null}
              </div>
            </div>
            {hasVariants ? (
              <div className="buyer-inbox__variants">
                <h3>{variants.length === 1 ? "Features" : "Select a variant"}</h3>
                <ProductVariantCardPicker
                  attrKeys={attrKeys}
                  variants={variants}
                  selectedVariant={selectedVariant}
                  onSelect={setSelectedVariant}
                />
              </div>
            ) : null}
            <label>
              Quantity
              <input
                inputMode="numeric"
                value={qtyText}
                onChange={(event) =>
                  setQtyText(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))
                }
              />
            </label>
            {unitPrice > 0 && qty > 0 ? (
              <p>Items subtotal: {formatNgn(unitPrice * qty)}</p>
            ) : null}
            <div className="buyer-inbox__sheet-actions">
              <button type="button" onClick={() => setQtyOpen(false)}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={requestSending || qty <= 0 || (hasVariants && !selectedVariant)}
              >
                Request invoice
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function StoreInboxPage() {
  return (
    <Suspense fallback={<p className="buyer-inbox__status">Loading chat…</p>}>
      <InboxInner />
    </Suspense>
  );
}
