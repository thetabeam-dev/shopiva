/**
 * Privacy Policy Page Head Component
 * 
 * Hero section for the Privacy Policy page.
 * Displays main headline and introduction.
 * 
 * @module components/entrepreneur/privacy_policy/Head
 */

import React from "react";

// ============================================================================
// HEAD COMPONENT
// ============================================================================

/**
 * Privacy Policy page hero section component
 * 
 * @returns {JSX.Element} The hero section
 */
export default function Head() {
  return (
    <section style={{ flexDirection: "column" }}>
      <h1>Privacy Policy</h1>
      <br />
      <h5>How Deedyte handles your data</h5>
    </section>
  );
}
