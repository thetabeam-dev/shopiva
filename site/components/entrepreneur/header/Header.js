/**
 * Header Component
 * 
 * Main header for the entrepreneur dashboard.
 * Contains logo, search bar, notifications, and profile menu.
 * 
 * @module components/entrepreneur/header/Header
 */

import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import "./style.css";

// Assets
import bell_svg from "../../../svgs/notification-svgrepo-com (3).svg";
import logo from "../../../images/Deedyte.png"
// Utilities
import { handleFloater } from "../../../reusables/anitmation";

// Redux Actions
import { set_floater_src } from "../../../redux/entrepreneur/floater_src";

// ============================================================================
// CONSTANTS
// ============================================================================

// ============================================================================
// HEADER COMPONENT
// ============================================================================

/**
 * Dashboard header component
 * 
 * @returns {JSX.Element} The header interface
 */
export default function Header() {
  // ============================================================================
  // HOOKS & STATE
  // ============================================================================
  
  const dispatch = useDispatch();

  // Redux state
  const { floater_src } = useSelector((state) => state.floater_src);

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  // Set screen width and header height on mount
  useEffect(() => {
    const headerElement = document.body.querySelector("header");
    if (headerElement) {
      headerElement.style.height = "100%";
    }
  }, []);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  /**
   * Handles search input focus
   * Opens the search floater
   */
  const handleSearchFocus = (e) => {
    dispatch(set_floater_src("search"));
    
    const position = e.currentTarget.parentElement.getBoundingClientRect();
    const { left, top } = position;
    
    handleFloater("search", { left, top });
  };

  /**
   * Handles notification button click
   */
  const handleNotificationClick = () => {
    dispatch(set_floater_src("notification"));
    handleFloater("notification");
  };

  /**
   * Handles profile button click
   */
  const handleProfileClick = () => {
    dispatch(set_floater_src("profile"));
    handleFloater("profile");
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  const { shop: entrepreneurShop } = useSelector((state) => state.entrepreneur_shop);
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0px 10px",
        background: "#000"
      }}
    >
      <section style={{
        display: "flex"
      }}>
        <img src={logo.src} style={{
          height: "28px",
          width: "28px"
        }} alt="" />
        &nbsp;
        {/* &nbsp; */}
        {/* <h5 style={{margin: "0px"}}>Deedyte</h5> */}
      </section>

      {/* Search Section */}
      {/* <section className="header-section">
        <input
          type="search"
          name="search"
          placeholder="Search"
          onFocus={handleSearchFocus}
          id="header-search"
        />
      </section> */}

      {/* Actions Section */}
      <section className="header-section">
        {/* Notification Button */}
        {/* <button onClick={handleNotificationClick} style={{background: "#000"}}>
          <img
            src={bell_svg.src}
            style={{ height: "20px", width: "20px" }}
            alt="Notifications"
          />
        </button> */}

        &nbsp;&nbsp;

        {/* Profile Button */}
        <button onClick={handleProfileClick} style={{background: "#000"}}>
          <div
            style={{
              background: "#07d300",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "auto",
              width: "auto",
              padding: "5px",
              borderRadius: "5px",
              fontSize: "x-small",
            }}
          >
            {(entrepreneurShop?.name ?? "")
              .split("")
              .slice(0, 2)
              .join("")
              .toUpperCase() || "—"}
          </div>
          &nbsp;
          <div
            style={{
              alignItems: "center",
              justifyContent: "center",
              height: "auto",
              width: "auto",
              padding: "5px",
              borderRadius: "5px",
            }}
          >
            {entrepreneurShop?.name}
          </div>
        </button>
      </section>
    </header>
  );
}
