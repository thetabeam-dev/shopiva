/**
 * Customer Free Layout Component
 * 
 * Public layout for unauthenticated customer pages.
 * Includes header with navigation, main content area, and footer.
 * 
 * @module layouts/Customer/Free
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

// ============================================================================
// CUSTOMER FREE LAYOUT COMPONENT
// ============================================================================

/**
 * Public layout for customer-facing pages
 * 
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 * @returns {JSX.Element} The free customer layout
 */
export default function CustomerFreeLayout({ children }) {
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
   * Renders the desktop navigation menu
   */
  const renderDesktopNav = () => (
    <section style={{ margin: "0px 0px 0px 0px" }}>
      <ul>
        <li onClick={() => {
          setResourcesMenu(false);
          setSolutionMenu(!solutionMenu);
        }}>
          Home
        </li>
        
        <li onClick={() => {
          setSolutionMenu(false);
          setResourcesMenu(!resourcesMenu);
        }}>
          Contacts
        </li>

        <li onClick={() => window.open("/entrepreneur/ng/pricing")}>
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
          id="header-logo-cnt"
          style={{
            flexDirection: "row",
            width: "fit-content",
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          &nbsp;
          <h3 style={{ color: "rgba(0, 146, 110, 1)", fontWeight: "1000" }}>
            Deedyte
          </h3>
        </section>

        {/* Desktop Navigation */}
        {screenWidth > DESKTOP_NAV_BREAKPOINT && renderDesktopNav()}

        {/* Auth Buttons */}
        <section style={{ margin: "0px 25px 0px 0px" }}>
          <ul>
            {loggedIn && (
              <li onClick={() => window.open("/entrepreneur/ng")}>Log in</li>
            )}
            <li onClick={() => window.open("/entrepreneur/ng")}>
              Become A Vendor
            </li>
          </ul>
        </section>

        {/* Mobile Menu Button */}
        {screenWidth < MOBILE_MENU_BREAKPOINT && renderMobileMenuButton()}
      </div>

      {/* Main Content */}
      <main style={{ overflow: "auto", height: "auto", position: "relative" }}>
        {children}
      </main>

      {/* Footer */}
      <footer>
        <section></section>

        <section>
          {/* Logo and Contact */}
          <div
            style={{
              flexDirection: "column",
              display: "flex",
              alignItems: "flex-start",
              height: "100%",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "flex-end",
              }}
            >
              <img
                src={logo_img.src}
                style={{ height: "100px", width: "100px", borderRadius: "10px" }}
                alt="Deedyte logo"
              />
            </div>
            <br />
            <div>
              <h6 style={{ margin: "0" }}>deedyte@deedyte.net</h6>
            </div>
          </div>

          {/* Support Links */}
          <div>
            <h6 style={{ fontSize: "4vh" }}>Support</h6>
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
