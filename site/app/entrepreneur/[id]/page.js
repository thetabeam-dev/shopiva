/**
 * Entrepreneur Dashboard Landing Page
 * 
 * Main landing page for the entrepreneur section.
 * Showcases features and benefits of the platform.
 * 
 * @module app/entrepreneur/[id]/page
 */

"use client";

import React, { useEffect } from "react";

// Styles
import "./global.css";
import "./styles/s.css";
import "./styles/m.css";
import "./styles/l.css";
import "./styles/xl.css";
import "./styles/xxl.css";

// Images
import shop_img3 from "../../../images/Online-Shop_12.webp";
import shop_img2 from "../../../images/Online-Shop_e8.webp";
import shop_img1 from "../../../images/Online-Shop_n7.webp";

// SVG Icons
import InventorySvg from "../../../svgs/list.svg";
import PhoneSvg from "../../../svgs/phone.svg";
import EarnSvg from "../../../svgs/earn.svg";

// ============================================================================
// RENDER HELPERS
// ============================================================================

/**
 * Renders a how-it-works step card
 * @param {Object} step - Step data
 * @param {number} index - Step index
 * @returns {JSX.Element} Step card
 */
const renderHowItWorksStep = (step, index) => (
  <div key={index} className="card about-card" style={{ border: "none" }}>
    <img src={step.icon.src} alt={step.title} />
    <div className="content">
      <div className="title">{step.title}</div>
      <div className="summary">{step.summary}</div>
    </div>
  </div>
);


// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Feature cards data
 */
const FEATURE_CARDS = [
  {
    image: shop_img1,
    title: "Seamless Product Listing Management",
    description:
      "Simplified product management tools allow sellers to easily add, edit, and manage their inventory without technical expertise.",
  },
  {
    image: shop_img2,
    title: "Effortless Order and Payment Tracking",
    description:
      "A streamlined dashboard which provides an intuitive overview of order status, shipping progress, and payment transactions.",
  },
  {
    image: shop_img3,
    title: "Quick Access to Support and Resources",
    description:
      "Entrepreneurs have instant access to customer support and business resources via an easy-to-navigate help center.",
  },
];

/**
 * How it works steps
 */
const HOW_IT_WORKS_STEPS = [
  {
    icon: PhoneSvg,
    title: "Get the App",
    summary:
      "Download DeeDyte and complete quick account and identity verification to open your vendor dashboard.",
  },

  {
    icon: InventorySvg,
    title: "Add Your Offers",
    summary:
      "Upload new products, set prices, stock, and location so nearby buyers can find your business instantly.",
  },

  {
    icon: EarnSvg,
    title: "Fulfill & Earn",
    summary:
      "Receive buyer orders, deliver or ship through escrow protection, and get paid immediately after confirmation.",
  },
];



/**
 * Crypto payment benefits
 */
const CRYPTO_BENEFITS = [
  {
    tagline: "Receive your payment with no hassle",
    title: "Secured and Fast",
    description:
      "Accepting payments in cryptocurrency allows businesses to reach a broader, global audience. Since cryptocurrencies operate without the need for traditional banking systems, customers from regions with limited banking access can easily participate in transactions, increasing market reach.",
  },
  {
    tagline: "Enjoy cross-border transaction with less fees",
    title: "Low Transaction Fees",
    description:
      "Accepting payments in cryptocurrency allows businesses to reach a broader, global audience. Since cryptocurrencies operate without the need for traditional banking systems, customers from regions with limited banking access can easily participate in transactions, increasing market reach.",
  },
];

// ============================================================================
// DASHBOARD COMPONENT
// ============================================================================

/**
 * Main dashboard page component
 * 
 * @returns {JSX.Element} The dashboard page
 */
export default function Dashboard() {
  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Handles header background change on scroll
   */
  useEffect(() => {
    const handleScroll = () => {
      const mainElem = document.querySelector("main");
      const headerElem = document.querySelector(".header");

      if (!mainElem || !headerElem) return;

      const topSpace = mainElem.getBoundingClientRect().top;

      if (topSpace <= 60) {
        headerElem.style.background = "#fff";
        headerElem.classList.add("shadow-sm");
      } else {
        headerElem.style.background = "transparent";
        headerElem.classList.remove("shadow-sm");
      }
    };

    document.body.addEventListener("scroll", handleScroll);

    return () => {
      document.body.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  /**
   * Renders a feature card
   */
  const renderFeatureCard = (feature, index) => (
    <li key={index} style={{ padding: "10px" }}>
      <div>
        <img
          src={feature.image.src}
          style={{ height: "160px", width: "100%", borderRadius: "10px" }}
          alt={feature.title}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", height: "350px" }}>
        <div style={{ height: "auto" }}>
          <h5 style={{ width: "100%", color: "#00926E", textAlign: "left" }}>
            {feature.title}
          </h5>
        </div>
        <div style={{ height: "auto" }}>
          <p style={{ color: "#00926E", textAlign: "left" }}>
            {feature.description}
          </p>
        </div>
      </div>
    </li>
  );

  /**
   * Renders a crypto benefit card
   */
  const renderCryptoBenefit = (benefit, index) => (
    <li
      key={index}
      id="crypto-list"
      style={{
        alignItems: "flex-start",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        color: "#00926e",
      }}
    >
      <div
        style={{
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          alignItems: "flex-start",
        }}
      >
        {/* <p style={{ color: "#fff", fontWeight: "bold", fontSize: "large" }}>
          {benefit.tagline}
        </p> */}
        <h6
          style={{
            width: "fit-content",
            fontWeight: "bold",
            color: "#00926e",
            fontSize: "3.5vh",
          }}
        >
          {benefit.title}
        </h6>
      </div>

      <div style={{ pointerEvents: "none" }}>
        <p style={{ color: "#00926e", fontSize: "17px", padding: "0px 10px" }}>
          {benefit.description}
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>
          <button>Watch now</button>
        </span>
        <span>
          <u style={{ color: "#00926e" }}>Learn More</u>
        </span>
      </div>
    </li>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* Main Content Section */}
      <div
        className="dashboard-body"
        style={{ background: "#fff", borderRadius: "0px", padding: "0" }}
      >
        {/* Hero Section */}
        <div>
          <section
            id="section"
            style={{
              display: "flex",
              justifyContent: "center",
              width: "100%",
              flexDirection: "row",
              alignItems: "flex-end",
              fontWeight: "100",
            }}
          >
            <h2
              id="headline"
              style={{
                fontWeight: "400",
                zIndex: "2000",
                color: "#00926E",
                textAlign: "center",
                textTransform: "capitalize",
              }}
            >
              For everyone from
              <br />
              entrepreneurs to enterprise
            </h2>
          </section>

          {/* Feature Cards */}
          <section style={{ background: "#fff" }}>
            <ul style={{ padding: "0" }}>
              {FEATURE_CARDS.map(renderFeatureCard)}
            </ul>
          </section>

          {/* CTA Button */}
          <section style={{ background: "#fff" }}>
            <button
              style={{
                border: "1px solid #00926E",
                color: "#00926E",
                padding: "5px 20px",
                background: "#fff",
                borderRadius: "20px",
                fontSize: "medium",
              }}
            >
              Pick a plan that fits
            </button>
          </section>
        </div>

        <br />
        <br />

        {/* Global Sales Section */}
        <section id="about">
          <h1>Sell To Buyers From Anywhere</h1>
          {/* How It Works Section */}
          <div className="about-card-cnt">
            {HOW_IT_WORKS_STEPS.map(renderHowItWorksStep)}
          </div>
        </section>

        {/* Crypto Payments Section */}
          <section className="payment-cnt">

            <h2
              id="headline"
              style={{
                // fontWeight: "800",
                zIndex: "2000",
                color: "#00926e",
                textAlign: "center",
                width: "100%",
                // margin: "0",
                textTransform: "capitalize",
                fontSize: "5vh",
              }}
            >
              Receive Payments Seamlessly
              <br />and Securely With Flexible Cash Options.
            </h2>

            <br />
            <br />

            <ul
              className="payment-list-cnt"
              style={{ background: "transparent", padding: "0" }}
            >
              {CRYPTO_BENEFITS.map(renderCryptoBenefit)}
            </ul>
          </section>
          

          <br />
          <br />
          <br />
          <br />
    
      </div>

      {/* Conclusion Section */}
      <div
        className="dashboard-conclusion"
        style={{ overflow: "hidden", marginTop: "-60px", borderRadius: "0px" }}
      >
        <div>
          <section
            id="section"
            style={{
              display: "flex",
              justifyContent: "center",
              width: "100%",
              flexDirection: "row",
              alignItems: "flex-end",
              fontWeight: "100",
              position: "relative",
            }}
          >
            <h2
              id="headline"
              style={{ fontWeight: "500", zIndex: "2000", color: "#fff" }}
            >
              It&apos;s easy to start selling
            </h2>
          </section>

          <br />


          <div
            className="tutorial-cnt"
            style={{
              padding: "0",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "left",
                padding: "20px",
              }}
            >
              <ol>
                <li
                  className="conclude-list"
                  style={{
                    cursor: "pointer",
                    marginBottom: "20px",
                    color: "#fff",
                    fontWeight: "300",
                    borderBottom: "1px solid #fff",
                    padding: "5px 0px",
                  }}
                >
                  Add your first product
                </li>
                <li
                  className="conclude-list"
                  style={{
                    cursor: "pointer",
                    marginBottom: "20px",
                    color: "#fff",
                    fontWeight: "300",
                    borderBottom: "1px solid #fff",
                    padding: "5px 0px",
                  }}
                >
                  Customize your store
                </li>
                <li
                  className="conclude-list"
                  style={{
                    cursor: "pointer",
                    marginBottom: "20px",
                    color: "#fff",
                    fontWeight: "300",
                    borderBottom: "1px solid #fff",
                    padding: "5px 0px",
                  }}
                >
                  Set up payments
                </li>

                <br />
                <br />
                <br />

                <button
                  type="button"
                  onClick={() => { window.location.href = "/auth/login?role=entrepreneur"; }}
                  style={{
                    background: "#fff",
                    color: "#00926E",
                    padding: "20px",
                    borderRadius: "15px",
                    cursor: "pointer",
                    border: "none",
                  }}
                >
                  <b>Take Your Shot</b>
                </button>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
