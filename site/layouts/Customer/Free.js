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

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import Select from "react-select";
import {
  useVendorLocationFilter,
  VendorLocationFilterProvider,
} from "./vendorLocationFilterContext";

// Styles
import "../../app/entrepreneur/[id]/global.css";
import "../../app/styles/s.css";
import "../../app/styles/m.css";
import "../../app/styles/l.css";
import "../../app/styles/xl.css";
import "../../app/styles/xxl.css";


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
function LocationIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M12 13.5C13.933 13.5 15.5 11.933 15.5 10C15.5 8.067 13.933 6.5 12 6.5C10.067 6.5 8.5 8.067 8.5 10C8.5 11.933 10.067 13.5 12 13.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 21C15.8 17.8 18.5 14.4 18.5 10.3C18.5 6.7 15.6 4 12 4C8.4 4 5.5 6.7 5.5 10.3C5.5 14.4 8.2 17.8 12 21Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CustomerFreeLayout({ children }) {
  // ============================================================================
  // HOOKS & STATE
  // ============================================================================

  const pathname = usePathname();
  const locationFilter = useVendorLocationFilter();
  const { entrepreneur_id } = useSelector((state) => state.entrepreneur_id);

  // UI State
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuActive, setMenuActive] = useState(false);
  const [solutionMenu, setSolutionMenu] = useState(false);
  const [resourcesMenu, setResourcesMenu] = useState(false);
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [screenWidth, setScreenWidth] = useState(0);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  const layoutRef = useRef(null);
  const headerRef = useRef(null);

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

  // Match page chrome to footer; lock scroll to the Free layout shell
  useEffect(() => {
    const prevHtmlBg = document.documentElement.style.background;
    const prevBodyBg = document.body.style.background;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.background = "#003c2d";
    document.body.style.background = "#003c2d";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.background = prevHtmlBg;
      document.body.style.background = prevBodyBg;
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  /**
   * Solid white header after the hero leaves the top of the Free layout scroller.
   */
  useEffect(() => {
    const layout = layoutRef.current;
    const header = headerRef.current;
    if (!layout || !header) return;

    let frameId = 0;

    const syncHeader = () => {
      const hero = layout.querySelector(".hero-section");
      let pastHero = true;

      if (hero) {
        pastHero = hero.getBoundingClientRect().bottom <= header.offsetHeight + 1;
      } else {
        pastHero = layout.scrollTop > 8;
      }

      setHeaderScrolled(pastHero);
    };

    const onScroll = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(syncHeader);
    };

    syncHeader();
    layout.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    let observer = null;
    const hero = layout.querySelector(".hero-section");
    if (hero && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        ([entry]) => {
          setHeaderScrolled(!entry.isIntersecting);
        },
        {
          root: layout,
          threshold: 0,
          rootMargin: `-${Math.max(header.offsetHeight, 60)}px 0px 0px 0px`,
        }
      );
      observer.observe(hero);
    }

    return () => {
      cancelAnimationFrame(frameId);
      layout.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (observer) observer.disconnect();
    };
  }, [pathname]);

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

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div ref={layoutRef} className="customer-free-layout">
      {/* Header */}
      <div
        ref={headerRef}
        className={`header${headerScrolled ? " header--scrolled" : ""}`}
      >
        {/* Logo Section */}
        <section id="header-logo-cnt">
          &nbsp;
          <img className="inscription" src={logo_img.src} alt="" />
          {/* <h3>DeeDyte</h3> */}
        </section>

        {/* Desktop Navigation */}
        {screenWidth > DESKTOP_NAV_BREAKPOINT && pathname === "/" && renderDesktopNav()}

        {/* Auth Buttons */}
        {
          pathname === "/" &&
          <section className="header-auth">
            <ul>
              <li onClick={() => window.open("/entrepreneur/ng")}>
                Become A Vendor
              </li>
            </ul>
          </section>
        }

        {/* Mobile Menu Button */}
        {screenWidth < MOBILE_MENU_BREAKPOINT && pathname === "/" && renderMobileMenuButton()}

        {pathname.startsWith("/vendors") && locationFilter ? (
          <div className="customer-vendor-page-locale-filter" style={{
            marginRight: screenWidth > DESKTOP_NAV_BREAKPOINT ? "25px" : "10px"
          }}>
            <button
              type="button"
              className="customer-vendor-page-locale-filter__mobile-btn"
              onClick={() => locationFilter.setIsLocationSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={locationFilter.isLocationSheetOpen}
              aria-label={
                locationFilter.selectedState
                  ? `Change location: ${locationFilter.selectedState.label}`
                  : "Select location"
              }
            >
              <LocationIcon />
            </button>
            <div className="customer-vendor-page-locale-filter__desktop-select">
              <Select
                inputId="customer-vendors-state"
                instanceId="customer-vendors-state"
                options={locationFilter.stateSelectOptions}
                value={locationFilter.selectedState}
                onChange={locationFilter.onChange}
                placeholder="Select location"
                isClearable
                isSearchable
                formatOptionLabel={locationFilter.formatStateOptionLabel}
                getOptionValue={(o) => o.value}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Main Content */}
      <main className="customer-free-main">
        {children}
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <section className="footer-banner" aria-hidden="true" />

        <section className="footer-main">
          {/* Logo and Contact */}
          <div className="footer-brand">
            <div className="footer-logo-row">
              <img
                className="footer-logo"
                src={logo_img.src}
                alt="Deedyte logo"
              />
            </div>
            <span className="footer-contact-spacer" aria-hidden="true" />
            <div>
              <h6 className="footer-contact">admin@deedyte.com</h6>
            </div>
          </div>

          {/* Support & Legal Links */}
          <div className="footer-column">
            <h6 className="footer-heading">Support</h6>
            <ul className="footer-links">
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/contact")}
              >
                Contact
              </li>
              <li
                className="footer-link"
                onClick={() => (window.location.href = "/about")}
              >
                About
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
    </div>
  );
}

export default function CustomerFreeLayoutRoot({ children }) {
  return (
    <VendorLocationFilterProvider>
      <CustomerFreeLayout>{children}</CustomerFreeLayout>
    </VendorLocationFilterProvider>
  );
}
