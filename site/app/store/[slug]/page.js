"use client";

/**
 * Public shop storefront entry (linked from customer map “Visit shop”).
 * Slug matches shops.slug from the vendor signup flow.
 */
import Select from "react-select";
import { useParams } from "next/navigation";
import menuSvg from "@/svgs/menu-alt-2-svgrepo-com.svg";
import filterSvg from "@/svgs/filter-svgrepo-com (1).svg";
import "./styles/xxl.css";
import "./styles/s.css";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { API_BACKEND } from "@/reusables/shopBackendAuth";
import Link from "next/link";

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
        stroke="#00926E"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        opacity="0.34"
        d="M18.7398 19.3801C16.9598 21.0101 14.5998 22.0001 11.9998 22.0001C9.39977 22.0001 7.03977 21.0101 5.25977 19.3801C5.35977 18.4401 5.95977 17.5201 7.02977 16.8001C9.76977 14.9801 14.2498 14.9801 16.9698 16.8001C18.0398 17.5201 18.6398 18.4401 18.7398 19.3801Z"
        stroke="#00926E"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
        stroke="#00926E"
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
        stroke="#00926E"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7.5 18C8.32843 18 9 18.6716 9 19.5C9 20.3284 8.32843 21 7.5 21C6.67157 21 6 20.3284 6 19.5C6 18.6716 6.67157 18 7.5 18Z"
        stroke="#00926E"
        strokeWidth="1.5"
      />
      <path
        d="M16.5 18.0001C17.3284 18.0001 18 18.6716 18 19.5001C18 20.3285 17.3284 21.0001 16.5 21.0001C15.6716 21.0001 15 20.3285 15 19.5001C15 18.6716 15.6716 18.0001 16.5 18.0001Z"
        stroke="#00926E"
        strokeWidth="1.5"
      />
      <path
        d="M5 6H8M5.5 13H16.0218C16.9812 13 17.4609 13 17.8366 12.7523C18.2123 12.5045 18.4013 12.0636 18.7792 11.1818L19.2078 10.1818C20.0173 8.29294 20.4221 7.34853 19.9775 6.67426C19.5328 6 18.5054 6 16.4504 6H12"
        stroke="#00926E"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
const filterSelectStyles = {
  container: (base) => ({ ...base, width: "100%" }),
  control: (base) => ({ ...base, width: "100%" }),
  menuPortal: (base) => ({ ...base, zIndex: 4000 }),
};

const filterSelectMenuProps = {
  menuPosition: "fixed",
  menuPortalTarget: typeof document !== "undefined" ? document.body : null,
};

const GENDER_KEYS = new Set(["male", "female", "unisex"]);

function normalizeCategoryKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s+/g, " ");
}

function optionFromValue(value) {
  const text = String(value);
  return {
    label: text.charAt(0).toUpperCase() + text.slice(1),
    value: text,
  };
}

function parseJsonObject(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function findCategoryRow(rows, category) {
  const target = normalizeCategoryKey(category);
  if (!target || target === "shop") return null;
  return (
    rows.find((row) => normalizeCategoryKey(row?.category) === target) ?? null
  );
}

function categoryProfile(row) {
  if (!row) return { showGender: false, productType: {}, variants: [] };
  const productType = {};
  const rawType = parseJsonObject(row["product-type"] ?? row.product_type ?? row.productType);
  for (const [key, values] of Object.entries(rawType)) {
    const name = String(key ?? "").trim();
    if (!name) continue;
    productType[name] = Array.isArray(values)
      ? values.map((value) => String(value).trim()).filter(Boolean)
      : [];
  }
  const keys = Object.keys(productType);
  const showGender = keys.length > 0 && keys.every((key) => GENDER_KEYS.has(normalizeCategoryKey(key)));
  const rawVariants = parseJsonObject(row.variants);
  const variants = Object.entries(rawVariants)
    .map(([key, values]) => ({
      key: String(key).trim(),
      options: Array.isArray(values)
        ? values.map((value) => String(value).trim()).filter(Boolean)
        : [],
    }))
    .filter((field) => field.key && field.options.length > 0);
  return { showGender, productType, variants };
}

function normFilterText(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseProductSpecifications(raw) {
  let specs = raw?.specifications;
  if (typeof specs === "string") {
    try {
      specs = JSON.parse(specs);
    } catch {
      specs = {};
    }
  }
  return specs && typeof specs === "object" && !Array.isArray(specs) ? specs : {};
}

function productMatchesFilters(product, filters) {
  const specs = parseProductSpecifications(product?.raw);
  const gender = normFilterText(product?.gender || specs.gender);
  const sub = normFilterText(
    product?.subCategory || product?.subcategory || product?.raw?.subcategory,
  );
  const type = normFilterText(product?.type || specs.type || specs.product_type);

  if (filters.gender && gender !== normFilterText(filters.gender)) return false;
  if (filters.subcategory && sub !== normFilterText(filters.subcategory)) return false;
  if (filters.type && type !== normFilterText(filters.type)) return false;

  const selected = filters.variants && typeof filters.variants === "object" ? filters.variants : {};
  const attributes =
    (product?.filters && typeof product.filters === "object" ? product.filters : null) ||
    (product?.attributes && typeof product.attributes === "object" ? product.attributes : {});
  for (const [key, value] of Object.entries(selected)) {
    if (!value) continue;
    const have = attributes[normFilterText(key)];
    const wanted = normFilterText(value);
    const list = Array.isArray(have) ? have.map(normFilterText) : [normFilterText(have)];
    if (!list.includes(wanted)) return false;
  }
  return true;
}

const EMPTY_FILTERS = { gender: "", subcategory: "", type: "", variants: {} };

function ShopFilterFields({ categoryRow, filterSelectStyles: styles, onApplyFilters }) {
  const [gender, setGender] = useState(null);
  const [subcategory, setSubcategory] = useState(null);
  const [type, setType] = useState(null);
  const [variantValues, setVariantValues] = useState({});

  const profile = useMemo(() => categoryProfile(categoryRow), [categoryRow]);
  const { showGender, productType, variants } = profile;

  const groupOptions = useMemo(
    () => Object.keys(productType).map(optionFromValue),
    [productType],
  );

  const typeOptions = useMemo(() => {
    const key = showGender ? gender?.value : subcategory?.value;
    const list = key ? productType[key] : null;
    return Array.isArray(list) ? list.map(optionFromValue) : [];
  }, [productType, showGender, gender, subcategory]);

  useEffect(() => {
    setGender(null);
    setSubcategory(null);
    setType(null);
    setVariantValues({});
  }, [categoryRow]);

  useEffect(() => {
    setType(null);
  }, [gender, subcategory]);

  const apply = useCallback(() => {
    const selectedVariants = {};
    for (const field of variants) {
      const chosen = variantValues[field.key];
      if (chosen?.value) selectedVariants[field.key] = chosen.value;
    }
    onApplyFilters?.({
      gender: showGender ? gender?.value ?? "" : "",
      subcategory: showGender ? "" : subcategory?.value ?? "",
      type: type?.value ?? "",
      variants: selectedVariants,
    });
  }, [gender, onApplyFilters, showGender, subcategory, type, variantValues, variants]);

  const reset = useCallback(() => {
    setGender(null);
    setSubcategory(null);
    setType(null);
    setVariantValues({});
    onApplyFilters?.(EMPTY_FILTERS);
  }, [onApplyFilters]);

  const hasFilters = groupOptions.length > 0 || variants.length > 0;
  const groupLabel = showGender ? "Gender" : "Sub category";
  const groupValue = showGender ? gender : subcategory;
  const setGroupValue = showGender ? setGender : setSubcategory;

  return (
    <>
      <span className="filter-img-cnt">
        <img src={filterSvg.src} alt="" />
        &nbsp;
        &nbsp;
        <h6 style={{ margin: "0px" }}>Filter</h6>
      </span>
      <br />
      {hasFilters ? (
        <div style={{ width: "100%" }}>
          {groupOptions.length > 0 ? (
            <span className="filter-input-cnt">
              <label htmlFor="shop-filter-group">{groupLabel}</label>
              <Select
                inputId="shop-filter-group"
                styles={styles}
                {...filterSelectMenuProps}
                options={groupOptions}
                value={groupValue}
                onChange={(option) => setGroupValue(option ?? null)}
                placeholder={`Select ${groupLabel.toLowerCase()}`}
                isClearable
                isSearchable
              />
            </span>
          ) : null}
          {groupOptions.length > 0 ? (
            <span className="filter-input-cnt">
              <label htmlFor="shop-filter-type">Type</label>
              <Select
                inputId="shop-filter-type"
                styles={styles}
                {...filterSelectMenuProps}
                options={typeOptions}
                value={type}
                onChange={(option) => setType(option ?? null)}
                placeholder={groupValue ? "Select type" : `Select ${groupLabel.toLowerCase()} first`}
                isClearable
                isSearchable
                isDisabled={typeOptions.length === 0}
              />
            </span>
          ) : null}
          {variants.map((field) => (
            <span className="filter-input-cnt" key={field.key}>
              <label htmlFor={`shop-filter-${field.key}`}>
                {field.key.charAt(0).toUpperCase() + field.key.slice(1)}
              </label>
              <Select
                inputId={`shop-filter-${field.key}`}
                styles={styles}
                {...filterSelectMenuProps}
                options={field.options.map(optionFromValue)}
                value={variantValues[field.key] ?? null}
                onChange={(option) =>
                  setVariantValues((current) => ({
                    ...current,
                    [field.key]: option ?? null,
                  }))
                }
                placeholder={`Select ${field.key}`}
                isClearable
                isSearchable
              />
            </span>
          ))}
        </div>
      ) : (
        <p style={{ margin: "8px 0 0", color: "#666", fontSize: "13px" }}>
          This category has no extra filters.
        </p>
      )}

      {hasFilters ? (
        <div className="filter-input-cnt">
          <button type="button" onClick={apply}>
            Apply Filters
          </button>
          <button type="button" className="filter-reset-btn" onClick={reset}>
            Reset Filters
          </button>
        </div>
      ) : null}
    </>
  );
}

function formatNgn(n) {
  return `₦${Number(n || 0).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export default function PublicShopPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const [shopName, setShopName] = useState("Shop");
  const [categoryLabel, setCategoryLabel] = useState("Shop");
  const [categoryRows, setCategoryRows] = useState([]);
  const [catalogAll, setCatalogAll] = useState([]);
  const [catalogError, setCatalogError] = useState("");
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [sortOption, setSortOption] = useState(null);

  
  
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BACKEND}/storefront/shop/${encodeURIComponent(slug)}/products`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setCatalogError(typeof data.error === "string" ? data.error : "Could not load products.");
          setCatalogAll([]);
          return;
        }
        const products = Array.isArray(data.products) ? data.products : [];
        if (!cancelled) {
          setCatalogAll(products);
          setCatalogError("");
        }
      } catch {
        if (!cancelled) {
          setCatalogError("Could not load products.");
          setCatalogAll([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    setAppliedFilters(EMPTY_FILTERS);
    setSortOption(null);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BACKEND}/storefront/shop/${encodeURIComponent(slug)}`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.shop) return;
        if (!cancelled) {
          setShopName(typeof data.shop.name === "string" ? data.shop.name : "Shop");
          setCategoryLabel(
            typeof data.shop.category === "string" && data.shop.category
              ? data.shop.category
              : "Shop"
          );
        }
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    const main = document.querySelector(".customer-main");
    if (!main) return;
    main.style.height = "100vh";
    main.style.borderRadius = "unset";
  }, []);

  const catalog = useMemo(() => {
    let list = catalogAll.filter((p) => productMatchesFilters(p, appliedFilters));
    if (sortOption?.value === "from_low_to_high") {
      list = [...list].sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortOption?.value === "from_high_to_low") {
      list = [...list].sort((a, b) => Number(b.price) - Number(a.price));
    }
    return list;
  }, [catalogAll, appliedFilters, sortOption]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BACKEND}/categories`);
        const data = await res.json().catch(() => []);
        if (!cancelled && Array.isArray(data)) setCategoryRows(data);
      } catch {
        if (!cancelled) setCategoryRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryRow = useMemo(
    () => findCategoryRow(categoryRows, categoryLabel),
    [categoryRows, categoryLabel],
  );

  const handleApplyFilters = useCallback((next) => {
    const variants =
      next?.variants && typeof next.variants === "object" && !Array.isArray(next.variants)
        ? next.variants
        : {};
    setAppliedFilters({
      gender: typeof next?.gender === "string" ? next.gender : "",
      subcategory: typeof next?.subcategory === "string" ? next.subcategory : "",
      type: typeof next?.type === "string" ? next.type : "",
      variants,
    });
  }, []);

  const renderCard = useCallback(
    (product) => (
      <Fragment key={product.id}>
        <div
          className="product-card"
          onClick={() => {
            window.location.href = `/store/${slug}/${product.id}`;
          }}
        >
          <div className="card-thumbnail">
            <img src={product.thumbnail} alt={product.name} />
          </div>
          <div className="card-detail">
            <div className="card-title">{product.name}</div>
            <div className="card-price">
              <b>{formatNgn(product.minPrice)}</b>
            </div>
          </div>
        </div>
      </Fragment>
    ),
    [slug]
  );

  const [isWideViewport, setIsWideViewport] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(min-width: 1200px)");
    const sync = () => setIsWideViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen]);

  useEffect(() => {
    document.querySelector(".header").style.display="none";
    document.querySelector(".customer-free-main").style.height = "100vh";
  }, [])

  return (
    <div className="shop-page" >
      <div className="shop-page-header" style={{
        background: "#fff"
      }}>

        <span style={{
          display: "flex",
        }}>
          <span>
            <h4 className="customer-vendor-page-category" style={{textTransform: "capitalize", margin: "0"}}>
              {shopName}
            </h4>
          </span>
          {isWideViewport ? (
            <span style={{
              display: "flex",
              marginLeft: "20px",
              alignItems: "center"
            }}>
              <div className="shop-links">
                About
              </div>
              <div className="shop-links">
                Brands
              </div>
            </span>
          ) : null}
        </span>

        {!isWideViewport ? (
          <span
            style={{
              display: "flex",
            }}
          >
            <button
              type="button"
              className="shop-features shop-sheet-trigger"
              aria-expanded={sheetOpen}
              aria-haspopup="dialog"
              aria-label="Open menu and filters"
              onClick={() => setSheetOpen(true)}
            >
              <img src={menuSvg.src} alt="" />
            </button>
          </span>
        ) : null}
         <span style={{flexDirection: "row", alignItems: "center", justifyContent: "space-between", display: "flex"}}>
          <Link href="/store/cart" className="customer-shell-header__icon" aria-label="Cart">
            <CartIcon />
          </Link>
          &nbsp;
          &nbsp;
          <Link
            href="/user-profile"
            className="customer-shell-header__icon"
            aria-label="Account">
            <ProfileIcon />
          </Link>
         </span>
      </div>
      <div className="shop-page-content" style={{
        height: isWideViewport ? "calc(100% - 10px)" : "calc(100% - 50px)"
      }}>
        {isWideViewport ? (
          <div className="shop-page-filter">
            <ShopFilterFields
              categoryRow={categoryRow}
              filterSelectStyles={filterSelectStyles}
              onApplyFilters={handleApplyFilters}
            />
          </div>
        ) : null}

        {!isWideViewport && sheetOpen ? (
          <div
            className="shop-sheet-backdrop"
            role="presentation"
            onClick={() => setSheetOpen(false)}
          >
            <div
              className="shop-sheet-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Shop menu and filters"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="shop-sheet-grabber" aria-hidden />
              <div className="shop-sheet-header">
                <h2 className="shop-sheet-title">Menu &amp; filters</h2>
                <button
                  type="button"
                  className="shop-sheet-close"
                  aria-label="Close"
                  onClick={() => setSheetOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="shop-sheet-nav">
                <div className="shop-links">About</div>
                <div className="shop-links">Brands</div>
              </div>
              <div className="shop-sheet-filter shop-page-filter">
                <ShopFilterFields
                  categoryRow={categoryRow}
                  filterSelectStyles={filterSelectStyles}
                  onApplyFilters={(filters) => {
                    handleApplyFilters(filters);
                    setSheetOpen(false);
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="shop-page-body-cnt">
          <div className="shop-page-body-label">
            <span>
              <h5 style={{ margin: "0px", textTransform: "capitalize" }}>{categoryLabel}</h5>
            </span>

            <span>
              <div className="filter-input-cnt" style={{display: "flex", flexDirection: "row", alignItems: "center"}}>
                {/* <label htmlFor="" style={{width: "70px", fontWeight: "500"}}>Sort By:</label> */}
                &nbsp;
                &nbsp;
                <div style={{ width: "250px" }}>
                  <Select
                    inputId="shop-sort-price"
                    styles={filterSelectStyles}
                    options={[
                      { label: "Price from Lowest to Highest", value: "from_low_to_high" },
                      { label: "Price from Highest to Lowest", value: "from_high_to_low" },
                    ]}
                    value={sortOption}
                    onChange={(option) => setSortOption(option ?? null)}
                    placeholder="Sort by"
                    isClearable
                  />
                </div>
              </div>
            </span>
          </div>
          <div className="shop-page-body">

            {catalogError ? (
              <p style={{ color: "#b91c1c", margin: "12px 0" }} role="alert">
                {catalogError}
              </p>
            ) : null}
            {!catalogError && catalogAll.length > 0 && catalog.length === 0 ? (
              <p style={{ color: "#525252", margin: "12px 0" }} role="status">
                No products match these filters. Click Reset Filters to show all products.
              </p>
            ) : null}
            <div className="shop-page-body-card-cnt">
              {catalog.map((product) => renderCard(product))}
            </div>
            {/* <div className="shop-page-body-card-cnt">

            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
