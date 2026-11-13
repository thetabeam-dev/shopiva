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
    const previousBodyBg = document.body.style.background;
    const main = document.body.querySelector("main");
    const header = document.body.querySelector(".header");
    const previousMainBg = main?.style.background;
    const previousHeaderDisplay = header?.style.display;

    document.body.style.background = "#f5f5f5";
    document.body.classList.add("blog-route");
    if (main) {
      main.style.background = "#f5f5f5";
      main.classList.add("blog-route-main");
    }
    if (header) header.style.display = "none";

    return () => {
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
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="blog-page__body">{children}</div>
    </div>
  );
}
