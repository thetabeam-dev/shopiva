/**
 * Shell for DeeDyte blog pages. Uses blog/styles (not legal-page styles).
 * @module components/blogs/BlogPageShell
 */

"use client";

import React, { useEffect } from "react";
import "../../app/blogs/styles/s.css";
import "../../app/blogs/styles/m.css";
import "../../app/blogs/styles/l.css";
import "../../app/blogs/styles/xl.css";
import "../../app/blogs/styles/xxl.css";

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {React.ReactNode} props.children
 */
export default function BlogPageShell({ title, subtitle, children }) {
  useEffect(() => {
    const html = document.documentElement;
    const previousBodyBg = document.body.style.background;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlHeight = html.style.height;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyHeight = document.body.style.height;
    const main = document.body.querySelector("main");
    const header = document.body.querySelector(".header");
    const previousMainBg = main?.style.background;
    const previousHeaderDisplay = header?.style.display;

    html.style.overflow = "auto";
    html.style.height = "auto";
    document.body.style.overflow = "auto";
    document.body.style.height = "auto";
    document.body.style.background = "#f5f5f5";
    document.body.classList.add("blog-route");
    if (main) {
      main.style.background = "#f5f5f5";
      main.classList.add("blog-route-main");
    }
    if (header) header.style.display = "none";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.height = previousHtmlHeight;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.height = previousBodyHeight;
      document.body.style.background = previousBodyBg;
      document.body.classList.remove("blog-route");
      if (main) {
        main.style.background = previousMainBg || "";
        main.classList.remove("blog-route-main");
      }
      if (header) header.style.display = previousHeaderDisplay || "";
    };
  }, []);

  return (
    <div className="blog-page">
      <div className="blog-page__hero">
        <h1 className="page-h1 page-h1--hero">{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="blog-page__body">{children}</div>
    </div>
  );
}
