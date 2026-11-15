"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IoCheckmarkCircle, IoChevronDown } from "react-icons/io5";
import "./assets/product-variant-picker.css";

function formatNgn(n) {
  return `₦${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

function formatAttributeLabel(key) {
  return String(key ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function variantTitle(index) {
  if (index >= 0 && index < 26) return `Variant ${String.fromCharCode(65 + index)}`;
  return `Variant ${index + 1}`;
}

function isPurchasable(variant) {
  if (!variant) return false;
  if (variant.allowBackorder) return true;
  const stock = Number(variant.stock);
  if (!Number.isFinite(stock)) return true;
  return stock > 0;
}

function variantMatches(a, b) {
  if (!a || !b) return false;
  if (a.optionKey != null && b.optionKey != null) return String(a.optionKey) === String(b.optionKey);
  if (a.id != null && b.id != null) return String(a.id) === String(b.id);
  return false;
}

function SpecTile({ label, value }) {
  return (
    <div className="pdp-variant-tile">
      <span className="pdp-variant-tile__label">{label}</span>
      <span className="pdp-variant-tile__value">{value}</span>
    </div>
  );
}

function attributeEntries(variant, attrKeys) {
  const attrs = variant?.attributes && typeof variant.attributes === "object" ? variant.attributes : {};
  const keys = Array.isArray(attrKeys) && attrKeys.length > 0 ? attrKeys : Object.keys(attrs);
  const entries = [];
  for (const key of keys) {
    const raw = attrs[key] != null ? String(attrs[key]).trim() : "";
    if (!raw || raw === "—" || raw === "-") continue;
    entries.push({ key, label: formatAttributeLabel(key).toUpperCase(), value: raw });
  }
  return entries;
}

function VariantCard({ variant, index, attrKeys, selected, disabled, onPress, showPrice = true }) {
  const price = Number(variant?.price);
  const priceLabel = Number.isFinite(price) && price > 0 ? formatNgn(price) : "—";
  const specs = attributeEntries(variant, attrKeys);

  return (
    <button
      type="button"
      className={`pdp-variant-card${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onPress();
      }}
    >
      <div className="pdp-variant-card__head">
        <strong>{variantTitle(index)}</strong>
        {selected ? <IoCheckmarkCircle size={20} color="#00926e" /> : null}
      </div>
      <div className="pdp-variant-card__grid">
        {specs.map((spec) => (
          <SpecTile key={spec.key} label={spec.label} value={spec.value} />
        ))}
        {showPrice && priceLabel !== "—" ? <SpecTile label="PRICE" value={priceLabel} /> : null}
        {specs.length === 0 && priceLabel === "—" ? (
          <SpecTile label="OPTION" value={`Choice ${index + 1}`} />
        ) : null}
      </div>
    </button>
  );
}

export default function ProductVariantCardPicker({ attrKeys = [], variants = [], selectedVariant, onSelect }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rows = Array.isArray(variants) ? variants : [];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const summary = useMemo(() => {
    if (!selectedVariant) return "";
    const details = attributeEntries(selectedVariant, attrKeys).map(
      (entry) => `${formatAttributeLabel(entry.key)}: ${entry.value}`,
    );
    const price = Number(selectedVariant.price);
    const pricePart = Number.isFinite(price) && price > 0 ? formatNgn(price) : "";
    if (pricePart && details.length) return `${pricePart} · ${details.join(" · ")}`;
    return pricePart || details.join(" · ");
  }, [selectedVariant, attrKeys]);

  if (rows.length === 1) {
    return (
      <VariantCard
        variant={rows[0]}
        index={0}
        attrKeys={attrKeys}
        selected
        disabled={!isPurchasable(rows[0])}
        showPrice={false}
        onPress={() => onSelect(rows[0])}
      />
    );
  }

  return (
    <>
      <button type="button" className="pdp-variant-trigger" onClick={() => setOpen(true)}>
        <span className={summary ? "" : "is-placeholder"}>{summary || "Select an Option (variant)"}</span>
        <IoChevronDown size={18} />
      </button>
      {open && mounted
        ? createPortal(
            <div className="pdp-variant-sheet">
              <button type="button" className="pdp-variant-sheet__backdrop" aria-label="Close" onClick={() => setOpen(false)} />
              <div className="pdp-variant-sheet__panel" role="dialog" aria-modal="true" aria-label="Choose a variant">
                <div className="pdp-variant-sheet__header">
                  <div className="pdp-variant-sheet__grabber" />
                  <h3>Choose a variant</h3>
                  <p>Pick color, material, and other options. The price updates for your selection.</p>
                </div>
                <div className="pdp-variant-sheet__list">
                  {rows.length === 0 ? (
                    <p className="pdp-variant-sheet__empty">No variants are available for this product.</p>
                  ) : (
                    rows.map((variant, index) => (
                      <VariantCard
                        key={variant.optionKey || `${variant.id}-${index}`}
                        variant={variant}
                        index={index}
                        attrKeys={attrKeys}
                        selected={variantMatches(variant, selectedVariant)}
                        disabled={!isPurchasable(variant)}
                        onPress={() => {
                          onSelect(variant);
                          setOpen(false);
                        }}
                      />
                    ))
                  )}
                </div>
                <div className="pdp-variant-sheet__footer">
                  <button type="button" className="pdp-variant-sheet__done" onClick={() => setOpen(false)}>
                    Done
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export { formatAttributeLabel };
