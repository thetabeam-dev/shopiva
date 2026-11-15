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
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlHeight = document.documentElement.style.height;
    const previousBodyHeight = document.body.style.height;
    const main = document.body.querySelector("main");
    const previousMainBg = main?.style.background;

    document.body.style.background = "#ffffff";
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    document.documentElement.style.overflow = "auto";
    document.documentElement.style.height = "auto";
    document.body.classList.add("legal-route");
    if (main) {
      main.style.background = "#ffffff";
      main.style.height = "auto";
      main.style.overflow = "visible";
      main.classList.add("legal-route-main");
    }

    return () => {
      document.body.style.background = previousBodyBg;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.height = previousBodyHeight;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.documentElement.style.height = previousHtmlHeight;
      document.body.classList.remove("legal-route");
      if (main) {
        main.style.background = previousMainBg || "";
        main.style.height = "";
        main.style.overflow = "";
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
