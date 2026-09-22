/**
 * Redux Store Configuration
 * 
 * Central store configuration for the Deedyte application.
 * Combines all reducers and exports the configured store.
 * 
 * @module redux/store
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { configureStore } from "@reduxjs/toolkit";

// Entrepreneur-related reducers
import floaterSrcReducer from "./entrepreneur/floater_src";
import entrepreneurCookieReducer from "./entrepreneur/entrepreneur_cookie";
import entrepreneurIdReducer from "./entrepreneur/entrepreneur_id";
import entrepreneurDataReducer from "./entrepreneur/entrepreneur_data";
import entrepreneurShopReducer from "./entrepreneur/entrepreneur_shop";

// ============================================================================
// STORE CONFIGURATION
// ============================================================================

/**
 * Configured Redux store with all application reducers
 */
const store = configureStore({
  reducer: {
    // Floater/Modal state management
    floater_src: floaterSrcReducer,
    
    // Entrepreneur authentication and data
    entrepreneur_cookie: entrepreneurCookieReducer,
    entrepreneur_id: entrepreneurIdReducer,
    entrepreneur_data: entrepreneurDataReducer,
    entrepreneur_shop: entrepreneurShopReducer,
  },
});

export default store;
