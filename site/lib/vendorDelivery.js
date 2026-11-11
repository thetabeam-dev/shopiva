/**
 * Buyer shipping helpers (same rules as the DeeDyte mobile app).
 */

export function parseShopId(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Shop/zone extra-item discount from vendor setup. 0 is valid (no extra-item discount). */
export function readDiscountPercent(raw, fallback = 50) {
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
  const fb = Number(fallback);
  return Number.isFinite(fb) && fb >= 0 && fb <= 100 ? fb : 50;
}

export function computeMultiItemShippingFee(itemCount, baseFee, discountPercent) {
  const count = Math.max(0, Math.floor(Number(itemCount) || 0));
  const base = Math.max(0, Number(baseFee) || 0);
  const discount = Math.min(100, Math.max(0, Number(discountPercent) || 0)) / 100;
  if (count <= 0 || base <= 0) return 0;
  const extra = Math.max(0, count - 1);
  const extraUnit = base * (1 - discount);
  return Math.round(base + extra * extraUnit);
}

export function calculateEstimatedShippingFee({
  baseShippingFee,
  additionalItemDiscountPercent,
  safetyBufferPercent = 30,
  items,
}) {
  if (!Number.isFinite(baseShippingFee) || baseShippingFee < 0) {
    throw new Error("Invalid base shipping fee");
  }
  if (
    !Number.isFinite(additionalItemDiscountPercent) ||
    additionalItemDiscountPercent < 0 ||
    additionalItemDiscountPercent > 100
  ) {
    throw new Error("Discount must be between 0 and 100");
  }
  if (!Number.isFinite(safetyBufferPercent) || safetyBufferPercent < 0) {
    throw new Error("Invalid safety buffer");
  }
  if (
    !items?.length ||
    items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)
  ) {
    throw new Error("At least one valid item is required");
  }

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const discountRate = additionalItemDiscountPercent / 100;
  const additionalItemRate = 1 - discountRate;
  const shippingBeforeBuffer = baseShippingFee * (1 + (itemCount - 1) * additionalItemRate);
  const safetyBufferAmount = shippingBeforeBuffer * (safetyBufferPercent / 100);
  const estimatedShippingFee = Math.ceil(shippingBeforeBuffer + safetyBufferAmount);

  return {
    itemCount,
    baseShippingFee,
    shippingBeforeBuffer,
    safetyBufferAmount,
    estimatedShippingFee,
  };
}

export function normalizeShopDelivery(data) {
  if (!data || typeof data !== "object") return null;
  const row =
    data.locations || data.shopId || data.shop_id
      ? data
      : data.data && typeof data.data === "object"
        ? data.data
        : data;
  const shopId = parseShopId(row.shopId ?? row.shop_id);
  if (!shopId) return null;
  const shopDiscount = readDiscountPercent(
    row.discountPercent ?? row.discount_percent,
    50,
  );
  const locations = Array.isArray(row.locations)
    ? row.locations
        .filter((x) => x && typeof x === "object")
        .map((loc) => {
          const name = String(loc.name ?? "").trim();
          const key = String(loc.key ?? name).trim().toLowerCase();
          const fee = Math.max(0, Math.round(Number(loc.fee) || 0));
          const discountPercent = readDiscountPercent(
            loc.discountPercent ?? loc.discount_percent,
            shopDiscount,
          );
          return {
            key,
            name: name || key,
            fee,
            zoneId: String(loc.zoneId ?? loc.zone_id ?? ""),
            zoneName: String(loc.zoneName ?? loc.zone_name ?? ""),
            discountPercent,
          };
        })
        .filter((x) => x.name)
    : [];
  return {
    shopId,
    discountPercent: shopDiscount,
    locations,
  };
}

export function listAllDeliveryStates(shops) {
  const byKey = new Map();
  for (const shop of shops) {
    const locations = shop.delivery?.locations || [];
    for (const loc of locations) {
      if (!loc?.key) continue;
      if (!byKey.has(loc.key)) {
        byKey.set(loc.key, { key: loc.key, name: loc.name || loc.key });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function evaluateDeliveryState(shops, stateKey) {
  const key = String(stateKey || "").trim().toLowerCase();
  const supported = [];
  const unsupported = [];
  const perShop = [];
  let name = "";
  for (const shop of shops) {
    const label = shop.shopName || `Shop ${shop.shopId}`;
    const loc = (shop.delivery?.locations || []).find((row) => row.key === key);
    if (loc) {
      name = loc.name || name;
      supported.push(label);
      perShop.push({
        shopId: shop.shopId,
        fee: loc.fee,
        discountPercent: loc.discountPercent,
        itemCount: shop.itemCount,
      });
    } else {
      unsupported.push(label);
    }
  }
  const allSupported = shops.length > 0 && unsupported.length === 0;
  const checkoutFee = perShop.reduce(
    (sum, shop) =>
      sum + computeMultiItemShippingFee(shop.itemCount, shop.fee, shop.discountPercent),
    0,
  );
  return {
    key,
    name: name || key,
    allSupported,
    supported,
    unsupported,
    location: perShop.length
      ? { key, name: name || key, perShop, checkoutFee }
      : null,
  };
}

export function mergeCheckoutDeliveryLocations(shops) {
  const usable = shops.filter((s) => s.delivery && s.delivery.locations.length);
  if (!usable.length) return [];

  const byKey = new Map();
  for (const shop of usable) {
    for (const loc of shop.delivery.locations) {
      const prev = byKey.get(loc.key) || { name: loc.name, perShop: [] };
      prev.perShop.push({
        shopId: shop.shopId,
        fee: loc.fee,
        discountPercent: loc.discountPercent,
        itemCount: shop.itemCount,
      });
      byKey.set(loc.key, prev);
    }
  }

  const shopCount = usable.length;
  const rows = [];
  for (const [key, value] of byKey.entries()) {
    if (value.perShop.length !== shopCount) continue;
    const checkoutFee = value.perShop.reduce(
      (sum, shop) =>
        sum + computeMultiItemShippingFee(shop.itemCount, shop.fee, shop.discountPercent),
      0,
    );
    const displayFee = value.perShop.reduce((sum, shop) => sum + shop.fee, 0);
    rows.push({
      key,
      name: value.name,
      fee: displayFee,
      checkoutFee,
      perShop: value.perShop,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export function estimateLocationShipping(location, lines) {
  if (!location?.perShop?.length) return null;
  try {
    return location.perShop.reduce((sum, shop) => {
      const shopLines = lines.filter((line) => parseShopId(line.shopId) === shop.shopId);
      const items = (shopLines.length ? shopLines : [{ quantity: shop.itemCount }]).map((line) => ({
        quantity: Math.max(1, Math.round(Number(line.quantity) || 1)),
      }));
      const estimate = calculateEstimatedShippingFee({
        baseShippingFee: Number(shop.fee) || 0,
        additionalItemDiscountPercent: readDiscountPercent(shop.discountPercent, 0),
        safetyBufferPercent: 30,
        items,
      });
      return sum + estimate.estimatedShippingFee;
    }, 0);
  } catch {
    return Number(location.checkoutFee) || 0;
  }
}
