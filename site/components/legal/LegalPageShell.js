/**
 * Shared shell for global legal / informational pages.
 * Uses divs (not section) so marketing `main section` styles do not leak in.
 * @module components/legal/LegalPageShell
 */

"use client";

import React, { useEffect } from "react";
import "./legal-pages.css";

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {{ id: string, label: string }[]} [props.toc]
 * @param {React.ReactNode} props.children
 */
export default function LegalPageShell({ title, subtitle, toc = [], children }) {
  useEffect(() => {
    const previousBodyBg = document.body.style.background;
    const main = document.body.querySelector("main");
    const previousMainBg = main?.style.background;

    document.body.style.background = "#ffffff";
    document.body.classList.add("legal-route");
    if (main) {
      main.style.background = "#ffffff";
      main.classList.add("legal-route-main");
    }

    const header = document.querySelector("header");
    if (header) {
      header.style.position = "sticky";
      header.style.top = "0px";
      header.style.height = "70px";
      header.style.background = "#ffffff";
    }

    return () => {
      document.body.style.background = previousBodyBg;
      document.body.classList.remove("legal-route");
      if (main) {
        main.style.background = previousMainBg || "";
        main.classList.remove("legal-route-main");
      }
    };
  }, []);

  return (
    <div className="legal-page">
      <div className="legal-page__hero">
        <h1>{title}</h1>
        {subtitle ? <p className="legal-page__subtitle">{subtitle}</p> : null}
      </div>

      <div className="legal-page__body">
        {toc.length > 0 ? (
          <aside className="legal-page__toc">
            <h6>Table of contents</h6>
            <nav aria-label="Table of contents">
              <ol>
                {toc.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`}>{item.label}</a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>
        ) : null}
        {children}
      </div>
    </div>
  );
}
