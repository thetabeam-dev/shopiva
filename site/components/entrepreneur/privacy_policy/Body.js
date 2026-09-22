/**
 * Privacy Policy Page Body Component
 * 
 * Main content section for the Privacy Policy page.
 * Displays table of contents and policy details.
 * 
 * @module components/entrepreneur/privacy_policy/Body
 */

import React from "react";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Privacy policy table of contents items
 */
const TABLE_OF_CONTENTS = [
  "Account terms",
  "Account Activation",
  "Shopify Rights",
  "Your Responsibilities",
  "Payment Of Fees And Taxes",
  "Confidentiality",
  "Limitation Of Liability and Indemnification",
  "Intellectual Property And Your Materials",
  "Additional Services",
  "Privacy and Data Protection",
  "Refund & Returns",
  "Deedyte Contracting Party",
  "Terms and Termination",
  "Modification",
  "General Condition",
];

// ============================================================================
// BODY COMPONENT
// ============================================================================

/**
 * Privacy Policy page body section component
 * 
 * @returns {JSX.Element} The body section
 */
export default function Body() {
  return (
    <section style={{ borderRadius: "0" }}>
      {/* Table of Contents */}
      <div>
        <h6>Table Of Contents</h6>
        <nav>
          <ol id="privacy-policy-list-cnt">
            {TABLE_OF_CONTENTS.map((item, index) => (
              <li key={index} id="privacy-policy-list">
                {item}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Article Content */}
      <article>
        {/* TODO: Add privacy policy content */}
      </article>
    </section>
  );
}
