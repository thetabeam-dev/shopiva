/**
 * Store Nigerian numbers as the subscriber digits with no trunk prefix.
 * +2348032639894, +08032639894, and 08032639894 all become 8032639894.
 */
export function formatPhoneNumber(value: unknown): string | null {
    if (value == null) return null;
    const raw = String(value).trim();
    if (!raw || raw.toUpperCase() === "NULL") return null;

    let digits = raw.replace(/\D/g, "");
    if (!digits) return null;

    if (digits.startsWith("234") && digits.length > 10) {
        digits = digits.slice(3);
    }

    digits = digits.replace(/^0+/, "");
    return digits || null;
}

/** Nigerian GSM: 10 subscriber digits after stripping 0 / 234 (e.g. 8032639894). */
export function requireNigerianMobile(value: unknown): string {
    const digits = formatPhoneNumber(value);
    if (!digits || digits.length !== 10 || !/^[789]/.test(digits)) {
        throw new Error("Enter a valid Nigerian mobile number (11 digits starting with 0).");
    }
    return digits;
}
