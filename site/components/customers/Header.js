"use client";

import { useEffect, useState } from "react";
import { IoCartOutline, IoHeadsetOutline, IoPersonOutline, IoSearch } from "react-icons/io5";
import Link from "next/link";
import { getCookie } from "../../reusables/verifyAuth";
import { saveCustomerAccountHint } from "../../reusables/customerAccountHint";
import { CART_UPDATED_EVENT } from "../../reusables/cartEvents";
import { buyerAuthHeaders } from "../../reusables/shopBackendAuth";

function displayNameFromSession(data) {
    if (!data || typeof data !== "object") return "Account";
    const raw =
        data.fname ||
        data.name ||
        (typeof data.email === "string" ? data.email.split("@")[0] : "") ||
        "";
    const first = String(raw).trim().split(/\s+/)[0];
    if (!first) return "Account";
    return first.charAt(0).toUpperCase() + first.slice(1);
}

export default function CustomerHeader() {
    const [sessionName, setSessionName] = useState(null);
    const [cartCount, setCartCount] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const headers = { "Content-Type": "application/json" };
        const token = getCookie("customer_secret");
        if (token) headers.Authorization = `Bearer ${token}`;

        fetch("/api/user/authorization", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ role: "customer" }),
        })
            .then(async (res) => {
                const payload = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (res.ok && payload.bool) {
                    setSessionName(displayNameFromSession(payload.data));
                    saveCustomerAccountHint({
                        email: payload.data?.email,
                        name: displayNameFromSession(payload.data),
                    });
                } else {
                    setSessionName(null);
                }
            })
            .catch(() => {
                if (!cancelled) setSessionName(null);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        async function loadCount() {
            try {
                const res = await fetch("/api/cart", {
                    method: "GET",
                    headers: buyerAuthHeaders(),
                    credentials: "include",
                });
                const data = await res.json().catch(() => ({}));
                if (cancelled || !res.ok) return;
                const items = Array.isArray(data.items) ? data.items : [];
                setCartCount(items.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0));
            } catch {
                if (!cancelled) setCartCount(0);
            }
        }
        loadCount();
        window.addEventListener(CART_UPDATED_EVENT, loadCount);
        return () => {
            cancelled = true;
            window.removeEventListener(CART_UPDATED_EVENT, loadCount);
        };
    }, []);

    const signedIn = Boolean(sessionName);

    return (
        <>
            <header className="buyer-header">
                <img src="/Deedyte.png" alt="DeeDyte" className="buyer-header__logo" />

                <form
                    className="buyer-search"
                    role="search"
                    onSubmit={(event) => event.preventDefault()}
                >
                    <input
                        type="search"
                        name="q"
                        placeholder="What are you searching for?"
                        aria-label="Search"
                    />
                    <button type="submit" className="buyer-search__btn" aria-label="Search">
                        <IoSearch size={16} color="#fff" />
                    </button>
                </form>

                <div className="buyer-header-group">
                    <Link
                        style={{
                            textDecoration: "none",
                            color: "#000"
                        }}
                        className="buyer-auth"
                        href={signedIn ? "/user-profile" : "/orders"}
                    >
                        <IoPersonOutline size={18} />
                        &nbsp;
                        <div>
                            <small style={{fontSize: "10px"}}>
                                {signedIn ? `Hi, ${sessionName}` : "Register / Login"}
                            </small>
                            <small style={{fontSize: "12px", fontWeight: "600"}}>Order & Account</small>
                        </div>
                    </Link>
                </div>
                <div className="buyer-header-group">
                   
                    <Link
                        className="buyer-cart-link"
                        style={{
                        textDecoration: "none",
                        color: "#000",
                        background: "#fff"

                    }} href={"/cart"}>
                        <IoCartOutline color="#000" size={18} />
                        {cartCount > 0 ? <span className="buyer-cart-count">{cartCount}</span> : null}
                    </Link>
                    &nbsp;
                    &nbsp;
                    &nbsp;

                    <Link style={{
                        textDecoration: "none",
                        color: "#000",
                        fontSize: "medium",
                        display: "flex",
                        alignItems: "center"
                    }} href={"/support"} >
                        <IoHeadsetOutline size={18} />
                        &nbsp;
                        <small>Support</small>
                    </Link>
                </div>

            </header>
        </>
    )
}