/**
 * Customer Dashboard Landing Page
 * 
 * Main landing page for the customer section.
 * Showcases app features and benefits.
 * 
 * @module app/customer/[id]/page
 */

"use client";

import React, { useEffect, useRef } from "react";

// Styles
import "../global.css";
import "./styles/s.css";
import "./styles/m.css";
import "./styles/l.css";
import "./styles/xl.css";
import "./styles/xxl.css";

// Images
import Inventory from "../../images/warehouse-storage-shelves-with-cardboard-boxes.jpg";
import Bank from "../../images/payday.webp";
import Delivery from "../../images/safe.webp";
import Fraud from "../../images/fraud.jpg";
import Screenshot from "../../images/screenshot.png";

// SVG Icons
import BasketSvg from "../../svgs/basket.svg";
import PhoneSvg from "../../svgs/phone.svg";
import BikeSvg from "../../svgs/bike.svg";
import { APP_STORE_URL, PLAY_STORE_URL } from "../../lib/siteNavigation";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Video source for hero section */
const HERO_VIDEO_SRC = "/customer.mp4";

/** App Store download badge images (served from /public/badges) */
const APP_STORE_LINKS = {
  ios: "/svgs/app_store.svg",
  android: "/svgs/play_store.svg",
};

/** App screenshot shown in the hero phone frame */
const APP_SCREENSHOT_URL = Screenshot.src;

/**
 * How it works steps
 */
const HOW_IT_WORKS_STEPS = [
  {
    icon: PhoneSvg,
    title: "Explore DeeDyte",
    summary:
      "Discover products from different vendors, explore their shops, compare options, and find what you need in one convenient marketplace.",
  },
  {
    icon: BasketSvg,
    title: "Connect and Make a Purchase",
    summary:
      "Start a conversation with vendors, ask questions, discuss product details, and place your order with confidence through DeeDyte.",
  },
  {
    icon: BikeSvg,
    title: "Receive Your Order with Confidence",
    summary:
      "Complete your payment through DeeDyte's secure transaction process. Your purchase is supported by escrow protection and dispute resolution to help make every transaction safer.",
  },
];

/**
 * Why DeeDyte features
 */
const WHY_DEEDYTE_FEATURES = [
  {
    image: Bank,
    title: "Protected Transactions",
    summary:
      "Shop with greater confidence knowing your transactions are supported by DeeDyte's escrow payment system. Rather than relying solely on direct payments to vendors, escrow provides an additional layer of protection by holding payment until the agreed transaction conditions are met.",
  },
  {
    image: Inventory,
    title: "Discover Products from Multiple Vendors",
    summary:
      "Find products across different shops in one convenient marketplace. Explore diverse product categories, discover new vendors, compare available options, and connect with sellers without having to navigate multiple platforms.",
  },
  {
    image: Delivery,
    title: "A Better Buying Experience",
    summary:
      "From placing your order to arranging delivery, DeeDyte helps bring buyers and vendors together through a structured transaction process. Keep your purchase organized and know what to expect as your order progresses.",
  },
  {
    image: Fraud,
    title: "Dispute Resolution and Buyer Protection",
    summary:
      "Online transactions should not leave buyers and vendors without support when things go wrong. DeeDyte provides a dispute resolution system designed to help address transaction disagreements, promote accountability, and create a safer environment for everyone doing business on the platform.",
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
  const heroVideoRef = useRef(null);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  /**
   * Mobile Safari often needs muted + playsInline + an explicit play() call.
   * Also retry on first user gesture / tab focus when autoplay is blocked.
   */
  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;

    let cancelled = false;

    const armMutedInline = () => {
      video.muted = true;
      video.defaultMuted = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "true");
      video.playsInline = true;
    };

    const tryPlay = () => {
      if (cancelled || !video.paused) return;
      armMutedInline();
      const playPromise = video.play();
      if (playPromise?.catch) {
        playPromise.catch(() => { });
      }
    };

    armMutedInline();
    tryPlay();

    video.addEventListener("loadedmetadata", tryPlay);
    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    document.addEventListener("touchstart", tryPlay, { passive: true });
    document.addEventListener("click", tryPlay);
    document.addEventListener("visibilitychange", tryPlay);

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", tryPlay);
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      document.removeEventListener("touchstart", tryPlay);
      document.removeEventListener("click", tryPlay);
      document.removeEventListener("visibilitychange", tryPlay);
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
    <div key={index} className="card about-card" id="about-card" style={{ border: "none" }}>
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
            ref={heroVideoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            controls={false}
            disablePictureInPicture
            src={`${HERO_VIDEO_SRC}?v=faststart`}
            aria-hidden
          />
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
              DeeDyte is your trusted online marketplace! Discover products from different vendors, connect with sellers, and shop with confidence. With escrow payment protection and dispute resolution, we make buying and selling online safer, easier, and more reliable for everyone.
              </p>

              {/* Order Button */}
              <div className="order_btn">
                <button onClick={e => window.location.href = "/"}>Order Now</button>
              </div>

              {/* Download Buttons */}
              <div className="download_btn">
                <a
                  href={APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={APP_STORE_LINKS.ios}
                    alt="Download DeeDyte on the App Store"
                  />
                  <b>App Store</b>
                </a>
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={APP_STORE_LINKS.android}
                    alt="Download DeeDyte on Google Play"
                  />
                  <b>Play Store</b>
                </a>
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

      {/* Why DeeDyte Section */}
      <section id="why-section">
        <h1>Why DeeDyte?</h1>
        <div className="why-cnt">
          {WHY_DEEDYTE_FEATURES.map(renderWhyFeature)}
        </div>
      </section>
    </>
  );
}
