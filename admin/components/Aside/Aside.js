"use client"

import React, { useEffect, useState } from 'react'
import "./style.css";

const menuItems = [
    { label: "Home", svg: "", countKey: null },
    { label: "Users", svg: "", countKey: "users" },
    { label: "Products", svg: "", countKey: "products" },
    { label: "Inventory", svg: "", countKey: "inventory" },
    { label: "Shops", svg: "", countKey: "shops" },
    { label: "Shop KYC", svg: "", countKey: "shopKyc" },
    { label: "Orders", svg: "", countKey: "orders" },
    { label: "Returns", svg: "", countKey: "returns" },
    { label: "Disputes", svg: "", countKey: "disputes" },
    { label: "Cart", svg: "", countKey: "cart" },
    { label: "Transactions", svg: "", countKey: "transactions" },
];

const REFRESH_INTERVAL_MS = 15000;

export default function Aside({ activePage, onSelect }) {
    const [counts, setCounts] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetchCounts = async () => {
            try {
                const res = await fetch('/api/menu-counts');
                const json = await res.json();
                if (!mounted) return;
                if (res.ok) {
                    setCounts(json);
                } else {
                    console.error('Failed to load menu counts', json.error);
                }
            } catch (err) {
                console.error(err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchCounts();
        const intervalId = setInterval(fetchCounts, REFRESH_INTERVAL_MS);

        return () => {
            mounted = false;
            clearInterval(intervalId);
        };
    }, []);

    return (
        <aside className="aside-nav">
            <ul>
                {menuItems.map((menu) => (
                    <li key={menu.label} className={activePage === menu.label ? 'active' : ''}>
                        <button
                            type="button"
                            className="aside-link"
                            aria-current={activePage === menu.label ? 'page' : undefined}
                            onClick={() => onSelect(menu.label)}
                        >
                            <span className="aside-icon" aria-hidden="true">{menu.svg || menu.label.charAt(0)}</span>
                            <span>{menu.label}</span>
                            {menu.countKey ? (
                                <span className="aside-count">
                                    {loading ? '…' : counts[menu.countKey] ?? 0}
                                </span>
                            ) : null}
                        </button>
                    </li>
                ))}
            </ul>
        </aside>
    )
}
