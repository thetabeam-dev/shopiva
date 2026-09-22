/**
 * Entrepreneur Free Layout Component
 * 
 * Public layout for entrepreneur landing and marketing pages.
 * Includes header with navigation, hero section, main content, and footer.
 * 
 * @module layouts/Entrepreneur/Free
 */

"use client";

// ============================================================================
// IMPORTS
// ============================================================================

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";

// Styles
import "../../app/entrepreneur/[id]/global.css";
import "../../app/entrepreneur/[id]/styles/xxl.css";

// Assets
import menu_img from "../../svgs/menu-alt-2-svgrepo-com.svg";
import close_img from "../../svgs/close-square-svgrepo-com.svg";
import logo_img from "../../images/Deedyte.png";
import bitcoin_svg from "../../svgs/coin-vector-svgrepo-com.svg";
import ui_svg from "../../svgs/interface-ui-check-box-checkbox-todo-list-svgrepo-com.svg";
import globe_svg from "../../svgs/global-svgrepo-com.svg";
import connect_svg from "../../svgs/target-audience-svgrepo-com.svg";

// Components
import Solution from "../../components/floaters.js/Solution";
import Resources from "../../components/floaters.js/Resources";
import MenuComp from "../../components/floaters.js/Menu";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Breakpoint for showing desktop navigation */
const DESKTOP_NAV_BREAKPOINT = 560;

/** Breakpoint for showing mobile menu */
const MOBILE_MENU_BREAKPOINT = 480;

/** Rotating headline messages */
const HEADLINE_MESSAGES = [
  "Get Your Store Global",
  "Get Your Brand Popular",
  "Get Your Business To The Next Level",
  "Get Your Permanent Customers",
];

/** Headline rotation interval in milliseconds */
const HEADLINE_INTERVAL = 5000;

/** Feature highlights for the summary section */
const FEATURE_HIGHLIGHTS = [
  {
    icon: connect_svg,
    title: "Designed For Smart Vendors",
  },
  {
    icon: globe_svg,
    title: "Reach Buyers Everywhere Quickly",
  },
  {
    icon: bitcoin_svg,
    title: "Payments In Naira Only",
  },
  {
    icon: ui_svg,
    title: "Simple Dashboard Easy Control",
  }
  
];

// ============================================================================
// ENTREPRENEUR FREE LAYOUT COMPONENT
// ============================================================================

/**
 * Public layout for entrepreneur-facing marketing pages
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 * @returns {JSX.Element} The free entrepreneur layout
 */
export default function EntrepreneurFreeLayout({ children }) {
  // ============================================================================
  // HOOKS & STATE
  // ============================================================================
  
  const pathname = usePathname();
  const { entrepreneur_id } = useSelector((state) => state.entrepreneur_id);

  // UI State
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuActive, setMenuActive] = useState(false);
  const [solutionMenu, setSolutionMenu] = useState(false);
  const [resourcesMenu, setResourcesMenu] = useState(false);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [screenWidth, setScreenWidth] = useState(0);

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  // Update logged in state based on entrepreneur ID
  useEffect(() => {
    setLoggedIn(entrepreneur_id !== null);
  }, [entrepreneur_id]);

  // Rotate headline messages
  useEffect(() => {
    const intervalId = setInterval(() => {
      setHeadlineIndex((prev) => (prev + 1) % HEADLINE_MESSAGES.length);
    }, HEADLINE_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  // Set screen width on mount
  useEffect(() => {
    setScreenWidth(window.innerWidth);
  }, []);

  // Set body styles on mount
  useEffect(() => {
    document.body.style.background = "#fff";
    
    const mainElement = document.body.querySelector("main");
    if (mainElement) {
      mainElement.style.background = "#fff";
    }
  }, []);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  /**
   * Handles menu toggle for mobile
   */
  const handleMenu = () => {
    if (solutionMenu) {
      setSolutionMenu(false);
    } else if (resourcesMenu) {
      setResourcesMenu(false);
    } else {
      setMenuActive(!menuActive);
    }
  };

  /**
   * Updates click option for dropdown menus
   * @param {string} option - The option clicked ('solutions' | 'resources')
   */
  const updateClickOpt = (option) => {
    if (option === "solutions") {
      setResourcesMenu(false);
      setSolutionMenu(!solutionMenu);
    } else {
      setSolutionMenu(false);
      setResourcesMenu(!resourcesMenu);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  
  /**
   * Checks if current page is the landing page
   */
  const isLandingPage = () => {
    const pathParts = pathname.split("/");
    return (
      pathParts.splice(0, 3)[2]?.length === 2 &&
      pathname.split("/").splice(-1)[0]?.length === 2
    );
  };

  /**
   * Renders the desktop navigation menu
   */
  const renderDesktopNav = () => (
    <section>
      <ul>
        <li onClick={() => {
          setResourcesMenu(false);
          setSolutionMenu(!solutionMenu);
        }}>
          Solutions
        </li>
        
        <li onClick={() => {
          setSolutionMenu(false);
          setResourcesMenu(!resourcesMenu);
        }}>
          Resources
        </li>

        {/* <li onClick={() => window.open("/entrepreneur/ng/pricing")}>
          Pricing
        </li> */}
      </ul>
    </section>
  );

  /**
   * Renders the mobile menu button
   */
  const renderMobileMenuButton = () => (
    <section style={{ marginRight: "10px" }} onClick={handleMenu}>
      <img
        src={menuActive ? close_img.src : menu_img.src}
        style={{ height: "35px", width: "35px", borderRadius: "10px" }}
        alt="Menu toggle"
      />
    </section>
  );

  /**
   * Renders the hero video section
   */
  const renderHeroSection = () => (
    <div
      className="dashboard-head"
      style={{ position: "absolute", top: "0", left: "0", width: "100%" }}
    >
      <video
        style={{
          height: "100vh",
          width: "100%",
          objectFit: "cover",
          zIndex: "1000",
        }}
        src="https://media-23.b-cdn.net/packaging.mp4"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="/packaging.mp4" type="video/mp4" />
      </video>

      {/* Headline Overlay */}
      <div id="tagline-cnt">
        <h4
          id="interval-text"
          style={{
            fontWeight: "200",
            zIndex: "2000",
            opacity: "1",
            color: "rgba(0, 146, 110, 1)",
          }}
        >
          {HEADLINE_MESSAGES[headlineIndex]}
        </h4>
      </div>

      {/* Tagline */}
      <div id="tagline">
        <h4
          style={{
            fontSize: "2vh",
            fontWeight: "500",
            color: "#fff",
            background: "rgba(0, 146, 110, 1)",
            borderRadius: "15px",
            width: "fit-content",
            padding: "10px",
          }}
        >
          Dream big, build fast, and grow far on Deedyte.
        </h4>
      </div>
    </div>
  );

  /**
   * Renders feature highlights
   */
  const renderFeatureHighlights = () => (
    <div
      className="dashboard-summary"
      style={{
        zIndex: "1000",
        height: "auto",
        borderRadius: "10px 10px 0px 0px",
        overflow: "auto",
      }}
    >
      <ul style={{ width: "100%", overflow: "auto", flexWrap: "nowrap" }}>
        {FEATURE_HIGHLIGHTS.map((feature, index) => (
          <li
            key={index}
            style={{
              display: "flex",
              margin: "0px 10px",
              flexShrink: "0",
              width: "250px",
              flexDirection: "column",
              justifyContent: "space-between",
              alignItems: "flex-start",
              paddingTop: "10px",
            }}
          >
            <div
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                marginLeft: "5px",
                boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
                width: "fit-content",
                borderRadius: "8px",
              }}
            >
              <img
                src={feature.icon.src}
                style={{ height: "50px", width: "50px", borderRadius: "10px" }}
                alt={feature.title}
              />
            </div>
            <div>
              <h4 style={{ color: "#fff", textAlign: "left" }}>
                {feature.title}
              </h4>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <>
      {/* Header */}
      <div
        className="header"
        style={{
          position: "absolute",
          top: "0",
          left: "0",
          zIndex: "10000",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo Section */}
        <section
          id="header-logoo-cnt"
          style={{
            flexDirection: "row",
            width: "fit-content",
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <img
            src={logo_img.src}
            style={{ borderRadius: "10px" }}
            alt="Deedyte logo"
          />
          &nbsp;
        </section>

        {/* Desktop Navigation */}
        {screenWidth > DESKTOP_NAV_BREAKPOINT && renderDesktopNav()}

        {/* Auth Buttons */}
        <section>
          <ul>
            {loggedIn && (
              <li onClick={() => { window.location.href = "/auth/login?role=entrepreneur"; }}>Continue Selling</li>
            )}
            <li onClick={() => { window.location.href = "/auth/login?role=entrepreneur"; }}>Start Selling</li>
            {/* <li onClick={() => { window.location.href = "/auth/login?role=entrepreneur"; }}>Start Free Trial</li> */}
          </ul>
        </section>

        {/* Mobile Menu Button */}
        {screenWidth < MOBILE_MENU_BREAKPOINT && renderMobileMenuButton()}
      </div>

      {/* Hero Section */}
      <header>
        {isLandingPage() && renderHeroSection()}
        {renderFeatureHighlights()}
      </header>

      {/* Dropdown Menus */}
      {solutionMenu && <Solution />}
      {resourcesMenu && <Resources />}
      {menuActive && <MenuComp logged_in={loggedIn} updateClickOpt={updateClickOpt} />}

      {/* Main Content */}
      <main style={{ overflow: "auto", height: "auto", position: "relative" }}>
        {children}
      </main>

      {/* Footer */}
      <footer>
        <section></section>

        <section>
          {/* Logo */}
          <div
            style={{
              flexDirection: "row",
              display: "flex",
              alignItems: "flex-end",
              height: "100%",
            }}
          >
            <img
              src={logo_img.src}
              style={{ height: "50px", width: "50px", borderRadius: "10px" }}
              alt="Deedyte logo"
            />
          </div>

          {/* Deedyte Links */}
          <div>
            <h6>Deedyte</h6>
            <ul>
              <li
                onClick={() => (window.location.href = "/entrepreneur/ng/about")}
                style={{ fontSize: "small" }}
              >
                About
              </li>
              <li
                onClick={() => (window.location.href = "/entrepreneur/ng/investors")}
                style={{ fontSize: "small" }}
              >
                Investors
              </li>
              <li
                onClick={() => (window.location.href = "/entrepreneur/ng/affiliates")}
                style={{ fontSize: "small" }}
              >
                Affiliates
              </li>
            </ul>
          </div>

          {/* Support Links */}
          {/* <div>
            <h6>Support</h6>
            <ul>
              <li
                onClick={() => (window.location.href = "/entrepreneur/ng/")}
                style={{ fontSize: "small" }}
              >
                Help Center
              </li>
              <li
                onClick={() => (window.location.href = "/entrepreneur/ng/deedyte-academy")}
                style={{ fontSize: "small" }}
              >
                Deedyte Academy
              </li>
              <li
                onClick={() => (window.location.href = "/entrepreneur/ng/deedyte-community")}
                style={{ fontSize: "small" }}
              >
                Deedyte Community
              </li>
            </ul>
          </div> */}

          {/* Developer Links */}
          {/* <div>
            <h6>Developers</h6>
            <ul>
              <li
                onClick={() => (window.location.href = "/entrepreneur/ng/deedyte.dev")}
                style={{ fontSize: "small" }}
              >
                Deedyte.dev
              </li>
              <li
                onClick={() => (window.location.href = "/entrepreneur/ng/api-doc")}
                style={{ fontSize: "small" }}
              >
                API Documentation
              </li>
            </ul>
          </div> */}

          {/* Product Links */}
          <div>
            <h6>Products</h6>
            <ul>
              <li
                onClick={() => (window.location.href = "/entrepreneur/ng/shop")}
                style={{ fontSize: "small" }}
              >
                Shop
              </li>
              <li
                onClick={() => (window.location.href = "/entrepreneur/ng/deedyte-plus")}
                style={{ fontSize: "small" }}
              >
                Deedyte Plus
              </li>
            </ul>
          </div>

          {/* Other Links */}
          <div>
            <h6>Others</h6>
            <ul>
              <li
                onClick={() => (window.location.href = "/entrepreneur/ng/sitemap")}
                style={{ fontSize: "small" }}
              >
                Sitemap
              </li>
              <li
                onClick={() => (window.location.href = "/entrepreneur/ng/terms-of-use")}
                style={{ fontSize: "small" }}
              >
                Terms Of Service
              </li>
              <li
                onClick={() => (window.location.href = "/entrepreneur/ng/privacy-policy")}
                style={{ fontSize: "small" }}
              >
                Privacy Policy
              </li>
            </ul>
          </div>
        </section>

        <hr />

        {/* Copyright & Social Links */}
        <section className="copywright">
          <div style={{ height: "50px", alignItems: "center" }}>
            <small>&#169; Copyright {new Date().getFullYear()}</small>
          </div>

          <div style={{ height: "50px" }}>
            <ul style={{ height: "100%", margin: "0", padding: "0" }}>
              <li
                onClick={() =>
                  window.open(
                    "https://www.facebook.com/profile.php?id=61566898641430"
                  )
                }
              >
                <i
                  style={{
                    display: "flex",
                    height: "100%",
                    position: "relative",
                    alignItems: "center",
                  }}
                  className="fa-brands fa-facebook fa-lg"
                ></i>
              </li>
              <li
                onClick={() =>
                  window.open(
                    "https://x.com/Deedyte_shop?t=NgevY7O7ygFe_AW0C-OgSg&s=09"
                  )
                }
              >
                <i
                  style={{
                    display: "flex",
                    height: "100%",
                    position: "relative",
                    alignItems: "center",
                  }}
                  className="fa-brands fa-twitter fa-lg"
                ></i>
              </li>
              <li
                onClick={() =>
                  window.open(
                    "https://whatsapp.com/channel/0029VacobY6LY6d7M19cx90O"
                  )
                }
              >
                <i
                  style={{
                    display: "flex",
                    height: "100%",
                    position: "relative",
                    alignItems: "center",
                  }}
                  className="fa-brands fa-whatsapp fa-lg"
                ></i>
              </li>
              <li
                onClick={() =>
                  window.open("https://youtube.com/@deedyte?si=Euobslo-XoWD0Kqc")
                }
              >
                <i
                  style={{
                    display: "flex",
                    height: "100%",
                    position: "relative",
                    alignItems: "center",
                  }}
                  className="fa-brands fa-youtube fa-lg"
                ></i>
              </li>
            </ul>
          </div>
        </section>
      </footer>
    </>
  );
}
