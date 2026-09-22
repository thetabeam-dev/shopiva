/**
 * About Page Story Component
 * 
 * Displays the Deedyte origin story and company history.
 * 
 * @module components/entrepreneur/about/Story
 */

import React from "react";
import plus_image from "../../../images/FEATURES_Integration.webp";

// ============================================================================
// STORY COMPONENT
// ============================================================================

/**
 * Company story section component
 * 
 * @returns {JSX.Element} The story section
 */
export default function Story() {
  return (
    <section>
      <br />

      <h2 style={{ fontWeight: "400" }}>Deedyte story</h2>

      <div className="deedyte-story-cnt" style={{ height: "auto" }}>
        {/* Story Image */}
        <div className="deedyte-story-img-cnt">
          <img
            src={plus_image.src}
            style={{ height: "100%", borderRadius: "10px" }}
            alt="Deedyte story"
          />
        </div>

        {/* Story Text */}
        <div
          style={{
            textAlign: "left",
            color: "#000",
            height: "auto",
            justifyContent: "flex-start",
          }}
        >
          <div
            className="deedyte-story-text-cnt"
            style={{ height: "auto", padding: "0" }}
          >
            <h3 style={{ marginBottom: "20px", fontWeight: "400" }}>
              Deedyte was created in SE Nigeria.
            </h3>

            <p
              style={{
                color: "#42474c",
                fontSize: "medium",
                margin: "0",
                height: "fit-content",
                fontWeight: "400",
              }}
            >
              Over a year ago, we embarked on a journey to create a platform
              specifically designed for buyers in Nigeria to buy and
              sell online with ease. At that time, none of the existing
              e-commerce solutions offered the control and flexibility we needed
              to truly empower our community—so we decided to build our own.
              That&apos;s how Deedyte was born: a user-friendly, all-in-one
              solution that caters to sellers&apos; needs, from inventory
              management to secure transactions, giving them the freedom to
              focus on what they do best.
              <br />
              <br />
              Today, Deedyte has grown beyond just serving buyers; it has
              become the go-to platform for businesses of all sizes. Whether
              you&apos;re an online seller, running a physical retail store, or
              making sales on-the-go, Deedyte equips you with powerful tools to
              manage, expand, and simplify your business. We&apos;re proud to
              support entrepreneurs across Nigeria as they build successful
              businesses on their own terms with Deedyte by their side.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
