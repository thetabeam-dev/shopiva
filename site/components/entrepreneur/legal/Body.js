/**
 * Legal page body — delegates to the global DeeDyte legal hub.
 * @module components/entrepreneur/legal/Body
 */

import React from "react";
import LegalHubContent from "../../legal/LegalHubContent";
import "../../legal/legal-pages.css";

export default function Body() {
  return (
    <section className="legal-page__body" style={{ borderRadius: 0 }}>
      <LegalHubContent />
    </section>
  );
}
