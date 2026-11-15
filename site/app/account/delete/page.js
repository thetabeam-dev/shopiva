"use client";

import React, { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { API_BACKEND } from "@/reusables/shopBackendAuth";

const COOKIE_NAMES = { entrepreneur: "entrepreneur_secret", customer: "customer_secret" };
const EXPIRED_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";
function deleteCookie(name) {
    document.cookie = `${name}=; expires=${EXPIRED_DATE}; path=/`;
}
function clearAuthCookies() {
    deleteCookie(COOKIE_NAMES.entrepreneur);
    deleteCookie(COOKIE_NAMES.customer);
}

export default function AccountDeletePage() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [ack, setAck] = useState(false);
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_BACKEND}/user/authorization`, {
                    method: "POST",
                    credentials: "include",
                });
                const j = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (!res.ok || !j?.bool) {
                    window.location.href = "/auth/login?role=customer";
                    return;
                }
                setProfile(j.data ?? null);
            } catch (e) {
                console.error(e);
                setError("Could not verify session. Please sign in.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const startOauthReauth = (provider) => {
        window.open(`${API_BACKEND}/api/oauth/${provider}`, "_blank", "noopener,noreferrer");
    };

    const onDelete = async () => {
        if (submitting) return;
        if (!ack) {
            setError("Please acknowledge the deletion consequences.");
            return;
        }
        if (!profile) return;
        const provider = String(profile.provider ?? "local").toLowerCase();
        if (provider === "local" && !password.trim()) {
            setError("Enter your password to confirm deletion.");
            return;
        }

        if (!confirm("Delete account? This action is permanent and cannot be undone.")) return;

        setSubmitting(true);
        setError("");
        try {
            const body = provider === "local" ? { password: password.trim() } : {};
            const res = await fetch(`${API_BACKEND}/api/account`, {
                method: "DELETE",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                setMessage("Your account has been deleted permanently.");
                try {
                    clearAuthCookies();
                    await signOut({ redirect: false });
                } catch {
                }
                setTimeout(() => (window.location.href = "/"), 2200);
                return;
            }

            if (res.status === 401) {
                setError(data?.error || data?.message || "Authentication required. Please sign in again.");
                setTimeout(() => (window.location.href = "/auth/login?role=customer"), 900);
                return;
            }
            if (res.status === 403) {
                setError(data?.error || data?.message || "Invalid credentials.");
                return;
            }
            if (res.status === 422) {
                setError(data?.error || data?.message || "Re-authentication is required. Follow the instructions.");
                return;
            }

            setError(data?.error || data?.message || "Could not delete account. Try again later.");
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: 32 }}>
                <h2>Delete account</h2>
                <p>Loading…</p>
            </div>
        );
    }

    return (
        <main style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
            <h1>Delete your DeeDyte account — Making Commerce Safe For Everyone</h1>
            <section style={{ marginTop: 16, padding: 16, borderRadius: 8, background: "#feecec", border: "1px solid #f3bbbb" }} aria-label="Account deletion warning">
                <p style={{ fontWeight: 700 }}>Deleting your account is permanent and cannot be undone.</p>
                <p>This will permanently remove: profile information, addresses, saved payment methods, wishlist, notifications, and shopping history where legally allowed.</p>
                <p style={{ fontSize: 13, color: "#333" }}>Some transaction records may be retained where required by law.</p>
            </section>

            <section style={{ marginTop: 18, padding: 16, borderRadius: 8, background: "#fff", border: "1px solid #e6e6e6" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                    <span>I understand that deleting my account is permanent.</span>
                </label>

                {profile && String((profile.provider ?? "local")).toLowerCase() === "local" ? (
                    <div style={{ marginTop: 12 }}>
                        <label style={{ display: "block", marginBottom: 6 }}>Confirm password</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }} />
                    </div>
                ) : (
                    <div style={{ marginTop: 12 }}>
                        <p>To delete accounts created through an OAuth provider (Google, Facebook, Apple), you must re-authenticate with the provider before deletion.</p>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" onClick={() => startOauthReauth(String(profile?.provider ?? "google")).catch(() => { })} style={{ padding: "8px 12px" }}>
                                Re-authenticate with {String(profile?.provider ?? "provider").toUpperCase()}
                            </button>
                        </div>
                    </div>
                )}

                <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
                    <button onClick={onDelete} disabled={submitting} style={{ background: "#c62828", color: "#fff", padding: "10px 14px", border: "none", borderRadius: 6 }}>
                        {submitting ? "Deleting…" : "Delete account"}
                    </button>
                    <button onClick={() => (window.location.href = "/")} style={{ padding: "8px 12px" }}>
                        Cancel
                    </button>
                </div>

                {message ? <p style={{ color: "green", marginTop: 12 }}>{message}</p> : null}
                {error ? <p role="alert" style={{ color: "#b00020", marginTop: 12 }}>{error}</p> : null}
            </section>
        </main>
    );
}
