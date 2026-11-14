"use client";

import { useEffect, useState } from "react";
import { IoHeadsetOutline, IoPersonOutline, IoSearch } from "react-icons/io5";
import Link from "next/link";
import { getCookie } from "../../reusables/verifyAuth";
import { saveCustomerAccountHint } from "../../reusables/customerAccountHint";

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
                        className="buyer-auth"
                        href={signedIn ? "/user-profile" : "/orders"}
                        aria-label={signedIn ? `Account, ${sessionName}` : "Register or login"}
                    >
                        <IoPersonOutline size={20} />
                        <div className="buyer-auth__copy">
                            <small className="buyer-auth__hello">
                                {signedIn ? `Hi, ${sessionName}` : "Register / Login"}
                            </small>
                            <small className="buyer-auth__label">Order & Account</small>
                        </div>
                    </Link>
                    <Link className="buyer-support" href={"/support"} aria-label="Support">
                        <IoHeadsetOutline size={20} />
                        <small>Support</small>
                    </Link>
                </div>

            </header>
        </>
    )
}