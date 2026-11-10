"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDisplayDate } from "@/lib/formatDisplayDate";
import {
  DEFAULT_AVATAR,
  ORDER_TIMELINE_STEP_TITLES,
  formatNaira,
} from "../orderDemoData";
import "./styles/xxl.css";
import "./styles/s.css";
import { API_BACKEND, buyerAuthHeaders } from "@/reusables/shopBackendAuth";

const ORDER_THUMB =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#e5e5e5"/></svg>`
  );

const DISPUTE_CLOSED_STATUSES = new Set([
  "resolved",
  "closed",
  "won",
  "lost",
  "denied",
  "dismissed",
  "refunded",
]);

function isDisputeOpenStatus(statusRaw) {
  const s = String(statusRaw || "").trim().toLowerCase();
  if (!s) return true;
  return !DISPUTE_CLOSED_STATUSES.has(s);
}


const DISPUTE_REASON_OPTIONS = [
  { value: "", label: "Choose a reason…" },

  // Delivery issues
  { value: "item_not_received", label: "Item not received — order never arrived" },
  { value: "significant_delay", label: "Significant delay — item is far past expected delivery date" },

  // Item condition / accuracy
  { value: "wrong_item", label: "Wrong item — received something different from my order" },
  { value: "item_damaged", label: "Item damaged — arrived broken or unusable" },
  { value: "not_as_described", label: "Not as described — wrong specs, color, size, or model" },
  { value: "incomplete_order", label: "Incomplete order — missing items, parts, or accessories" },
  { value: "counterfeit_item", label: "Counterfeit or fake — suspected inauthentic product" },

  // Payment & billing
  { value: "unauthorized_charge", label: "Unauthorized charge — I did not make this purchase" },
  { value: "duplicate_charge", label: "Duplicate charge — charged more than once for the same order" },
  { value: "overcharged", label: "Overcharged — billed a different amount than agreed" },
  { value: "refund_not_processed", label: "Refund not processed — approved refund never received" },

  // Seller conduct
  { value: "seller_unresponsive", label: "Seller unresponsive — no reply after multiple attempts" },
  { value: "order_cancelled_no_refund", label: "Order cancelled without refund — seller cancelled but kept payment" },

  { value: "other", label: "Other — describe below" },
];

const ITEM_CONDITION_OPTIONS = [
  { value: "", label: "Select item condition…" },

  // No item involved
  { value: "not_applicable", label: "Not applicable — no item received yet (e.g. non-delivery, delay)" },

  // Item received, condition-based
  { value: "as_described", label: "Item matches listing — issue is unrelated to condition" },
  { value: "minor_damage", label: "Minor damage — slight wear, dents, or torn packaging" },
  { value: "major_damage", label: "Major damage — broken, non-functional, or unusable" },
  { value: "wrong_item", label: "Wrong item received — completely different from what I ordered" },
  { value: "incomplete_item", label: "Incomplete — missing parts, accessories, or components" },
  { value: "not_as_described", label: "Not as described — wrong specs, color, size, or model" },
  { value: "counterfeit", label: "Counterfeit or fake — suspected inauthentic product" },
];

const PREFERRED_RESOLUTION_OPTIONS = [
  { value: "", label: "Choose preferred resolution…" },
  { value: "full_refund", label: "Full refund" },
  { value: "partial_refund", label: "Partial refund" },
  { value: "exchange", label: "Exchange for the correct item" },
];

const EVIDENCE_REQUIRED_CONDITIONS = new Set([
  "minor_damage",
  "major_damage",
  "wrong_item",
  "not_as_described",
]);

/** Max image attachments per dispute; each file must be under MAX_EVIDENCE_FILE_BYTES. */
const MAX_EVIDENCE_FILES = 3;
const MAX_EVIDENCE_FILE_BYTES = 5 * 1024 * 1024;

function isItemNotReceivedReason(preset) {
  return String(preset || "").trim() === "Item not received";
}

function needsEvidenceFiles(preset, itemCondition) {
  if (isItemNotReceivedReason(preset)) return false;
  if (preset === "Wrong or damaged item") return true;
  return EVIDENCE_REQUIRED_CONDITIONS.has(itemCondition);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
}

function labelForCondition(value) {
  const o = ITEM_CONDITION_OPTIONS.find((x) => x.value === value);
  return o ? o.label : value;
}

function labelForResolution(value) {
  const o = PREFERRED_RESOLUTION_OPTIONS.find((x) => x.value === value);
  return o ? o.label : value;
}

function normalizeDetailStatus(st) {
  const s = String(st || "").toLowerCase();
  if (s.includes("cancel")) return "canceled";
  if (s.includes("return")) return "returned";
  if (s.includes("deliver") || s.includes("complete")) return "delivered";
  return "waiting";
}

function buildSteps(row) {
  const dateIso = row.date ? new Date(row.date).toISOString() : null;
  const statusNorm = normalizeDetailStatus(row.status);
  return ORDER_TIMELINE_STEP_TITLES.map((title, i) => {
    if (i === 0) {
      return { title, date: dateIso, done: !!dateIso };
    }
    if (title === "Delivered" && statusNorm === "delivered") {
      return { title, date: dateIso, done: true };
    }
    if (statusNorm === "canceled" && i > 0) {
      return { title, date: null, done: false };
    }
    return { title, date: null, done: false };
  });
}

function mapRowToDetail(row) {
  const headlineStatus =
    String(row.status || row.delivery || "—").trim() || "—";
  return {
    orderDisplayId: String(row.order_id),
    headlineStatus,
    steps: buildSteps(row),
    product: {
      name: row.product || "—",
      description:
        row.qty != null ? `Quantity: ${row.qty}` : "—",
      thumb: ORDER_THUMB,
    },
    itemsCount: Number(row.qty) || 0,
    itemsTotal: Number(row.amount) || 0,
    shipping: 0,
    total: Number(row.amount) || 0,
    other: {
      sellerName: "—",
      phone: row.customer_phone || "—",
      deliveryAddress: "—",
      stateLine: "—",
    },
    seller: {
      displayName: "—",
      avatar: DEFAULT_AVATAR,
    },
  };
}

export default function OrderDetailPage() {
  const params = useParams();
  const id = params?.id != null ? String(params.id) : "";
  const orderIdNum = useMemo(() => {
    const n = parseInt(String(id), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [id]);

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeReasonPreset, setDisputeReasonPreset] = useState("");
  const [disputeReasonOther, setDisputeReasonOther] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [disputeExpected, setDisputeExpected] = useState("");
  const [disputeReceived, setDisputeReceived] = useState("");
  const [disputeItemCondition, setDisputeItemCondition] = useState("");
  const [disputePreferredResolution, setDisputePreferredResolution] = useState("");
  const [disputeEvidenceAttachments, setDisputeEvidenceAttachments] = useState([]);
  const disputeEvidenceRef = useRef([]);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeFeedback, setDisputeFeedback] = useState("");
  const [disputeFormError, setDisputeFormError] = useState("");
  const [existingOpenDispute, setExistingOpenDispute] = useState(null);
  const [disputesChecked, setDisputesChecked] = useState(false);

  const loadExistingDisputeForOrder = useCallback(async () => {
    if (orderIdNum == null) {
      setExistingOpenDispute(null);
      setDisputesChecked(true);
      return;
    }
    try {
      const res = await fetch(
        `${API_BACKEND}/buyer/disputes?includeClosed=true&backfill=false`,
        {
          method: "GET",
          credentials: "include",
          headers: buyerAuthHeaders(),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setExistingOpenDispute(null);
        return;
      }
      const rows = Array.isArray(data.disputes) ? data.disputes : [];
      const match = rows.find(
        (d) =>
          d != null &&
          Number(d.order_id) === orderIdNum &&
          isDisputeOpenStatus(d.status)
      );
      setExistingOpenDispute(match ?? null);
    } catch {
      setExistingOpenDispute(null);
    } finally {
      setDisputesChecked(true);
    }
  }, [orderIdNum]);

  useEffect(() => {
    if (!id) {
      setDetail(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BACKEND}/buyer/orders/${encodeURIComponent(id)}`,
          {
            method: "GET",
            credentials: "include",
            headers: buyerAuthHeaders(),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setDetail(null);
          setLoading(false);
          return;
        }
        setDetail(mapRowToDetail(data.order));
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    void loadExistingDisputeForOrder();
  }, [loadExistingDisputeForOrder]);

  useEffect(() => {
    disputeEvidenceRef.current = disputeEvidenceAttachments;
  }, [disputeEvidenceAttachments]);

  const resetDisputeFormFields = () => {
    setDisputeReasonPreset("");
    setDisputeReasonOther("");
    setDisputeDescription("");
    setDisputeExpected("");
    setDisputeReceived("");
    setDisputeItemCondition("");
    setDisputePreferredResolution("");
    setDisputeEvidenceAttachments([]);
  };

  const removeEvidenceAttachment = (attachmentId) => {
    setDisputeEvidenceAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    setDisputeFormError("");
  };

  const handleEvidenceFilesAdd = async (e) => {
    const input = e.target;
    const files = Array.from(input.files || []);
    input.value = "";
    setDisputeFormError("");
    if (!files.length) return;

    const existing = disputeEvidenceRef.current;
    const room = MAX_EVIDENCE_FILES - existing.length;
    if (room <= 0) {
      setDisputeFormError(`You can attach at most ${MAX_EVIDENCE_FILES} images.`);
      return;
    }

    const picked = files.slice(0, room);
    const next = [...existing];
    try {
      for (let i = 0; i < picked.length; i++) {
        const file = picked[i];
        if (!file.type.startsWith("image/")) {
          setDisputeFormError("Evidence must be image files only (JPEG, PNG, WebP, etc.).");
          return;
        }
        if (file.size > MAX_EVIDENCE_FILE_BYTES) {
          setDisputeFormError("Each image must be smaller than 5 MB.");
          return;
        }
        const dataUrl = await readFileAsDataUrl(file);
        next.push({
          id: `ev-${Date.now()}-${i}-${file.name}`,
          name: file.name,
          mime: file.type,
          data_url: dataUrl,
        });
      }
      setDisputeEvidenceAttachments(next);
    } catch {
      setDisputeFormError("Could not read one of the images. Try another file.");
    }
  };

  const submitDispute = async (e) => {
    e.preventDefault();
    setDisputeFormError("");
    if (orderIdNum == null) {
      setDisputeFormError("Invalid order.");
      return;
    }
    let reason = "";
    if (disputeReasonPreset === "Other") {
      reason = disputeReasonOther.trim();
      if (!reason) {
        setDisputeFormError("Please enter a short reason.");
        return;
      }
    } else {
      reason = disputeReasonPreset.trim();
    }
    if (!reason) {
      setDisputeFormError("Please select a reason.");
      return;
    }

    const showMismatchFields =
      Boolean(disputeReasonPreset) && !isItemNotReceivedReason(disputeReasonPreset);

    const expected = disputeExpected.trim();
    const received = disputeReceived.trim();
    if (showMismatchFields) {
      if (expected.length < 5) {
        setDisputeFormError("Please describe what you expected (at least 5 characters).");
        return;
      }
      if (received.length < 5) {
        setDisputeFormError("Please describe what you received (at least 5 characters).");
        return;
      }
      if (!disputeItemCondition) {
        setDisputeFormError("Please select the item condition.");
        return;
      }
    }

    const notReceived = isItemNotReceivedReason(disputeReasonPreset);
    const itemReceivedDispute = Boolean(disputeReasonPreset) && !notReceived;
    const preferredResolutionEffective = notReceived
      ? "full_refund"
      : disputePreferredResolution.trim();
    if (!notReceived && !preferredResolutionEffective) {
      setDisputeFormError("Please select your preferred resolution.");
      return;
    }

    const customerNote = disputeDescription.trim();
    if (customerNote.length < 10) {
      setDisputeFormError(
        "Please add your customer note on the product (at least 10 characters)."
      );
      return;
    }

    const evidenceRequired = needsEvidenceFiles(
      disputeReasonPreset,
      disputeItemCondition
    );
    if (evidenceRequired && disputeEvidenceAttachments.length === 0) {
      setDisputeFormError(
        "Please attach at least one image as evidence (files only, under 5 MB each)."
      );
      return;
    }

    const descriptionParts = [];
    if (showMismatchFields) {
      descriptionParts.push(
        `What I expected:\n${expected}`,
        `What I received:\n${received}`,
        `Item condition: ${labelForCondition(disputeItemCondition)}`
      );
    }
    descriptionParts.push(
      `Preferred resolution: ${labelForResolution(preferredResolutionEffective)}`,
      `Customer note on the product:\n${customerNote}`
    );
    const description = descriptionParts.join("\n\n");

    setDisputeSubmitting(true);
    try {
      const metadata = {
        order_route_id: id,
        preferred_resolution: preferredResolutionEffective,
        customer_note_on_product: customerNote,
      };
      if (notReceived) {
        metadata.resolution_locked = "full_refund_not_received";
      }
      if (showMismatchFields) {
        metadata.expected = expected;
        metadata.received = received;
        metadata.item_condition = disputeItemCondition;
      }
      if (itemReceivedDispute && disputeEvidenceAttachments.length > 0) {
        metadata.evidence_attachments = disputeEvidenceAttachments.map((a) => ({
          name: a.name,
          mime: a.mime,
          data_url: a.data_url,
        }));
      }

      const res = await fetch(`${API_BACKEND}/buyer/disputes`, {
        method: "POST",
        credentials: "include",
        headers: buyerAuthHeaders(),
        body: JSON.stringify({
          order_id: orderIdNum,
          reason,
          description,
          source: "customer_order_detail",
          metadata,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDisputeFormError(
          typeof data.error === "string" ? data.error : "Could not create dispute."
        );
        return;
      }
      setDisputeFormError("");
      setDisputeModalOpen(false);
      resetDisputeFormFields();
      await loadExistingDisputeForOrder();
      const created = data.dispute;
      const ref =
        created && typeof created.dispute_id === "string"
          ? created.dispute_id
          : "";
      setDisputeFeedback(
        ref
          ? `Dispute ${ref} was submitted. You can track it under Disputes.`
          : "Your dispute was submitted. You can track it under Disputes."
      );
    } catch {
      setDisputeFormError("Could not create dispute. Try again.");
    } finally {
      setDisputeSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="od-page od-page--empty">
        <p className="od-empty-msg">Loading…</p>
        <Link href="/store/orders" className="od-empty-link">
          Back to orders
        </Link>
      </div>
    );
  }

  /** Item received in dispute context = not the “Item not received” reason (evidence only then). */
  const showMismatchFieldsUi =
    Boolean(disputeReasonPreset) && !isItemNotReceivedReason(disputeReasonPreset);
  const evidenceSectionVisible = showMismatchFieldsUi;
  const evidenceRequiredUi =
    evidenceSectionVisible &&
    needsEvidenceFiles(disputeReasonPreset, disputeItemCondition);

  if (!detail) {
    return (
      <div className="od-page od-page--empty">
        <p className="od-empty-msg">We could not find this order.</p>
        <Link href="/store/orders" className="od-empty-link">
          Back to orders
        </Link>
      </div>
    );
  }

  const { steps, product, other, seller } = detail;

  return (
    <div className="od-page">
      <section className="od-top-card" aria-labelledby="od-order-heading">
        <div className="od-top-card__head">
          <div className="od-top-card__intro">
            <h1 id="od-order-heading" className="od-order-id">
              Order ID #{detail.orderDisplayId}
            </h1>
            <nav className="od-breadcrumb" aria-label="Breadcrumb">
              <Link href="/store/orders">Orders</Link>
              <span className="od-breadcrumb__sep" aria-hidden="true">
                /
              </span>
              <span className="od-breadcrumb__current">Order Details</span>
            </nav>
          </div>
          <div className="od-top-card__actions">
            <button type="button" className="od-btn od-btn--outline">
              Reject Order
            </button>
            <button type="button" className="od-btn od-btn--primary">
              Receive Order
            </button>
          </div>
        </div>

        <div className="od-status-panel">
          <h2 className="od-status-panel__title">{detail.headlineStatus}</h2>
          <ol className="od-stepper" aria-label="Order progress">
            {(() => {
              const firstOpen = steps.findIndex((s) => !s.done);
              return steps.map((step, i) => {
                const phase = step.done
                  ? "complete"
                  : i === firstOpen
                    ? "current"
                    : "upcoming";

                return (
                  <li key={step.title + String(i)} className="od-stepper__col">
                    <div className="od-stepper__rail">
                      {i > 0 ? (
                        <span
                          className={`od-stepper__line od-stepper__line--before ${steps[i - 1].done ? "od-stepper__line--done" : "od-stepper__line--pending"}`}
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="od-stepper__line-spacer" aria-hidden="true" />
                      )}
                      <span
                        className={`od-stepper__node od-stepper__node--${phase}`}
                        aria-current={phase === "current" ? "step" : undefined}
                      >
                        <span className="od-stepper__num">{i + 1}</span>
                      </span>
                      {i < steps.length - 1 ? (
                        <span
                          className={`od-stepper__line od-stepper__line--after ${step.done ? "od-stepper__line--done" : "od-stepper__line--pending"}`}
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="od-stepper__line-spacer" aria-hidden="true" />
                      )}
                    </div>
                    <span className={`od-stepper__label-title od-stepper__label-title--${phase}`}>
                      {step.title}
                    </span>
                    <span className={`od-stepper__label-date od-stepper__label-date--${phase}`}>
                      {formatDisplayDate(step.date)}
                    </span>
                  </li>
                );
              });
            })()}
          </ol>
        </div>
      </section>

      <div className="od-bottom">
        <div className="od-panel od-panel--main">
          <div className="od-product-row">
            <div className="od-product-row__thumb-wrap">
              <img
                className="od-product-row__thumb"
                src={product.thumb}
                alt=""
                width={88}
                height={88}
              />
            </div>
            <div className="od-product-row__text">
              <p className="od-product-row__name">{product.name}</p>
              <p className="od-product-row__desc">{product.description}</p>
            </div>
          </div>

          <dl className="od-price-summary">
            <div className="od-price-summary__row">
              <dt>Items ({detail.itemsCount})</dt>
              <dd>{formatNaira(detail.itemsTotal)}</dd>
            </div>
            <div className="od-price-summary__row">
              <dt>Shipping</dt>
              <dd>{formatNaira(detail.shipping)}</dd>
            </div>
            <div className="od-price-summary__row od-price-summary__row--total">
              <dt>Total</dt>
              <dd>{formatNaira(detail.total)}</dd>
            </div>
          </dl>

          <h3 className="od-subheading">Other details</h3>
          <dl className="od-kv">
            <div className="od-kv__row">
              <dt>Seller&apos;s Name</dt>
              <dd>{other.sellerName}</dd>
            </div>
            <div className="od-kv__row">
              <dt>Delivery Address</dt>
              <dd>{other.deliveryAddress}</dd>
            </div>
            <div className="od-kv__row">
              <dt>State</dt>
              <dd>{other.stateLine}</dd>
            </div>
          </dl>
        </div>

        <aside className="od-panel od-panel--seller" aria-label="Seller">
          <div className="od-seller">
            <img
              className="od-seller__avatar"
              src={seller.avatar}
              alt=""
              width={96}
              height={96}
            />
            <p className="od-seller__name">{seller.displayName}</p>
            <button type="button" className="od-btn od-btn--primary od-btn--block">
              Chat Seller
            </button>
            {existingOpenDispute ? (
              <Link
                href={`/store/disputes#dispute-${String(existingOpenDispute.order_id ?? id)}`}
                className="od-btn od-btn--muted od-btn--block"
              >
                View open dispute
              </Link>
            ) : (
              <button
                type="button"
                className="od-btn od-btn--muted od-btn--block"
                disabled={!disputesChecked}
                onClick={() => {
                  setDisputeFeedback("");
                  setDisputeFormError("");
                  resetDisputeFormFields();
                  setDisputeModalOpen(true);
                }}
              >
                Open Dispute
              </button>
            )}
          </div>
        </aside>
      </div>

      {disputeFeedback ? (
        <p className="od-dispute-banner" role="status">
          {disputeFeedback}{" "}
          {disputeFeedback.includes("Disputes") ? (
            <Link href="/store/disputes">Go to Disputes</Link>
          ) : null}
        </p>
      ) : null}

      {disputeModalOpen ? (
        <div
          className="od-modal-backdrop"
          role="presentation"
          onClick={() => !disputeSubmitting && setDisputeModalOpen(false)}
        >
          <div
            className="od-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="od-dispute-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="od-dispute-title" className="od-modal__title">
              Open a dispute
            </h2>
            <p className="od-modal__hint">
              Order #{detail.orderDisplayId}. Your answers are stored with the dispute for support
              and the vendor.
            </p>
            <form className="od-dispute-form" onSubmit={(e) => void submitDispute(e)}>
              <label className="od-dispute-label" htmlFor="od-dispute-reason">
                Reason
              </label>
              <select
                id="od-dispute-reason"
                className="od-dispute-input"
                value={disputeReasonPreset}
                onChange={(e) => {
                  const v = e.target.value;
                  const wasNotReceived = isItemNotReceivedReason(disputeReasonPreset);
                  setDisputeReasonPreset(v);
                  if (isItemNotReceivedReason(v)) {
                    setDisputeExpected("");
                    setDisputeReceived("");
                    setDisputeItemCondition("");
                    setDisputePreferredResolution("full_refund");
                    setDisputeEvidenceAttachments([]);
                  } else if (wasNotReceived) {
                    setDisputePreferredResolution("");
                  }
                }}
                required
              >
                {DISPUTE_REASON_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {disputeReasonPreset === "Other" ? (
                <>
                  <label className="od-dispute-label" htmlFor="od-dispute-reason-custom">
                    Describe your reason
                  </label>
                  <input
                    id="od-dispute-reason-custom"
                    type="text"
                    className="od-dispute-input"
                    placeholder="Short summary"
                    value={disputeReasonOther}
                    onChange={(e) => setDisputeReasonOther(e.target.value)}
                  />
                </>
              ) : null}

              {showMismatchFieldsUi ? (
                <>
                  <label className="od-dispute-label" htmlFor="od-dispute-expected">
                    What you expected
                  </label>
                  <textarea
                    id="od-dispute-expected"
                    className="od-dispute-textarea od-dispute-textarea--short"
                    rows={3}
                    placeholder="Short notes: size, colour, model, or what the listing promised."
                    value={disputeExpected}
                    onChange={(e) => setDisputeExpected(e.target.value)}
                  />

                  <label className="od-dispute-label" htmlFor="od-dispute-received">
                    What you got
                  </label>
                  <textarea
                    id="od-dispute-received"
                    className="od-dispute-textarea od-dispute-textarea--short"
                    rows={3}
                    placeholder="Short notes: what arrived and how it differs from what you expected."
                    value={disputeReceived}
                    onChange={(e) => setDisputeReceived(e.target.value)}
                  />

                  <label className="od-dispute-label" htmlFor="od-dispute-condition">
                    Item condition
                  </label>
                  <select
                    id="od-dispute-condition"
                    className="od-dispute-input"
                    value={disputeItemCondition}
                    onChange={(e) => setDisputeItemCondition(e.target.value)}
                  >
                    {ITEM_CONDITION_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : disputeReasonPreset === "Item not received" ? (
                <p className="od-dispute-help od-dispute-help--standalone">
                  For &ldquo;Item not received&rdquo;, resolution is <strong>full refund</strong> only.
                  Add your customer note below. Photo evidence does not apply (you did not receive the
                  item).
                </p>
              ) : null}

              {isItemNotReceivedReason(disputeReasonPreset) ? (
                <div className="od-dispute-resolution-fixed" role="status">
                  <span className="od-dispute-label">Preferred resolution</span>
                  <p className="od-dispute-resolution-fixed__value">
                    Full refund <span className="od-dispute-resolution-fixed__note">(only option)</span>
                  </p>
                </div>
              ) : (
                <>
                  <label className="od-dispute-label" htmlFor="od-dispute-resolution">
                    Preferred resolution
                  </label>
                  <select
                    id="od-dispute-resolution"
                    className="od-dispute-input"
                    value={disputePreferredResolution}
                    onChange={(e) => setDisputePreferredResolution(e.target.value)}
                  >
                    {PREFERRED_RESOLUTION_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <label className="od-dispute-label" htmlFor="od-dispute-desc">
                Customer note on the product <span className="od-dispute-required">(required)</span>
              </label>
              <textarea
                id="od-dispute-desc"
                className="od-dispute-textarea"
                rows={3}
                required
                minLength={10}
                placeholder="Describe the product and what went wrong (at least 10 characters)."
                value={disputeDescription}
                onChange={(e) => setDisputeDescription(e.target.value)}
              />

              {evidenceSectionVisible ? (
                <fieldset className="od-dispute-fieldset">
                  <legend className="od-dispute-legend">Evidence (images only)</legend>
                  <p className="od-dispute-help">
                    {evidenceRequiredUi ? (
                      <>
                        <strong>Required:</strong> attach at least one image (each under 5 MB).
                        Previews appear below.
                      </>
                    ) : (
                      <>
                        Optional: attach images if helpful (each under 5 MB, up to{" "}
                        {MAX_EVIDENCE_FILES} files). Files only.
                      </>
                    )}
                  </p>
                  <label className="od-dispute-label" htmlFor="od-dispute-evidence-files">
                    Add images
                  </label>
                  <input
                    id="od-dispute-evidence-files"
                    type="file"
                    className="od-dispute-file"
                    accept="image/*"
                    multiple
                    onChange={(e) => void handleEvidenceFilesAdd(e)}
                  />
                  {disputeEvidenceAttachments.length ? (
                    <ul className="od-evidence-preview-list" aria-label="Attached evidence previews">
                      {disputeEvidenceAttachments.map((a) => (
                        <li key={a.id} className="od-evidence-preview-item">
                          <div className="od-evidence-preview-frame">
                            <img
                              src={a.data_url}
                              alt={`Preview: ${a.name}`}
                              className="od-evidence-preview-img"
                            />
                          </div>
                          <span className="od-evidence-preview-name">{a.name}</span>
                          <button
                            type="button"
                            className="od-evidence-preview-remove"
                            onClick={() => removeEvidenceAttachment(a.id)}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </fieldset>
              ) : null}

              {disputeFormError ? (
                <p className="od-dispute-inline-error" role="alert">
                  {disputeFormError}
                </p>
              ) : null}

              <div className="od-modal__actions">
                <button
                  type="button"
                  className="od-btn od-btn--muted"
                  disabled={disputeSubmitting}
                  onClick={() => setDisputeModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="od-btn od-btn--primary"
                  disabled={disputeSubmitting}
                >
                  {disputeSubmitting ? "Submitting…" : "Submit dispute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
