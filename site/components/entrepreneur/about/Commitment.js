/**
 * About Page Commitment Component
 * 
 * Displays Deedyte's commitment to sustainability.
 * 
 * @module components/entrepreneur/about/Commitment
 */

import React from "react";
import plus_image from "../../../images/FEATURES_Integration.webp";

// ============================================================================
// COMMITMENT COMPONENT
// ============================================================================

/**
 * Sustainability commitment section component
 * 
 * @returns {JSX.Element} The commitment section
 */
export default function Commitment() {
  return (
    <section id="commitment-cnt" style={{ background: "#00b688" }}>
      {/* Commitment Image */}
      <div>
        <img
          src={plus_image.src}
          style={{ height: "400px", borderRadius: "10px" }}
          alt="Sustainability commitment"
        />
      </div>

      {/* Commitment Text */}
      <div style={{ textAlign: "left", color: "#000", height: "auto" }}>
        <div className="commitment-cnt-textarea" style={{ height: "auto" }}>
          <h5 style={{ fontWeight: "400" }}>
            Our commitment to sustainability
          </h5>
          
          <br />
          
          <h3 style={{ fontWeight: "400" }}>
            We&apos;re building a 100-year company
          </h3>
          
          <br />
          
          <h4
            className="commitment-txt"
            style={{ color: "#fff", textAlign: "left", fontWeight: "100" }}
          >
            Deedyte builds for the long term, and that means investing in our
            planet so that we can future proof Deedyte and help our merchants
            future proof their businesses, too. Our Sustainability Fund includes
            kickstarting the carbon removal market and choosing renewable
            energy, reducing and removing our carbon emissions, and creating
            solutions for our merchants to do the same.
          </h4>
        </div>
      </div>
    </section>
  );
}
