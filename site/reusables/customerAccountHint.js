const HINT_KEY = "deedyte_customer_account";

export function maskEmail(email) {
  const value = String(email || "").trim();
  const at = value.indexOf("@");
  if (at < 1) return value;
  const local = value.slice(0, at);
  const domain = value.slice(at);
  if (local.length <= 3) return `${local[0]}***${domain}`;
  const head = local.slice(0, 3);
  const tail = local.length > 6 ? local.slice(-3) : "";
  return `${head}***${tail}${domain}`;
}

export function readCustomerAccountHint() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const email = typeof parsed?.email === "string" ? parsed.email.trim() : "";
    const name = typeof parsed?.name === "string" ? parsed.name.trim() : "";
    if (!email && !name) return null;
    return { email, name };
  } catch {
    return null;
  }
}

export function saveCustomerAccountHint({ email, name } = {}) {
  if (typeof window === "undefined") return;
  const nextEmail = typeof email === "string" ? email.trim() : "";
  const nextName = typeof name === "string" ? name.trim() : "";
  if (!nextEmail && !nextName) return;
  window.localStorage.setItem(
    HINT_KEY,
    JSON.stringify({ email: nextEmail, name: nextName }),
  );
}

export function clearCustomerAccountHint() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HINT_KEY);
}

export function hintInitial(hint) {
  const source = hint?.name || hint?.email || "U";
  const letter = String(source).trim().charAt(0);
  return letter ? letter.toUpperCase() : "U";
}
