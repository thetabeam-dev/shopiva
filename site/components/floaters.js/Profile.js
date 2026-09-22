/**
 * Profile Floater Component
 * 
 * Displays user profile information and quick actions.
 * Appears when clicking on the profile button in the header.
 * 
 * @module components/floaters/Profile
 */

"use client";

import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { reset_entrepreneur_shop } from "../../redux/entrepreneur/entrepreneur_shop";
import { signOut } from "next-auth/react";
import "./style.css";
import shop_svg from "../../svgs/shop-svgrepo-com.svg";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Cookie names for authentication */
const COOKIE_NAMES = {
  entrepreneur: "entrepreneur_secret",
  customer: "customer_secret",
};

/** Cookie expiration (set to past to delete) */
const EXPIRED_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Deletes a cookie by name
 * 
 * @param {string} name - Cookie name to delete
 */
function deleteCookie(name) {
  document.cookie = `${name}=; expires=${EXPIRED_DATE}; path=/`;
}

/**
 * Clears all authentication cookies
 */
function clearAuthCookies() {
  deleteCookie(COOKIE_NAMES.entrepreneur);
  deleteCookie(COOKIE_NAMES.customer);
}

/**
 * Gets initials from a name
 * 
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 characters)
 */
function getInitials(name) {
  if (!name) return "??";
  
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// ============================================================================
// PROFILE FLOATER COMPONENT
// ============================================================================

/**
 * Profile floater dropdown component
 * Shows user info, store selection, and quick links
 * 
 * @returns {JSX.Element} The profile floater dropdown
 */
export default function ProfileFloater() {
  // ============================================================================
  // HOOKS & STATE
  // ============================================================================

  const dispatch = useDispatch();

  // Get entrepreneur data from Redux store
  const { entrepreneur_data } = useSelector((state) => state.entrepreneur_data);
  const { shop: entrepreneurShop } = useSelector((state) => state.entrepreneur_shop);

  // Extract user info with fallbacks
  const [storeName, setStoreName] = useState("");
  const [userName, setUsername] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const storeInitials = getInitials(storeName);

  useEffect(() => {
    const shopName = entrepreneurShop?.name ?? entrepreneurShop?.Name ?? "";
    setStoreName(shopName);

    const d = entrepreneur_data;
    const email =
      (d && (d.email ?? d.Email)) != null ? String(d.email ?? d.Email).trim() : "";
    const nameFromParts = d
      ? [d.fname ?? d.Fname, d.lname ?? d.Lname]
          .filter((x) => x != null && String(x).trim() !== "")
          .join(" ")
          .trim()
      : "";
    const nameFromApi =
      d?.name != null && String(d.name).trim() !== "" ? String(d.name).trim() : "";
    const name =
      nameFromParts || nameFromApi || (email ? email.split("@")[0] : "");

    setUsername(name);
    setUserEmail(email);
  }, [entrepreneurShop, entrepreneur_data]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  /**
   * Navigates to the user profile management page
   */
  const handleManageAccount = () => {
    window.location.href = "/entrepreneur/user-profile";
  };

  /**
   * Navigates to all stores page
   */
  const handleAllStores = () => {
    window.location.href = "/entrepreneur/stores";
  };

  /**
   * Navigates to help center
   */
  const handleHelpCenter = () => {
    // window.open("/entrepreneur/ng/help", "_blank");
    window.open("/entrepreneur/ng/terms-of-use", "_blank");
  };

  /**
   * Navigates to changelog
   */
  const handleChangelog = () => {
    window.open("/entrepreneur/ng/changelog", "_blank");
  };

  /**
   * Navigates to community forums
   */
  const handleCommunityForums = () => {
    window.open("/entrepreneur/ng/community", "_blank");
  };

  /**
   * Navigates to hire a partner page
   */
  const handleHirePartner = () => {
    window.open("/entrepreneur/ng/partners", "_blank");
  };

  /**
   * Handles user logout
   * Clears cookies, signs out from NextAuth, and redirects to login
   */
  const handleLogout = async () => {
    try {
      dispatch(reset_entrepreneur_shop());
      // Clear authentication cookies
      clearAuthCookies();
      
      // Clear any localStorage items if used
      if (typeof window !== "undefined") {
        localStorage.removeItem("entrepreneur_token");
        localStorage.removeItem("user_data");
      }
      
      // Sign out from NextAuth (for Google OAuth users)
      await signOut({ redirect: false });
      
      // Redirect to login page
      window.location.href = "/auth/login?role=entrepreneur";
    } catch (error) {
      console.error("Logout error:", error);
      // Still redirect even if there's an error
      window.location.href = "/auth/login?role=entrepreneur";
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="profile-floater shadow-sm">
      <ul>
        {/* Current Store */}
        <li
          onClick={() => {
            const id = entrepreneurShop?.id;
            if (id == null) return;
            window.open(`/entrepreneur/shop/${id}`, "_blank", "noopener,noreferrer");
          }}
          style={{ cursor: entrepreneurShop?.id != null ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "flex-start" }}
        >
          
          <img src={
            (
              entrepreneurShop?.logo ?
              entrepreneurShop?.logo
              :shop_svg.src

            )
          } alt="shop logo" style={{
            height: "20px",
            width: "20px",
          }} />
          {/* &nbsp;&nbsp; */}
          &nbsp;&nbsp;
          <h5 style={{margin: "0"}}>{storeName}</h5>
        </li>

        {/* All Stores Link */}
        {/* <li onClick={handleAllStores} style={{ cursor: "pointer" }}>
          <span>
            <img
              src={shop_svg.src}
              alt="All stores"
              style={{ height: "20px", width: "20px" }}
            />
          </span>
          &nbsp;&nbsp;
          <span>All Stores</span>
        </li> */}

        <hr />

        {/* Help & Resources */}
        <li onClick={handleHelpCenter} style={{ cursor: "pointer" }}>
          <span></span>
          <span>Help center</span>
        </li>

        {/* <li onClick={handleChangelog} style={{ cursor: "pointer" }}>
          <span></span>
          <span>Changelog</span>
        </li> */}

        {/* <li onClick={handleCommunityForums} style={{ cursor: "pointer" }}>
          <span></span>
          <span>Community forums</span>
        </li> */}
{/* 
        <li onClick={handleHirePartner} style={{ cursor: "pointer" }}>
          <span></span>
          <span>Hire a Deedyte Partner</span>
        </li> */}

        <hr />

        {/* User Account Section */}
        <li>
          <span style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "2px 5px", fontWeight: "500" }}>{userName}</div>
            {userEmail ? (
              <div
                style={{
                  padding: "2px 5px",
                  fontSize: "x-small",
                  color: "#666",
                  wordBreak: "break-word",
                }}
              >
                {userEmail}
              </div>
            ) : null}
          </span>
        </li>

        <li onClick={handleManageAccount} style={{ cursor: "pointer" }}>
          <span></span>
          <span>Manage account</span>
        </li>

        <li 
          onClick={handleLogout} 
          style={{ 
            cursor: "pointer",
            color: "#dc3545",
          }}
        >
          <span></span>
          <span>Log out</span>
        </li>
      </ul>
    </div>
  );
}
