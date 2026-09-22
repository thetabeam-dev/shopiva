/**
 * Solution Floater Component
 * 
 * Displays solution categories and features in a mega menu.
 * Shows Start, Sell, Market, and Manage sections.
 * 
 * @module components/floaters/Solution
 */

import React from "react";
import start_svg from "../../svgs/security-protection-shield-start-svgrepo-com.svg";
import sell_svg from "../../svgs/coin-vector-svgrepo-com.svg";
import market_svg from "../../svgs/market-stand-svgrepo-com.svg";
import manage_svg from "../../svgs/package-alt-svgrepo-com.svg";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Solution menu sections with their items
 */
const SOLUTION_SECTIONS = [
  {
    id: "start",
    title: "Start",
    icon: start_svg,
    items: [
      { title: "Start your business.", subtitle: "Build your brand" },
      { title: "Create your website.", subtitle: "Online store editor" },
      { title: "Customize your store.", subtitle: "Store themes" },
      { title: "Explore free business tools.", subtitle: "Tools to run your business" },
    ],
  },
  {
    id: "sell",
    title: "Sell",
    icon: sell_svg,
    items: [
      { title: "Sell your products.", subtitle: "Sell online or in person" },
      { title: "Sell online.", subtitle: "Grow your business online" },
      { title: "Sell across channels.", subtitle: "Reach millions of shoppers and boost sales" },
      { title: "Sell in person.", subtitle: "Point of Sale (POS)" },
      { title: "Sell globally.", subtitle: "International sales" },
      { title: "Sell wholesale & direct.", subtitle: "Business-to-business (B2B)" },
    ],
  },
  {
    id: "market",
    title: "Market",
    icon: market_svg,
    items: [
      { title: "Market your business.", subtitle: "Reach & retain customers" },
      { title: "Market across social.", subtitle: "Social media integrations" },
      { title: "Chat with customers.", subtitle: "Deedyte Inbox" },
      { title: "Nurture customers.", subtitle: "Deedyte Email" },
      { title: "Know your audience.", subtitle: "Gain customer insights" },
    ],
  },
  {
    id: "manage",
    title: "Manage",
    icon: manage_svg,
    items: [
      { title: "Manage your business.", subtitle: "Track sales, orders & analytics" },
      { title: "Measure your performance.", subtitle: "Analytics and Reporting" },
      { title: "Manage your stock & orders.", subtitle: "Inventory & order management" },
      { title: "Automate your business.", subtitle: "Deedyte Flow" },
    ],
  },
];

// ============================================================================
// SOLUTION FLOATER COMPONENT
// ============================================================================

/**
 * Solution mega menu component
 * 
 * @returns {JSX.Element} The solution menu interface
 */
export default function Solution() {
  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  
  /**
   * Renders a single solution section
   * @param {Object} section - Section data
   * @returns {JSX.Element} Section element
   */
  const renderSection = (section) => (
    <section key={section.id}>
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
        {section.items.map((item, index) => (
          <li key={index}>
            <h6>{item.title}</h6>
            <small>{item.subtitle}</small>
          </li>
        ))}
      </ul>
    </section>
  );

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="solution-floater-overlay">
      <div className="solution-floater">
        {SOLUTION_SECTIONS.map(renderSection)}
      </div>
    </div>
  );
}
