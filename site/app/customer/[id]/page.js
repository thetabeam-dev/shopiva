/**
 * Customer Dashboard Landing Page
 * 
 * Main landing page for the customer section.
 * Showcases app features and benefits.
 * 
 * @module app/customer/[id]/page
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
import Inventory from "../../../images/warehouse-storage-shelves-with-cardboard-boxes.jpg";
import Bank from "../../../images/payday.webp";
import Delivery from "../../../images/safe.webp";
import Fraud from "../../../images/fraud.jpg";

// SVG Icons
import BasketSvg from "../../../svgs/basket.svg";
import PhoneSvg from "../../../svgs/phone.svg";
import BikeSvg from "../../../svgs/bike.svg";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Video source for hero section */
const HERO_VIDEO_SRC = "/customer.mp4";

/** App Store download links */
const APP_STORE_LINKS = {
  ios: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Download_on_the_App_Store_Badge.svg/1200px-Download_on_the_App_Store_Badge.svg.png",
  android:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Google_Play_Store_badge_EN.svg/1200px-Google_Play_Store_badge_EN.svg.png",
};

/** App screenshot URL */
const APP_SCREENSHOT_URL = '';

/**
 * How it works steps
 */
const HOW_IT_WORKS_STEPS = [
  {
    icon: PhoneSvg,
    title: "Download The App",
    summary:
      "Easily download our user-friendly app from your device's app store to get started with seamless ordering.",
  },
  {
    icon: BasketSvg,
    title: "Place An Order",
    summary:
      "Browse through our wide selection of items, add them to your cart, and complete your order with just a few taps.",
  },
  {
    icon: BikeSvg,
    title: "Get It Instantly",
    summary:
      "Sit back and relax as your delivery reaches straight to your door in no time.",
  },
];

/**
 * Why Deedyte features
 */
const WHY_DEEDYTE_FEATURES = [
  {
    image: Bank,
    title: "Secure Payment Processing",
    summary:
      "Enjoy total peace of mind with every purchase. We use bank-level encryption, secure payment gateways like PayStack and FlutterWave, and advanced tokenization to protect your card details. Your financial information is never stored on our servers, ensuring rock-solid security and complete privacy for every transaction.",
  },
  {
    image: Inventory,
    title: "Instant Access to Local Inventory",
    summary:
      "Skip long shipping waits and discover what's available right in your neighborhood. Our smart geolocation technology instantly shows you real-time stock from nearby sellers and stores. Browse fresh, local products, compare prices quickly, and find exactly what you need without endless searching.",
  },
  {
    image: Delivery,
    title: "Guaranteed Delivery Safeguards",
    summary:
      "From the moment you place your order, we've got you covered. Enjoy end-to-end tracking, full delivery insurance, and protection against loss or damage. If anything goes wrong—late delivery, damaged items, or missing packages—we'll handle replacements or full refunds quickly and without hassle.",
  },
  {
    image: Fraud,
    title: "Zero-Tolerance Fraud Prevention",
    summary:
      "Shop confidently knowing we actively fight fraud on your behalf. Our AI-powered system monitors every transaction in real-time, while all sellers go through strict identity and business verification. Buyer reviews, secure escrow options, and counterfeit detection keep scams and fake products completely out of your shopping experience.",
  },
];

// ============================================================================
// DASHBOARD COMPONENT
// ============================================================================

/**
 * Customer dashboard page component
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

      if (topSpace <= -762) {
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

  /**
   * Renders a why-deedyte feature card
   * @param {Object} feature - Feature data
   * @param {number} index - Feature index
   * @returns {JSX.Element} Feature card
   */
  const renderWhyFeature = (feature, index) => (
    <div key={index} className="card" id="why-card" style={{ border: "none" }}>
      <img src={feature.image.src} alt={feature.title} />
      <div className="content">
        <div className="title">{feature.title}</div>
        <div className="summary">{feature.summary}</div>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return ( 
    <>
      {/* Hero Section */}
      <section className="hero-section">
        {/* Video Background */}
        <div className="video-bg">
          <video
            autoPlay
            loop
            muted
            playsInline
            src={HERO_VIDEO_SRC}
            style={{
              height: "100vh",
              width: "100%",
              objectFit: "cover",
            }}
          >
            <source src={HERO_VIDEO_SRC} type="video/mp4" />
          </video>
        </div>

        {/* Phone Emulator */}
        <div className="hero-right">
          <div className="emulator-frame">
            <div className="emulator-screen">
              <img
                src={APP_SCREENSHOT_URL}
                alt="App Screenshot"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "22px",
                }}
              />
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div className="hero-left">
          <div className="hero-info">
            <h2>Delivery straight to your doorstep — within minutes.</h2>

            <div>
              <p className="theme">
                Deedyte is your pocket mall! Whether you are unready to shop in
                physical stores, use Deedyte to order from the closest vendor at
                your locations and get delivery at your doorstep in minutes.
              </p>

              {/* Order Button */}
              <div className="order_btn">
                <button>Order Now</button>
              </div>

              {/* Download Buttons */}
              <div className="download_btn">
                <button>
                  <img
                    src={APP_STORE_LINKS.ios}
                    alt="App Store"
                    style={{ height: "100%", width: "100%" }}
                  />
                </button>
                <button>
                  <img
                    src={APP_STORE_LINKS.android}
                    alt="Google Play"
                    style={{ height: "100%", width: "100%" }}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="about">
        <h1>How Deedyte Works</h1>
        <div className="about-card-cnt">
          {HOW_IT_WORKS_STEPS.map(renderHowItWorksStep)}
        </div>
      </section>

      {/* Why Deedyte Section */}
      <section id="why-section">
        <h1>Why Deedyte?</h1>
        <div className="why-cnt">
          {WHY_DEEDYTE_FEATURES.map(renderWhyFeature)}
        </div>
      </section>
    </>
  );
}
