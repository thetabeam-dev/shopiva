/**
 * Resources Floater Component
 * 
 * Displays resource categories and help content in a mega menu.
 * Shows Help & Support, About Deedyte, and Popular Topics sections.
 * 
 * @module components/floaters/Resources
 */

import React from "react";
import start_svg from "../../svgs/security-protection-shield-start-svgrepo-com.svg";
import sell_svg from "../../svgs/coin-vector-svgrepo-com.svg";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Resource menu sections with their items
 */
const RESOURCE_SECTIONS = [
  {
    id: "help",
    title: "Help & Support",
    icon: start_svg,
    items: [
      { title: "Help and support.", subtitle: "Get 24/7 support" },
      { title: "How-to guides.", subtitle: "Read in-depth business guides" },
      { title: "Business courses.", subtitle: "Learn from proven experts" },
      { title: "Deedyte blog.", subtitle: "Business strategy tips" },
    ],
  },
  {
    id: "about",
    title: "About Deedyte",
    icon: sell_svg,
    items: [
      { title: "What is Deedyte?", subtitle: "How our commerce platform works" },
      { title: "Founder stories.", subtitle: "Learn from successful merchants" },
    ],
  },
  {
    id: "topics",
    title: "Popular Topics",
    icon: sell_svg,
    items: [
      { title: "Branding.", subtitle: "Build your brand from scratch" },
      { title: "Marketing.", subtitle: "Build a marketing plan" },
      { title: "Ecommerce SEO.", subtitle: "Improve your search ranking" },
      { title: "Social media strategy.", subtitle: "Turn social into sales" },
      { title: "Business growth.", subtitle: "Scale your business" },
    ],
  },
];

// ============================================================================
// RESOURCES FLOATER COMPONENT
// ============================================================================

/**
 * Resources mega menu component
 * 
 * @returns {JSX.Element} The resources menu interface
 */
export default function Resources() {
  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  
  /**
   * Renders a single resource section
   * @param {Object} section - Section data
   * @param {number} index - Section index
   * @returns {JSX.Element} Section element with spacing
   */
  const renderSection = (section, index) => (
    <React.Fragment key={section.id}>
      {/* Add spacing between sections */}
      {index > 0 && (
        <>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        </>
      )}

      <section>
        {/* Section Header */}
        <h5>
          <span>
            <img
              src={section.icon.src}
              style={{ height: "30px", width: "30px" }}
              alt={section.title}
            />
          </span>
          &nbsp;&nbsp;
          <span>{section.title}</span>
        </h5>

        <hr />

        {/* Section Items */}
        <ul>
          {section.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <h6>{item.title}</h6>
              <small>{item.subtitle}</small>
            </li>
          ))}
        </ul>
      </section>
    </React.Fragment>
  );

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="resources-floater-overlay">
      <div className="resources-floater">
        {RESOURCE_SECTIONS.map(renderSection)}
      </div>
    </div>
  );
}
