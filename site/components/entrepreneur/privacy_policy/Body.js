/**
 * Privacy Policy body — delegates to the global DeeDyte Privacy Policy content.
 * @module components/entrepreneur/privacy_policy/Body
 */

import React from "react";
import PrivacyPolicyContent, {
  PRIVACY_TOC,
} from "../../legal/PrivacyPolicyContent";
import "../../legal/legal-pages.css";

export default function Body() {
  return (
    <section className="legal-page__body" style={{ borderRadius: 0 }}>
      <aside className="legal-page__toc">
        <h6>Table Of Contents</h6>
        <nav aria-label="Table of contents">
          <ol>
            {PRIVACY_TOC.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.label}</a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>
      <PrivacyPolicyContent />
    </section>
  );
}
