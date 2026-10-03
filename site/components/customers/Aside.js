"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./assets/aside.css";

function normalizePath(pathname) {
  const path = (pathname || "").split("?")[0];
  return path.replace(/\/+$/, "") || "/";
}

function isPathActive(pathname, href) {
  const current = normalizePath(pathname);
  const target = normalizePath(href);
  return current === target || current.startsWith(`${target}/`);
}

const LINKS = [
//   { href: "/store/inbox", label: "Inbox" },
  { href: "/store/orders", label: "Orders" },
  { href: "/store/disputes", label: "Disputes" },
];

export default function Aside() {
  const pathname = usePathname();

  return (
    <aside className="customer-aside-panel" aria-label="Checkout navigation">
      {/* <h2 className="customer-aside-panel__title">Checkout panel</h2> */}
      <nav aria-label="Checkout, orders, disputes">
        <ul className="customer-aside-panel__list">
          {LINKS.map((link) => {
            const active = isPathActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                    style={{
                        textDecoration: "none"
                    }}
                  href={link.href}
                  className={`customer-aside-panel__link${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div >
            <button className="user-head" onClick={e => window.location.href = "/user-profile"}>
                <span>

                </span>
                &nbsp;
                &nbsp;
                <span>Akpulu.F (Dummy data)</span>
            </button>
            <hr />
            <button className="log-out-btn">
                Log out
            </button>
        </div>
      </nav>
    </aside>
  );
}
