/**
 * About Page Head Component
 * 
 * Hero section for the About page.
 * Displays main headline and hero image.
 * 
 * @module components/entrepreneur/about/Head
 */

import React from "react";
import ui_image from "../../../images/about-hero-small-2a2faf4cb65f77ff8a7957d0f3f5c335a0d13a328f773d30ae252d81e8475dce.webp";

// ============================================================================
// HEAD COMPONENT
// ============================================================================

/**
 * About page hero section component
 * 
 * @returns {JSX.Element} The hero section
 */
export default function Head() {
  return (
    <section id="deedyte-about-head">
      {/* Text Content */}
      <div>
        <h3 style={{ fontWeight: "400" }}>About Deedyte</h3>

        <h2 style={{ fontWeight: "400" }}>
          Deedyte makes e-commerce enjoyable and better.
        </h2>
        
        <br />
        <br />

        <div
          style={{
            width: "100%",
            padding: "0",
            display: "block",
            height: "auto",
          }}
        >
          <h5 style={{ fontWeight: "400" }}>
            The all-in-one commerce platform to start, run, and grow a business.
          </h5>
          <br />
          <button>Get Started</button>
        </div>
      </div>

      {/* Hero Image */}
      <div>
        <img
          src={ui_image.src}
          style={{ height: "100%", width: "100%", borderRadius: "10px" }}
          alt="About Deedyte hero"
        />
      </div>
    </section>
  );
}
