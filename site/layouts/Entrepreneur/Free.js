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
      {/* <ul>
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

        <li onClick={() => window.open("/entrepreneur/ng/pricing")}>
          Pricing
        </li>
      </ul> */}

      <ul>

        <li onClick={() => {
          // setSolutionMenu(false);
          // setResourcesMenu(!resourcesMenu);
          window.open("/contact")
        }}>
          Contacts
        </li>

        <li onClick={() => window.open("/about")}>
          About
        </li>
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
        src="https://res.cloudinary.com/jh7nqlrd/video/upload/v1791224952/WhatsApp_Video_2026-10-05_at_19.11.49.mp4"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="https://res.cloudinary.com/jh7nqlrd/video/upload/v1791224952/WhatsApp_Video_2026-10-05_at_19.11.49.mp4" type="video/mp4" />
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
      <ul style={{ width: "100%", overflow: "auto", flexWrap: "nowrap",  background: "transparent"}}>
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
          <ul style={{
             background: "transparent"
          }}>
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
      <footer className="site-footer">
        <section className="footer-banner" aria-hidden="true" />

        <section className="footer-main">
          {/* Logo */}
          <div className="footer-brand">
            <div className="footer-logo-row">
              <img
                className="footer-logo"
                src={logo_img.src}
                alt="Deedyte logo"
              />
            </div>
          </div>

          {/* Deedyte Links */}
          <div className="footer-column">
            <h6 className="footer-heading">Deedyte</h6>
            <ul className="footer-links">
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/about")}
              >
                About
              </li>
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/contact")}
              >
                Contact
              </li>
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/entrepreneur/ng/investors")}
              >
                Investors
              </li>
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/entrepreneur/ng/affiliates")}
              >
                Affiliates
              </li>
            </ul>
          </div>

          {/* Support Links */}
          {/* <div className="footer-column">
            <h6 className="footer-heading">Support</h6>
            <ul className="footer-links">
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/entrepreneur/ng/")}
              >
                Help Center
              </li>
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/entrepreneur/ng/deedyte-academy")}
              >
                Deedyte Academy
              </li>
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/entrepreneur/ng/deedyte-community")}
              >
                Deedyte Community
              </li>
            </ul>
          </div> */}

          {/* Developer Links */}
          {/* <div className="footer-column">
            <h6 className="footer-heading">Developers</h6>
            <ul className="footer-links">
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/entrepreneur/ng/deedyte.dev")}
              >
                Deedyte.dev
              </li>
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/entrepreneur/ng/api-doc")}
              >
                API Documentation
              </li>
            </ul>
          </div> */}

          {/* Product Links */}
          <div className="footer-column">
            <h6 className="footer-heading">Products</h6>
            <ul className="footer-links">
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/entrepreneur/ng/shop")}
              >
                Shop
              </li>
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/entrepreneur/ng/deedyte-plus")}
              >
                Deedyte Plus
              </li>
            </ul>
          </div>

          {/* Other Links */}
          <div className="footer-column">
            <h6 className="footer-heading">Others</h6>
            <ul className="footer-links">
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/entrepreneur/ng/sitemap")}
              >
                Sitemap
              </li>
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/terms-of-use")}
              >
                Terms Of Service
              </li>
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/privacy-policy")}
              >
                Privacy Policy
              </li>
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/legal")}
              >
                Legal
              </li>
            </ul>
          </div>
        </section>

        <hr className="footer-divider" />

        {/* Copyright & Social Links */}
        <section className="footer-bottom copywright">
          <div className="footer-copyright">
            <small>&#169; Copyright {new Date().getFullYear()}</small>
          </div>

          <div className="footer-social">
            <ul className="footer-social-list">
              <li
                className="footer-social-item"
                onClick={() =>
                  window.open(
                    "https://www.facebook.com/profile.php?id=61566898641430"
                  )
                }
              >
                <i className="fa-brands fa-facebook fa-lg footer-social-icon" />
              </li>
              <li
                className="footer-social-item"
                onClick={() =>
                  window.open(
                    "https://x.com/Deedyte_shop?t=NgevY7O7ygFe_AW0C-OgSg&s=09"
                  )
                }
              >
                <i className="fa-brands fa-twitter fa-lg footer-social-icon" />
              </li>
              <li
                className="footer-social-item"
                onClick={() =>
                  window.open(
                    "https://whatsapp.com/channel/0029VacobY6LY6d7M19cx90O"
                  )
                }
              >
                <i className="fa-brands fa-whatsapp fa-lg footer-social-icon" />
              </li>
              <li
                className="footer-social-item"
                onClick={() =>
                  window.open("https://youtube.com/@deedyte?si=Euobslo-XoWD0Kqc")
                }
              >
                <i className="fa-brands fa-youtube fa-lg footer-social-icon" />
              </li>
            </ul>
          </div>
        </section>
      </footer>
    </>
  );
}
