"use client";

// import searchSvg from "@/svgs/search-alt-svgrepo-com (1).svg";
import "./styles/xxl.css";
import "./styles/s.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import ProductReviews from "@/components/customers/Review";
import { API_BACKEND, buyerAuthHeaders } from "@/reusables/shopBackendAuth";
import Link from "next/link";
import { usePaystackPayment } from "react-paystack";

const AUTH_URL = "/api/user/authorization";

const PAYSTACK_PUBLIC_KEY =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY) ||
  "pk_test_9d54d1840154258f2371f52ac12b73e19b25dad";

function isValidEmail(s) {
  const t = String(s || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

const COLORS = [
  { id: "black", label: "Black", hex: "#1a1a1a" },
  { id: "white", label: "White", hex: "#f5f5f5" },
  { id: "purple", label: "Purple", hex: "#6b4c9a" },
  { id: "gray", label: "Dark gray", hex: "#4a4a4a" },
];

const SIZES = ["L", "M", "XL", "XXL", "3XL", "4XL"];

function ProfileIcon() {
  return (
    <svg
      className="customer-shell-header__svg"
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        opacity="0.4"
        d="M12.1207 12.78C12.0507 12.77 11.9607 12.77 11.8807 12.78C10.1207 12.72 8.7207 11.28 8.7207 9.50998C8.7207 7.69998 10.1807 6.22998 12.0007 6.22998C13.8107 6.22998 15.2807 7.69998 15.2807 9.50998C15.2707 11.28 13.8807 12.72 12.1207 12.78Z"
        stroke="#000"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        opacity="0.34"
        d="M18.7398 19.3801C16.9598 21.0101 14.5998 22.0001 11.9998 22.0001C9.39977 22.0001 7.03977 21.0101 5.25977 19.3801C5.35977 18.4401 5.95977 17.5201 7.02977 16.8001C9.76977 14.9801 14.2498 14.9801 16.9698 16.8001C18.0398 17.5201 18.6398 18.4401 18.7398 19.3801Z"
        stroke="#000"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
        stroke="#000"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function CartIcon() {
  return (
    <svg
      className="customer-shell-header__svg"
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M2 3L2.26491 3.0883C3.58495 3.52832 4.24497 3.74832 4.62248 4.2721C5 4.79587 5 5.49159 5 6.88304V9.5C5 12.3284 5 13.7426 5.87868 14.6213C6.75736 15.5 8.17157 15.5 11 15.5H13M19 15.5H17"
        stroke="#000"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7.5 18C8.32843 18 9 18.6716 9 19.5C9 20.3284 8.32843 21 7.5 21C6.67157 21 6 20.3284 6 19.5C6 18.6716 6.67157 18 7.5 18Z"
        stroke="#000"
        strokeWidth="1.5"
      />
      <path
        d="M16.5 18.0001C17.3284 18.0001 18 18.6716 18 19.5001C18 20.3285 17.3284 21.0001 16.5 21.0001C15.6716 21.0001 15 20.3285 15 19.5001C15 18.6716 15.6716 18.0001 16.5 18.0001Z"
        stroke="#000"
        strokeWidth="1.5"
      />
      <path
        d="M5 6H8M5.5 13H16.0218C16.9812 13 17.4609 13 17.8366 12.7523C18.2123 12.5045 18.4013 12.0636 18.7792 11.1818L19.2078 10.1818C20.0173 8.29294 20.4221 7.34853 19.9775 6.67426C19.5328 6 18.5054 6 16.4504 6H12"
        stroke="#000"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatNgn(n) {
  return `₦${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function ProductDetail() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const productId =
    typeof params?.id === "string" ? params.id : String(params?.id ?? "");

  const [product, setProduct] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [shopLabel, setShopLabel] = useState("Shop name");
  const [loadError, setLoadError] = useState("");

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedColorId, setSelectedColorId] = useState(COLORS[0].id);
  const [selectedInvId, setSelectedInvId] = useState(null);
  const [selectedSize, setSelectedSize] = useState("M");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuTriggerRef = useRef(null);
  /** null | "adding" | "removing" — drives disabled state and button label while a request runs. */
  const [cartAction, setCartAction] = useState(null);
  const [cartMessage, setCartMessage] = useState("");
  /** Maps inventory id (string key) → cart line id for this PDP product (from GET /api/cart). */
  const [cartLinesByInvId, setCartLinesByInvId] = useState(() => ({}));
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [payMessage, setPayMessage] = useState("");

  const gallery = useMemo(() => {
    if (!product) return [];
    const name = product.name || "Product";
    const imgs = Array.isArray(product.images)
      ? product.images.map((url) => ({ url, alt: name, isVideo: false }))
      : [];
    const vids = Array.isArray(product.videos)
      ? product.videos.map((url) => ({ url, alt: name, isVideo: true }))
      : [];
    return [...imgs, ...vids];
  }, [product]);

  const activeImage = gallery[activeImageIndex] ?? gallery[0];
  const selectedColor = COLORS.find((c) => c.id === selectedColorId) ?? COLORS[0];

  const selectedInv = useMemo(
    () => inventory.find((i) => i.id === selectedInvId) ?? inventory[0] ?? null,
    [inventory, selectedInvId]
  );

  const selectedCartLineId = useMemo(() => {
    if (selectedInv?.id == null) return null;
    const n = Number(selectedInv.id);
    if (!Number.isFinite(n)) return null;
    const lineId = cartLinesByInvId[String(n)];
    return typeof lineId === "number" && Number.isFinite(lineId) ? lineId : null;
  }, [cartLinesByInvId, selectedInv?.id]);

  const selectedInvInCart = selectedCartLineId != null;

  const selectedPriceNaira = Number(selectedInv?.price) || 0;
  /** Paystack NGN amount in kobo (smallest unit). */
  const buyNowAmountKobo = Math.max(100, Math.round(selectedPriceNaira * 100));

  const paystackBase = useMemo(
    () => ({
      publicKey: PAYSTACK_PUBLIC_KEY,
      currency: "NGN",
    }),
    []
  );

  const initializePayment = usePaystackPayment(paystackBase);

  const loadCustomerSession = useCallback(async () => {
    try {
      const res = await fetch(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: "customer" }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result.bool && result.data && typeof result.data === "object") {
        const email = typeof result.data.email === "string" ? result.data.email.trim() : "";
        const sessionName =
          typeof result.data.name === "string" ? result.data.name.trim() : "";
        if (email) setCustomerEmail((prev) => (prev.trim() ? prev : email));
        if (sessionName) setCustomerName((prev) => (prev.trim() ? prev : sessionName));
      }
    } catch {
      /* guest checkout — email stays empty until sign-in */
    }
  }, []);

  useEffect(() => {
    void loadCustomerSession();
  }, [loadCustomerSession]);

  const goPrev = useCallback(() => {
    setActiveImageIndex((i) => {
      const len = gallery.length;
      if (len <= 1) return 0;
      return i === 0 ? len - 1 : i - 1;
    });
  }, [gallery.length]);

  const goNext = useCallback(() => {
    setActiveImageIndex((i) => {
      const len = gallery.length;
      if (len <= 1) return 0;
      return i === len - 1 ? 0 : i + 1;
    });
  }, [gallery.length]);

  const refreshCartLinesForProduct = useCallback(async () => {
    const routePk = parseInt(String(productId), 10);
    if (!Number.isFinite(routePk) || Number.isNaN(routePk)) {
      setCartLinesByInvId({});
      return;
    }
    try {
      const res = await fetch("/api/cart", {
        method: "GET",
        headers: buyerAuthHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || !res.ok) {
        setCartLinesByInvId({});
        return;
      }
      const items = Array.isArray(data.items) ? data.items : [];
      const next = {};
      for (const row of items) {
        if (Number(row.productId) !== routePk) continue;
        const inv = Number(row.inventoryId);
        const line = Number(row.cartLineId);
        if (Number.isFinite(inv) && Number.isFinite(line)) {
          next[String(inv)] = line;
        }
      }
      setCartLinesByInvId(next);
    } catch {
      setCartLinesByInvId({});
    }
  }, [productId]);

  const toggleCart = useCallback(async () => {
    if (!selectedInv?.id) return;
    const inventoryId = selectedInv.id;
    const invNum = Number(inventoryId);
    if (!Number.isFinite(invNum)) return;
    const invKey = String(invNum);
    const existingLineId = cartLinesByInvId[invKey];
    const removing = typeof existingLineId === "number" && Number.isFinite(existingLineId);

    setCartMessage("");
    setCartAction(removing ? "removing" : "adding");
    try {
      if (removing) {
        const res = await fetch(
          `/api/cart?cartLineId=${encodeURIComponent(String(existingLineId))}`,
          {
            method: "DELETE",
            headers: buyerAuthHeaders(),
            credentials: "include",
          }
        );
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setCartMessage("Sign in to update your cart.");
          return;
        }
        if (!res.ok) {
          if (res.status === 404) await refreshCartLinesForProduct();
          setCartMessage(
            typeof data.error === "string" ? data.error : "Could not remove from cart."
          );
          return;
        }
        setCartLinesByInvId((prev) => {
          const next = { ...prev };
          delete next[invKey];
          return next;
        });
        return;
      }

      const res = await fetch("/api/cart", {
        method: "POST",
        headers: buyerAuthHeaders(),
        credentials: "include",
        body: JSON.stringify({ inventoryId, quantity: 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setCartMessage("Sign in to add items to your cart.");
        return;
      }
      if (!res.ok) {
        setCartMessage(typeof data.error === "string" ? data.error : "Could not add to cart.");
        return;
      }
      await refreshCartLinesForProduct();
    } catch {
      setCartMessage(
        removing ? "Could not remove from cart." : "Could not add to cart."
      );
    } finally {
      setCartAction(null);
    }
  }, [selectedInv, cartLinesByInvId, refreshCartLinesForProduct]);

  useEffect(() => {
    void refreshCartLinesForProduct();
  }, [refreshCartLinesForProduct]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshCartLinesForProduct();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshCartLinesForProduct]);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [productId]);

  useEffect(() => {
    setActiveImageIndex((i) => {
      if (gallery.length === 0) return 0;
      return Math.min(i, gallery.length - 1);
    });
  }, [gallery.length]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError("");
      const pid = parseInt(String(productId), 10);
      if (Number.isNaN(pid)) {
        setLoadError("Invalid product");
        setProduct(null);
        setInventory([]);
        return;
      }
      try {
        const shopUrl = `${API_BACKEND}/storefront/shop/${encodeURIComponent(slug)}`;
        const prodUrl = `${API_BACKEND}/storefront/product/${pid}`;
        const [shopRes, prodRes] = await Promise.all([
          fetch(shopUrl),
          fetch(prodUrl),
        ]);
        const shopJ = await shopRes.json().catch(() => ({}));
        const prodJ = await prodRes.json().catch(() => ({}));
        if (cancelled) return;
        if (shopRes.ok && shopJ.shop?.name) {
          setShopLabel(String(shopJ.shop.name));
        }
        if (!prodRes.ok) {
          setLoadError(prodJ.error || "Product not found");
          setProduct(null);
          setInventory([]);
          setSelectedInvId(null);
          return;
        }
        setProduct(prodJ.product);
        const inv = Array.isArray(prodJ.inventory) ? prodJ.inventory : [];
        setInventory(inv);
        setSelectedInvId(inv[0]?.id ?? null);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load");
          setProduct(null);
          setInventory([]);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug, productId]);

  useEffect(() => {
    const el = document.querySelector(".customer-main");
    if (!el) return;
    el.style.height = "100vh";
    el.style.borderRadius = "unset";
    el.style.backgroundColor = "#fff";
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") closeMobileMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileMenuOpen, closeMobileMenu]);

  const prevMenuOpen = useRef(mobileMenuOpen);
  useEffect(() => {
    if (prevMenuOpen.current && !mobileMenuOpen) {
      menuTriggerRef.current?.focus();
    }
    prevMenuOpen.current = mobileMenuOpen;
  }, [mobileMenuOpen]);

  const onPaystackSuccess = (reference) => {
    console.log(reference);
    setPayMessage("");
  };

  const onPaystackClose = () => {
    console.log("closed");
  };

  const handleBuyNow = () => {
    setPayMessage("");
    if (!product || !selectedInv || loadError) return;

    const email = customerEmail.trim();
    if (!email || !isValidEmail(email)) {
      setPayMessage("Sign in to pay with your email, or use checkout after signing in.");
      return;
    }
    if (selectedPriceNaira <= 0) {
      setPayMessage("This variant has no price set.");
      return;
    }

    const nameParts = customerName.trim().split(/\s+/).filter(Boolean);
    const firstname = nameParts[0] ?? email.split("@")[0];
    const lastname = nameParts.slice(1).join(" ") || firstname;

    initializePayment({
      onSuccess: onPaystackSuccess,
      onClose: onPaystackClose,
      config: {
        email,
        amount: buyNowAmountKobo,
        reference: `deedyte-pdp-${productId}-${Date.now()}`,
        firstname,
        lastname,
        metadata: {
          custom_fields: [
            {
              display_name: "Product",
              variable_name: "product",
              value: product?.name || String(productId),
            },
            {
              display_name: "Inventory ID",
              variable_name: "inventory_id",
              value: String(selectedInv.id),
            },
          ],
        },
      },
    });
  };

  return (
    <div className="shop-page pdp-page">
      <header className="pdp-header">
        <div className="pdp-header__brand">
          <span className="pdp-header__logo">{shopLabel}</span>
        </div>
        <nav className="pdp-header__nav" aria-label="Primary">
          <span className="pdp-header__link">About</span>
          <span className="pdp-header__link">Brands</span>
        </nav>
        <div className="pdp-header__end">
          <button
            ref={menuTriggerRef}
            type="button"
            className={`pdp-menu-trigger${mobileMenuOpen ? " pdp-menu-trigger--open" : ""}`}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="pdp-mobile-menu"
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            <span className="pdp-menu-trigger__bar" aria-hidden />
            <span className="pdp-menu-trigger__bar" aria-hidden />
            <span className="pdp-menu-trigger__bar" aria-hidden />
          </button>
        </div>

        <span style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", display: "flex" }}>
          <Link href="/customer/store/cart" className="customer-shell-header__icon" aria-label="Cart">
            <CartIcon />
          </Link>
          <Link
            href="/customer/user-profile"
            className="customer-shell-header__icon"
            aria-label="Account">
            <ProfileIcon />
          </Link>
        </span>
      </header>

      <div
        className={`pdp-menu-backdrop${mobileMenuOpen ? " pdp-menu-backdrop--open" : ""}`}
        aria-hidden={!mobileMenuOpen}
        onClick={closeMobileMenu}
      />
      <div
        id="pdp-mobile-menu"
        className={`pdp-menu-drawer${mobileMenuOpen ? " pdp-menu-drawer--open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Shop menu"
      >
        <div className="pdp-menu-drawer__top">
          <span className="pdp-menu-drawer__title">Menu</span>
          <button
            type="button"
            className="pdp-menu-drawer__close"
            aria-label="Close menu"
            onClick={closeMobileMenu}
          >
            ×
          </button>
        </div>
        <nav className="pdp-menu-drawer__nav" aria-label="Primary">
          <span className="pdp-menu-drawer__link" role="button" tabIndex={0}>
            About
          </span>
          <span className="pdp-menu-drawer__link" role="button" tabIndex={0}>
            Brands
          </span>
        </nav>
        <div className="pdp-menu-drawer__tools">
          {/* Search bar not used in this version
          <label className="pdp-menu-drawer__search">
            <img src={searchSvg.src} alt="" className="pdp-menu-drawer__search-icon" />
            <input
              type="search"
              className="pdp-menu-drawer__search-input"
              placeholder="Search products…"
              autoComplete="off"
            />
          </label>
          */}
          <div className="pdp-menu-drawer__icons">
            <button type="button" className="pdp-menu-drawer__icon-btn" aria-label="Account">
              {/* <img src={userSvg.src} alt="" /> */}
            </button>
            {/* Wishlist not used in this version
            <button
              type="button"
              className="pdp-menu-drawer__icon-btn pdp-menu-drawer__icon-btn--dot"
              aria-label="Wishlist"
            >
              <span className="pdp-menu-drawer__heart" aria-hidden>
                ♡
              </span>
            </button>
            */}
            {/* Cart lives in the header only, not in the drawer */}
          </div>
        </div>
      </div>

      {/* <nav className="pdp-breadcrumbs" aria-label="Breadcrumb">
        <a href={`/customer/store/${slug}`}>Home</a>
        <span className="pdp-breadcrumbs__sep">›</span>
        <span>{product?.category}</span>
        <span className="pdp-breadcrumbs__sep">›</span>
        <span className="pdp-breadcrumbs__current">{product?.name}</span>
      </nav> */}

      <div className="pdp-layout">
        <div className="pdp-gallery">
          <div className="pdp-gallery__stage">
            <button
              type="button"
              className="pdp-gallery__arrow pdp-gallery__arrow--prev"
              aria-label="Previous image"
              onClick={goPrev}
            >
              ‹
            </button>
            <div className="pdp-gallery__main-wrap">
              {!activeImage ? (
                <div
                  className="pdp-gallery__main"
                  style={{ background: "#eee", minHeight: 280 }}
                  aria-hidden
                />
              ) : activeImage.isVideo ? (
                <video
                  src={activeImage.url}
                  className="pdp-gallery__main"
                  controls
                  playsInline
                />
              ) : (
                <img
                  src={activeImage.url}
                  alt={activeImage.alt ?? "Product"}
                  className="pdp-gallery__main"
                />
              )}
              <div className="pdp-gallery__side-actions">
                <button
                  type="button"
                  className="pdp-round-action"
                  aria-label="Share"
                >
                  ↗
                </button>
                {/* Wishlist not used in this version
                <button
                  type="button"
                  className="pdp-round-action"
                  aria-label="Add to wishlist"
                >
                  ♡
                </button>
                */}
              </div>
            </div>
            <button
              type="button"
              className="pdp-gallery__arrow pdp-gallery__arrow--next"
              aria-label="Next image"
              onClick={goNext}
            >
              ›
            </button>
          </div>

          <div
            className="thumbnail-list"
            role="tablist"
            aria-label="Product images"
          >
            {gallery.map((img, index) => (
              <button
                key={`${index}-${img.url}`}
                type="button"
                role="tab"
                aria-selected={index === activeImageIndex}
                aria-label={
                  img.isVideo
                    ? `Video ${index + 1}`
                    : `Image ${index + 1} of ${gallery.length}`
                }
                className={
                  index === activeImageIndex
                    ? "thumbnail-list__item is-active"
                    : "thumbnail-list__item"
                }
                onClick={() => setActiveImageIndex(index)}
              >
                <img src={img.url} alt="" />
                {img.isVideo ? (
                  <span className="thumbnail-list__play" aria-hidden>
                    ▶
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* <div className="pdp-social-bar" aria-label="Share">
            <span className="pdp-social-bar__label">Share</span>
            <div className="pdp-social-bar__icons">
              <button type="button" className="pdp-social-icon" aria-label="Facebook">
                f
              </button>
              <button type="button" className="pdp-social-icon" aria-label="X">
                𝕏
              </button>
              <button type="button" className="pdp-social-icon" aria-label="Pinterest">
                P
              </button>
              <button type="button" className="pdp-social-icon" aria-label="Link">
                🔗
              </button>
            </div>
          </div> */}
        </div>

        <aside className="pdp-buybox">
          <p
            className="pdp-buybox__eyebrow"
            role={loadError ? "alert" : undefined}
          >
            {loadError || product?.category || "—"}
          </p>
          <h1 className="pdp-buybox__title">
            {product?.name || (loadError ? "" : "…")}
          </h1>

          <div className="pdp-buybox__price-row">
            <div className="pdp-buybox__prices">
              <span className="pdp-buybox__compare">
                {selectedInv &&
                  selectedInv.compare_at_price != null &&
                  Number(selectedInv.compare_at_price) >
                  Number(selectedInv.price ?? 0)
                  ? formatNgn(selectedInv.compare_at_price)
                  : ""}
              </span>
              <span className="pdp-buybox__price">
                {selectedInv ? formatNgn(selectedInv.price) : "—"}
              </span>
            </div>
            <div className="pdp-buybox__rating">
              <span className="pdp-stars" aria-hidden>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={
                      n <= (Number(product?.rating) || 0)
                        ? "pdp-stars__star is-on"
                        : "pdp-stars__star"
                    }
                  >
                    ★
                  </span>
                ))}
              </span>
              <span className="pdp-buybox__reviews">
                {Number(product?.review_count) || 0} reviews
              </span>
            </div>
          </div>

          <div>
            <label htmlFor=""><b>Description:</b></label>
            {product?.description ? (
              <div
                className="pdp-buybox__desc pdp-buybox__desc--html"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            ) : (
              <p className="pdp-buybox__desc">—</p>
            )}
          </div>

          <div className="pdp-option">
            <p className="pdp-option__label">
              Color: <strong>{selectedColor.label}</strong>
            </p>
            <div className="pdp-swatches" role="list">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="listitem"
                  className={
                    c.id === selectedColorId
                      ? "pdp-swatch is-selected"
                      : "pdp-swatch"
                  }
                  style={{ backgroundColor: c.hex }}
                  aria-label={c.label}
                  aria-pressed={c.id === selectedColorId}
                  onClick={() => setSelectedColorId(c.id)}
                />
              ))}
            </div>
          </div>

          <div className="pdp-option">
            <div className="pdp-option__row">
              <p className="pdp-option__label">
                Size:{" "}
                <strong>
                  {inventory.length
                    ? selectedInv?.sku || "—"
                    : selectedSize}
                </strong>
              </p>
              <button type="button" className="pdp-link">
                View size chart
              </button>
            </div>
            <div className="pdp-sizes" role="list">
              {inventory.length > 0
                ? inventory.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    role="listitem"
                    className={
                      inv.id === selectedInv?.id
                        ? "pdp-size is-selected"
                        : "pdp-size"
                    }
                    aria-pressed={inv.id === selectedInv?.id}
                    onClick={() => setSelectedInvId(inv.id)}
                  >
                    {inv.sku || "—"}
                  </button>
                ))
                : SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="listitem"
                    className={
                      s === selectedSize ? "pdp-size is-selected" : "pdp-size"
                    }
                    aria-pressed={s === selectedSize}
                    onClick={() => setSelectedSize(s)}
                  >
                    {s}
                  </button>
                ))}
            </div>
          </div>

          <div className="pdp-ctas">
            <button
              type="button"
              className="pdp-btn pdp-btn--primary"
              disabled={!product || !selectedInv || !!loadError || cartAction != null}
              aria-pressed={selectedInvInCart}
              onClick={() => void toggleCart()}
            >
              {cartAction === "adding"
                ? "Adding…"
                : cartAction === "removing"
                  ? "Removing…"
                  : selectedInvInCart
                    ? "Remove from cart"
                    : "Add to cart"}
            </button>
            <button
              type="button"
              onClick={() => void handleBuyNow()}
              className="pdp-btn pdp-btn--secondary"
              disabled={!product || !selectedInv || !!loadError}
            >
              Buy now
            </button>
            {cartMessage ? (
              <p className="pdp-option__label" role="status" style={{ marginTop: 8 }}>
                {cartMessage}
              </p>
            ) : null}
            {payMessage ? (
              <p className="pdp-option__label" role="alert" style={{ marginTop: 8 }}>
                {payMessage}
              </p>
            ) : null}
          </div>

          {/* <p className="pdp-muted-link">
            <button type="button" className="pdp-link pdp-link--muted">
              Delivery terms &amp; conditions
            </button>
          </p> */}

          {/* <div className="pdp-payment-trust">
            <span className="pdp-payment-trust__label">
              Secure payment guarantee
            </span>
            <div className="pdp-payment-badges" aria-hidden>
              <span className="pdp-payment-badge">VISA</span>
              <span className="pdp-payment-badge">MC</span>
              <span className="pdp-payment-badge">PayPal</span>
            </div>
          </div> */}

          {/* 
          <div className="pdp-returns">
            <h2 className="pdp-returns__title">Easy returns</h2>
            <ul className="pdp-returns__list">
              <li>Free in-store return within 60 days</li>
              <li>Free returns via drop-off service</li>
            </ul>
          </div> */}

          <div className="pdp-social-bar" aria-label="Share">
            <span className="pdp-social-bar__label">Share</span>
            <div className="pdp-social-bar__icons">
              <button type="button" className="pdp-social-icon" aria-label="Facebook">
                f
              </button>
              <button type="button" className="pdp-social-icon" aria-label="X">
                𝕏
              </button>
              <button type="button" className="pdp-social-icon" aria-label="Pinterest">
                P
              </button>
              <button type="button" className="pdp-social-icon" aria-label="Link">
                🔗
              </button>
            </div>
          </div>
        </aside>
      </div>

      <div className="pdp-reviews-wrap">
        <ProductReviews />
      </div>
    </div>
  );
}
