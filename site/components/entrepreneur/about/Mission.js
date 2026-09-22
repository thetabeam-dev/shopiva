/**
 * About Page Mission Component
 * 
 * Displays Deedyte's mission statement.
 * 
 * @module components/entrepreneur/about/Mission
 */

import React from "react";

// ============================================================================
// MISSION COMPONENT
// ============================================================================

/**
 * Mission statement section component
 * 
 * @returns {JSX.Element} The mission section
 */
export default function Mission() {
  return (
    <section
      style={{
        display: "flex",
        justifyContent: "center",
        color: "#000",
        flexDirection: "column",
        padding: "60px 10px",
        background: "#fff",
        height: "fit-content",
        textAlign: "center",
      }}
    >
      <h2 style={{ fontWeight: "400" }}>Our Mission</h2>

      <h3 style={{ fontWeight: "200" }}>Improve commerce for everyone.</h3>

      <p
        className="mission-statement"
        style={{ fontSize: "large", fontWeight: "100" }}
      >
        We help individuals achieve fulfillment by making it enjoyable to start,
        operate, and manage an online business. With the anticipated rapid
        growth of e-commerce, we are committed to reducing the barriers to
        business ownership, ensuring convenience and satisfaction throughout the
        process.
      </p>
    </section>
  );
}
