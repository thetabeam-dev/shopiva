"use client";

// import searchSvg from "@/svgs/search-alt-svgrepo-com (1).svg";
import "./styles/xxl.css";
import "./styles/s.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProductReviews from "@/components/customers/Review";
import ShopDetails from "@/components/customers/ShopDetails";
import ProductVariantCardPicker, {
    formatAttributeLabel,
} from "@/components/customers/ProductVariantCardPicker";
import { buyerAuthHeaders } from "@/reusables/shopBackendAuth";
import dynamic from "next/dynamic";

const PaystackBinder = dynamic(() => import("./paystackBinder"), { ssr: false });

const AUTH_URL = "/api/user/authorization";

const PAYSTACK_PUBLIC_KEY =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY) ||
    "pk_test_9d54d1840154258f2371f52ac12b73e19b25dad";

function isValidEmail(s) {
    const t = String(s || "").trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
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

function variantAttributeKeys(variants) {
    const keys = new Set();
    for (const variant of variants) {
        const attrs =
            variant?.attributes && typeof variant.attributes === "object" ? variant.attributes : {};
        Object.keys(attrs).forEach((key) => keys.add(key));
    }
    return Array.from(keys);
}

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

function inventoryFromProduct(product) {
    if (!product) return [];
    if (Array.isArray(product.variants) && product.variants.length > 0) {
        return product.variants.map((variant, index) => ({
            id: variant.id ?? index,
            optionKey: variant.optionKey ?? `${variant.id ?? index}-${index}`,
            price: variant.price ?? product.price ?? product.minPrice ?? 0,
            compare_at_price: variant.compare_at_price ?? null,
            sku: variant.sku ?? null,
            stock: variant.stock ?? product.stock ?? null,
            allowBackorder: Boolean(variant.allowBackorder),
            attributes: variant.attributes && typeof variant.attributes === "object" ? variant.attributes : {},
        }));
    }
    const price = product.price ?? product.minPrice ?? product.maxPrice;
    if (product.inventoryId == null && price == null) return [];
    return [{
        id: product.inventoryId ?? product.id,
        price: price ?? 0,
        compare_at_price: product.compare_at_price ?? null,
        sku: null,
        stock: product.stock ?? null,
    }];
}

const VIDEO_FILE = /\.(mp4|webm|mov|m4v|ogv|ogg|avi|mkv)(\?|#|$)/i;

function isVideoFile(url) {
    const value = String(url || "").trim();
    if (!value) return false;
    if (VIDEO_FILE.test(value)) return true;
    return /\/video\/upload\//i.test(value);
}

function shownPrice(inv, product) {
    const raw = inv?.price ?? inv?.minPrice ?? inv?.maxPrice ?? product?.price ?? product?.minPrice;
    if (raw == null || raw === "" || Number.isNaN(Number(raw))) return "—";
    return formatNgn(raw);
}

export default function ProductDetail({ product }) {
    const shopSlug = String(product?.slug ?? "");
    const productId = product?.id != null ? String(product.id) : "";

    const [productReviews, setProductReviews] = useState(() =>
        Array.isArray(product?.productReviews) ? product.productReviews : []
    );
    const [reviewMetrics, setReviewMetrics] = useState(product?.reviewMetrics ?? null);
    const inventory = useMemo(() => inventoryFromProduct(product), [product]);
    const [loadError, setLoadError] = useState(product ? "" : "Product not found");

    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [selectedInvId, setSelectedInvId] = useState(
        () => inventoryFromProduct(product)[0]?.id ?? null
    );
    const [selectedOptionKey, setSelectedOptionKey] = useState(
        () => inventoryFromProduct(product)[0]?.optionKey ?? null
    );
    const [localQty, setLocalQty] = useState(1);
    /** null | "adding" | "removing" — drives disabled state and button label while a request runs. */
    const [cartAction, setCartAction] = useState(null);
    const [cartMessage, setCartMessage] = useState("");
    /** Maps inventory id (string key) → { lineId, quantity } for this product (from GET /api/cart). */
    const [cartLinesByInvId, setCartLinesByInvId] = useState(() => ({}));
    const [customerEmail, setCustomerEmail] = useState("");
    const [customerName, setCustomerName] = useState("");
    const [payMessage, setPayMessage] = useState("");

    const gallery = useMemo(() => {
        if (!product) return [];
        const name = product.name || "Product";
        const urls = [
            ...(Array.isArray(product.images) ? product.images : []),
            ...(Array.isArray(product.videos) ? product.videos : []),
        ];
        const seen = new Set();
        return urls
            .map((url) => String(url || "").trim())
            .filter((url) => {
                if (!url || seen.has(url)) return false;
                seen.add(url);
                return true;
            })
            .map((url) => ({ url, alt: name, isVideo: isVideoFile(url) }));
    }, [product]);

    const activeImage = gallery[activeImageIndex] ?? gallery[0];

    const selectedInv = useMemo(
        () =>
            inventory.find((i) => i.optionKey === selectedOptionKey) ??
            inventory.find((i) => i.id === selectedInvId) ??
            inventory[0] ??
            null,
        [inventory, selectedInvId, selectedOptionKey]
    );

    const bulkTiers = useMemo(() => {
        const raw = product?.bulkDiscount;
        if (!Array.isArray(raw)) return [];
        return raw
            .map((tier) => {
                if (!tier || typeof tier !== "object") return null;
                const minQuantity = Number(String(tier.minQuantity ?? "").replace(/[^\d]/g, ""));
                const totalPrice = Number(String(tier.totalPrice ?? "").replace(/[^\d.]/g, "").replace(/\.(?=.*\.)/g, ""));
                if (!Number.isFinite(minQuantity) || minQuantity < 2) return null;
                if (!Number.isFinite(totalPrice) || totalPrice <= 0) return null;
                return { minQuantity, totalPrice };
            })
            .filter(Boolean);
    }, [product?.bulkDiscount]);

    const attrKeys = useMemo(() => variantAttributeKeys(inventory), [inventory]);

    const selectedCartLine = useMemo(() => {
        if (selectedInv?.id == null) return null;
        const n = Number(selectedInv.id);
        if (!Number.isFinite(n)) return null;
        const line = cartLinesByInvId[String(n)];
        if (!line || !Number.isFinite(Number(line.lineId))) return null;
        const quantity = Math.max(1, Number(line.quantity) || 1);
        return { lineId: Number(line.lineId), quantity };
    }, [cartLinesByInvId, selectedInv?.id]);

    const selectedInvInCart = selectedCartLine != null;
    const selectedQty = selectedCartLine?.quantity ?? 0;
    const qty = selectedInvInCart ? selectedQty : localQty;
    const maxUnits = useMemo(() => {
        const stock = Number(selectedInv?.stock);
        if (Number.isFinite(stock) && stock > 0) return Math.min(99, Math.floor(stock));
        return 99;
    }, [selectedInv?.stock]);

    const selectedPriceNaira = Number(selectedInv?.price) || 0;
    const unitPrice = unitPriceForBulk(selectedPriceNaira, bulkTiers, qty);
    /** Paystack NGN amount in kobo (smallest unit). */
    const buyNowAmountKobo = Math.max(100, Math.round(unitPrice * qty * 100));

    const paystackBase = useMemo(
        () => ({
            publicKey: PAYSTACK_PUBLIC_KEY,
            currency: "NGN",
        }),
        []
    );

    const paymentRef = useRef(null);

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
                const quantity = Math.max(1, Number(row.quantity) || 1);
                if (Number.isFinite(inv) && Number.isFinite(line)) {
                    next[String(inv)] = { lineId: line, quantity };
                }
            }
            setCartLinesByInvId(next);
        } catch {
            setCartLinesByInvId({});
        }
    }, [productId]);

    const changeUnits = useCallback(async (delta) => {
        if (!selectedInv?.id || !Number.isFinite(Number(delta)) || delta === 0) return;
        const invNum = Number(selectedInv.id);
        if (!Number.isFinite(invNum)) return;
        const invKey = String(invNum);
        const existing = cartLinesByInvId[invKey];
        const lineId = existing && Number.isFinite(Number(existing.lineId)) ? Number(existing.lineId) : null;
        const currentQty = lineId != null ? Math.max(1, Number(existing.quantity) || 1) : 0;
        const nextQty = currentQty + delta;

        setCartMessage("");
        if (lineId == null) {
            if (delta < 0) return;
            setCartAction("adding");
            try {
                const res = await fetch("/api/cart", {
                    method: "POST",
                    headers: buyerAuthHeaders(),
                    credentials: "include",
                    body: JSON.stringify({
                        inventoryId: invNum,
                        quantity: Math.max(1, Math.min(maxUnits, Math.abs(delta))),
                    }),
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
                setCartMessage("Could not add to cart.");
            } finally {
                setCartAction(null);
            }
            return;
        }

        if (nextQty < 1) {
            setCartAction("removing");
            try {
                const res = await fetch(
                    `/api/cart?cartLineId=${encodeURIComponent(String(lineId))}`,
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
            } catch {
                setCartMessage("Could not remove from cart.");
            } finally {
                setCartAction(null);
            }
            return;
        }

        const capped = Math.min(maxUnits, nextQty);
        if (capped === currentQty) return;
        setCartAction("updating");
        try {
            const res = await fetch("/api/cart", {
                method: "PATCH",
                headers: buyerAuthHeaders(),
                credentials: "include",
                body: JSON.stringify({ cartLineId: lineId, quantity: capped }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 401) {
                setCartMessage("Sign in to update your cart.");
                return;
            }
            if (!res.ok) {
                if (res.status === 404) await refreshCartLinesForProduct();
                setCartMessage(typeof data.error === "string" ? data.error : "Could not update units.");
                return;
            }
            setCartLinesByInvId((prev) => ({
                ...prev,
                [invKey]: { lineId, quantity: capped },
            }));
        } catch {
            setCartMessage("Could not update units.");
        } finally {
            setCartAction(null);
        }
    }, [selectedInv, cartLinesByInvId, refreshCartLinesForProduct, maxUnits]);

    const bumpQty = (delta) => {
        if (selectedInvInCart) {
            void changeUnits(delta);
            return;
        }
        setLocalQty((current) => Math.min(maxUnits, Math.max(1, current + delta)));
    };

    const applyVariantPick = (variant) => {
        if (!variant) return;
        setSelectedInvId(variant.id ?? null);
        setSelectedOptionKey(variant.optionKey ?? `${variant.id}-0`);
    };

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
        setProductReviews(Array.isArray(product?.productReviews) ? product.productReviews : []);
        setReviewMetrics(product?.reviewMetrics ?? null);
        setLoadError(product ? "" : "Product not found");
        const first = inventoryFromProduct(product)[0];
        setSelectedInvId(first?.id ?? null);
        setSelectedOptionKey(first?.optionKey ?? null);
        setLocalQty(1);
        setActiveImageIndex(0);
    }, [product]);

    useEffect(() => {
        const el = document.querySelector(".customer-main");
        if (!el) return;
        el.style.height = "100vh";
        el.style.display = "flex";
        el.style.flexDirection = "column";
        el.style.overflow = "hidden";
        el.style.borderRadius = "unset";
        el.style.backgroundColor = "#fff";
    }, []);

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

        const initializePayment = paymentRef.current;
        if (!initializePayment) {
            setPayMessage("Payment is still loading. Try again.");
            return;
        }

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
            <PaystackBinder config={paystackBase} paymentRef={paymentRef} />
            <div className="pdp-layout">
                <div className="pdp-col-main">
                <div className="pdp-gallery">
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
                                    isVideoFile(img.url)
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

                                {isVideoFile(img.url) ? (
                                    <video src={img.url} muted playsInline preload="metadata" />
                                ) : (
                                    <img src={img.url} alt="" />
                                )}
                            </button>
                        ))}
                    </div>

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
                                    style={{ background: "#f5f5f5", minHeight: 280 }}
                                    aria-hidden
                                />
                            ) : isVideoFile(activeImage.url) ? (
                                <video
                                    key={activeImage.url}
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

                <div className="pdp-details">
                    <div className="pdp-social-bar" aria-label="Share">
                        <span className="pdp-social-bar__label">Share</span>
                        <div className="pdp-social-bar__icons">
                            <button type="button" className="pdp-social-icon" aria-label="Facebook" onClick={() => {
                                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, "_blank", "noopener,noreferrer");
                            }}>
                                <i className="fa-brands fa-facebook" aria-hidden="true" />
                            </button>
                            <button type="button" className="pdp-social-icon" aria-label="X" onClick={() => {
                                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent("Check out this product on DeeDyte " + window.location.href)}`;
                                window.open(twitterUrl, "_blank", "noopener,noreferrer");
                            }}>
                                <i className="fa-brands fa-twitter" aria-hidden="true" />
                            </button>
                            <button type="button" className="pdp-social-icon" aria-label="WhatsApp" onClick={() => {
                                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent("Check out this product on DeeDyte " + window.location.href)}`;
                                window.open(whatsappUrl, "_blank", "noopener,noreferrer");
                            }}>
                                <i className="fa-brands fa-whatsapp" aria-hidden="true" />
                            </button>
                            <button type="button" className="pdp-social-icon" aria-label="Instagram" onClick={async () => {
                                const text = `Check out this product on DeeDyte ${window.location.href}`;
                                try {
                                    await navigator.clipboard.writeText(text);
                                } catch { }
                                window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
                            }}>
                                <i className="fa-brands fa-instagram" aria-hidden="true" />
                            </button>
                            <button type="button" className="pdp-social-icon" aria-label="Copy link" onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(window.location.href);
                                    alert("Link copied to clipboard");
                                } catch {
                                    alert("Could not copy the link");
                                }
                            }}>
                                <i className="fa-solid fa-link" aria-hidden="true" />
                            </button>
                        </div>
                    </div>

                    <div className="pdp-reviews-wrap">
                        <ProductReviews reviews={productReviews} metrics={reviewMetrics} />
                        <ShopDetails shop={product?.shop} />
                    </div>
                </div>
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
                                {selectedInv ? formatNgn(unitPrice) : shownPrice(selectedInv, product)}
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

                    {bulkTiers.length > 0 ? (
                        <div className="pdp-bulk">
                            <h2 className="pdp-section-heading">Bulk discount</h2>
                            <p className="pdp-bulk__hint">Buy more and pay less per item.</p>
                            {bulkTiers.map((tier) => (
                                <div key={`${tier.minQuantity}-${tier.totalPrice}`} className="pdp-bulk__row">
                                    <span className="pdp-bulk__qty">Buy {tier.minQuantity}</span>
                                    <span className="pdp-bulk__prices">
                                        <strong>{formatNgn(tier.totalPrice)}</strong>
                                        <small>{formatNgn(tier.totalPrice / tier.minQuantity)} each</small>
                                    </span>
                                </div>
                            ))}
                            {qty >= (bulkTiers[0]?.minQuantity ?? Infinity) ? (
                                <p className="pdp-bulk__applied">Bulk price applied at {formatNgn(unitPrice)} each</p>
                            ) : null}
                        </div>
                    ) : null}

                    {inventory.length > 0 && attrKeys.length ? (
                        <div className="pdp-variant-pickers">
                            <h2 className="pdp-section-heading">
                                {inventory.length === 1 ? "Features" : "Options (variant)"}
                            </h2>
                            <ProductVariantCardPicker
                                attrKeys={attrKeys}
                                variants={inventory}
                                selectedVariant={selectedInv}
                                onSelect={applyVariantPick}
                            />
                        </div>
                    ) : null}

                    <p className="pdp-qty-label">Quantity</p>
                    <div className="pdp-qty-pill" role="group" aria-label="Quantity">
                        <button
                            type="button"
                            className="pdp-qty-pill__btn"
                            aria-label="Decrease quantity"
                            disabled={!product || !selectedInv || !!loadError || cartAction != null || qty <= 1}
                            onClick={() => bumpQty(-1)}
                        >
                            −
                        </button>
                        <span className="pdp-qty-pill__value" aria-live="polite">
                            {cartAction != null ? "…" : qty}
                        </span>
                        <button
                            type="button"
                            className="pdp-qty-pill__btn"
                            aria-label="Increase quantity"
                            disabled={!product || !selectedInv || !!loadError || cartAction != null || qty >= maxUnits}
                            onClick={() => bumpQty(1)}
                        >
                            +
                        </button>
                    </div>

                    <div className="pdp-ctas">
                        <div className="pdp-ctas__actions">
                            <button
                                type="button"
                                className="pdp-btn pdp-btn--primary"
                                disabled={!product || !selectedInv || !!loadError || cartAction != null}
                                aria-pressed={selectedInvInCart}
                                onClick={() => void changeUnits(selectedInvInCart ? -selectedQty : localQty)}
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
                        </div>
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

                    {selectedInv ? (
                        <div className="pdp-selected-variant">
                            <h2 className="pdp-selected-variant__title">Selected variant</h2>
                            <div className="pdp-selected-variant__grid">
                                {Object.entries(
                                    selectedInv.attributes && typeof selectedInv.attributes === "object"
                                        ? selectedInv.attributes
                                        : {}
                                )
                                    .filter(([, value]) => {
                                        const text = String(value ?? "").trim();
                                        return text && text !== "—" && text !== "-";
                                    })
                                    .map(([key, value]) => (
                                        <div key={key} className="pdp-variant-tile">
                                            <span className="pdp-variant-tile__label">
                                                {formatAttributeLabel(key).toUpperCase()}
                                            </span>
                                            <span className="pdp-variant-tile__value">{String(value)}</span>
                                        </div>
                                    ))}
                                <div className="pdp-variant-tile">
                                    <span className="pdp-variant-tile__label">PRICE</span>
                                    <span className="pdp-variant-tile__value">{formatNgn(unitPrice)}</span>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="pdp-description">
                        <h2 className="pdp-section-heading">Description</h2>
                        {product?.description ? (
                            <div
                                className="pdp-buybox__desc pdp-buybox__desc--html"
                                dangerouslySetInnerHTML={{ __html: product.description }}
                            />
                        ) : (
                            <p className="pdp-buybox__desc">No description provided for this product.</p>
                        )}
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
                </aside>
            </div>
        </div>
    );
}
