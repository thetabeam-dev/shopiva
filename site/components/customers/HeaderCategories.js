"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IoChevronDown } from "react-icons/io5";

const VISIBLE_COUNT = 5;

export default function Categories() {
    const [categories, setCategories] = useState([]);
    const [moreOpen, setMoreOpen] = useState(false);
    const moreRef = useRef(null);

    useEffect(() => {
        let active = true;
        fetch("/api/storefront/categories")
            .then((response) => response.json())
            .then((payload) => {
                if (active && Array.isArray(payload?.categories)) {
                    setCategories(payload.categories);
                }
            })
            .catch(() => {
                if (active) setCategories([]);
            });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!moreOpen) return undefined;

        const onPointerDown = (event) => {
            if (!moreRef.current?.contains(event.target)) {
                setMoreOpen(false);
            }
        };
        const onKeyDown = (event) => {
            if (event.key === "Escape") setMoreOpen(false);
        };

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [moreOpen]);

    if (!categories.length) return null;

    const visible = categories.slice(0, VISIBLE_COUNT);
    const more = categories.slice(VISIBLE_COUNT);

    return (
        <nav className="deedyte-categories" aria-label="Shop categories">
            {visible.map((category) => (
                <Link key={category.path} href={category.path}>
                    {category.title}
                </Link>
            ))}
            {more.length > 0 ? (
                <div
                    ref={moreRef}
                    className={`deedyte-categories-more${moreOpen ? " is-open" : ""}`}
                    onMouseEnter={() => setMoreOpen(true)}
                    onMouseLeave={() => setMoreOpen(false)}
                >
                    <button
                        type="button"
                        aria-expanded={moreOpen}
                        aria-haspopup="true"
                        onClick={() => setMoreOpen((open) => !open)}
                    >
                        More
                        <IoChevronDown size={12} />
                    </button>
                    {moreOpen ? (
                        <div className="deedyte-categories-mega" role="menu">
                            {more.map((category) => (
                                <Link
                                    key={category.path}
                                    href={category.path}
                                    role="menuitem"
                                    onClick={() => setMoreOpen(false)}
                                >
                                    {category.title}
                                </Link>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </nav>
    );
}
