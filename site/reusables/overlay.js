/**
 * Overlay Utilities
 * 
 * Functions for creating and managing loading/modal overlays.
 * Used for displaying loading states and messages to users.
 * 
 * @module reusables/overlay
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** CSS class names for overlays */
const OVERLAY_CLASSES = {
  entrepreneur: "entrepreneur-overlay",
  buyer: "buyer-overlay",
};

/** Default overlay styles */
const DEFAULT_STYLES = {
  overlay: {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "100000",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  content: {
    color: "#fff",
    textAlign: "center",
    padding: "20px",
    borderRadius: "10px",
  },
};

const PROCESS_LOADER_HTML = `
  <div class="site-process-loader" role="status" aria-label="Loading">
    <span class="site-process-loader__spinner"></span>
  </div>
`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Applies styles to an element
 * 
 * @param {HTMLElement} element - Element to style
 * @param {Object} styles - Style object
 */
function applyStyles(element, styles) {
  Object.assign(element.style, styles);
}

/**
 * Creates a styled overlay element
 * 
 * @param {string} className - CSS class name for the overlay
 * @param {string} id - ID for the overlay
 * @param {string} content - HTML content to display
 * @param {Object} [customStyles={}] - Custom styles to apply
 * @returns {HTMLElement} The created overlay element
 */
function createOverlayElement(className, id, content, customStyles = {}) {
  const overlay = document.createElement("div");
  overlay.className = className;
  overlay.id = id;
  
  // Apply default overlay styles
  applyStyles(overlay, { ...DEFAULT_STYLES.overlay, ...customStyles.overlay });

  const contentContainer = document.createElement("div");
  contentContainer.innerHTML = content;
  
  // Apply default content styles
  applyStyles(contentContainer, { ...DEFAULT_STYLES.content, ...customStyles.content });

  overlay.appendChild(contentContainer);
  return overlay;
}

/**
 * Removes an overlay from the DOM
 * 
 * @param {string} className - CSS class name of the overlay to remove
 * @returns {boolean} True if overlay was found and removed
 */
function removeOverlay(className) {
  const existingOverlay = document.querySelector(`.${className}`);
  
  if (existingOverlay) {
    existingOverlay.remove();
    return true;
  }
  
  return false;
}

/**
 * Checks if an overlay already exists
 * 
 * @param {string} className - CSS class name to check
 * @returns {boolean} True if overlay exists
 */
function overlayExists(className) {
  return document.querySelector(`.${className}`) !== null;
}

// ============================================================================
// ENTREPRENEUR OVERLAY
// ============================================================================

/**
 * Creates or removes an overlay for the entrepreneur dashboard
 * Used for loading states and modal displays
 * 
 * @param {boolean} status - Whether to show (true) or hide (false) the overlay
 * @param {string} [content="Loading..."] - HTML content to display in the overlay
 * @param {Object} [options={}] - Additional options
 * @param {Object} [options.styles] - Custom styles for overlay and content
 * @param {boolean} [options.preventDuplicate=true] - Prevent duplicate overlays
 * @returns {boolean} True if operation was successful
 */
export function entrepreneur_overlay_setup(status, content = "Loading...", options = {}) {
  const { styles = {}, preventDuplicate = true } = options;
  const className = OVERLAY_CLASSES.entrepreneur;
  const id = "entrepreneur-overlay";

  if (status === true) {
    // Prevent duplicate overlays
    if (preventDuplicate && overlayExists(className)) {
      console.warn("Entrepreneur overlay already exists");
      return false;
    }

    // Create and show overlay
    const overlay = createOverlayElement(className, id, PROCESS_LOADER_HTML, styles);
    document.body.appendChild(overlay);
    
    // Prevent body scroll when overlay is open
    document.body.style.overflow = "hidden";
    
    return true;
  } else {
    // Remove overlay
    const removed = removeOverlay(className);
    
    // Restore body scroll
    document.body.style.overflow = "";
    
    return removed;
  }
}

// ============================================================================
// BUYER OVERLAY
// ============================================================================

/**
 * Creates or removes an overlay for the buyer/customer interface
 * Used for loading states and modal displays
 * 
 * @param {boolean} status - Whether to show (true) or hide (false) the overlay
 * @param {string} [content="Loading..."] - HTML content to display in the overlay
 * @param {Object} [options={}] - Additional options
 * @param {Object} [options.styles] - Custom styles for overlay and content
 * @param {boolean} [options.preventDuplicate=true] - Prevent duplicate overlays
 * @returns {boolean} True if operation was successful
 */
export function buyer_overlay_setup(status, content = "Loading...", options = {}) {
  const { styles = {}, preventDuplicate = true } = options;
  const className = OVERLAY_CLASSES.buyer;
  const id = "buyer-overlay";

  // Default buyer-specific content styles
  const buyerContentStyles = {
    width: "100%",
    maxWidth: "400px",
    ...styles.content,
  };

  if (status === true) {
    // Prevent duplicate overlays
    if (preventDuplicate && overlayExists(className)) {
      console.warn("Buyer overlay already exists");
      return false;
    }

    // Create and show overlay
    const overlay = createOverlayElement(
      className, 
      id, 
      PROCESS_LOADER_HTML, 
      { ...styles, content: buyerContentStyles }
    );
    document.body.appendChild(overlay);
    
    // Prevent body scroll when overlay is open
    document.body.style.overflow = "hidden";
    
    return true;
  } else {
    // Remove overlay
    const removed = removeOverlay(className);
    
    // Restore body scroll
    document.body.style.overflow = "";
    
    return removed;
  }
}

// ============================================================================
// GENERIC OVERLAY FUNCTIONS
// ============================================================================

/**
 * Shows a loading overlay with a spinner
 * 
 * @param {string} [message="Please wait..."] - Loading message
 * @param {string} [type="entrepreneur"] - Overlay type ('entrepreneur' | 'buyer')
 * @returns {boolean} True if overlay was shown
 */
export function showLoadingOverlay(_message = "Please wait...", type = "entrepreneur") {
  if (type === "buyer") {
    return buyer_overlay_setup(true);
  }
  
  return entrepreneur_overlay_setup(true);
}

/**
 * Hides any active overlay
 * 
 * @param {string} [type="entrepreneur"] - Overlay type ('entrepreneur' | 'buyer' | 'all')
 * @returns {boolean} True if at least one overlay was removed
 */
export function hideOverlay(type = "entrepreneur") {
  if (type === "all") {
    const entrepreneurRemoved = removeOverlay(OVERLAY_CLASSES.entrepreneur);
    const buyerRemoved = removeOverlay(OVERLAY_CLASSES.buyer);
    document.body.style.overflow = "";
    return entrepreneurRemoved || buyerRemoved;
  }

  if (type === "buyer") {
    return buyer_overlay_setup(false);
  }
  
  return entrepreneur_overlay_setup(false);
}

/**
 * Shows a success message overlay that auto-hides
 * 
 * @param {string} message - Success message to display
 * @param {number} [duration=2000] - Duration in milliseconds before auto-hide
 * @param {string} [type="entrepreneur"] - Overlay type
 * @returns {Promise<void>} Resolves when overlay is hidden
 */
export function showSuccessOverlay(message, duration = 2000, type = "entrepreneur") {
  const successHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
      <div style="
        width: 50px; 
        height: 50px; 
        background-color: #00926e; 
        border-radius: 50%; 
        display: flex; 
        align-items: center; 
        justify-content: center;
      ">
        <span style="font-size: 24px;">✓</span>
      </div>
      <p style="margin: 0; font-size: 16px;">${message}</p>
    </div>
  `;

  const setupFn = type === "buyer" ? buyer_overlay_setup : entrepreneur_overlay_setup;
  setupFn(true, successHTML);

  return new Promise((resolve) => {
    setTimeout(() => {
      setupFn(false);
      resolve();
    }, duration);
  });
}

/**
 * Shows an error message overlay that auto-hides
 * 
 * @param {string} message - Error message to display
 * @param {number} [duration=3000] - Duration in milliseconds before auto-hide
 * @param {string} [type="entrepreneur"] - Overlay type
 * @returns {Promise<void>} Resolves when overlay is hidden
 */
export function showErrorOverlay(message, duration = 3000, type = "entrepreneur") {
  const errorHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
      <div style="
        width: 50px; 
        height: 50px; 
        background-color: #dc3545; 
        border-radius: 50%; 
        display: flex; 
        align-items: center; 
        justify-content: center;
      ">
        <span style="font-size: 24px;">✕</span>
      </div>
      <p style="margin: 0; font-size: 16px; color: #ff6b6b;">${message}</p>
    </div>
  `;

  const setupFn = type === "buyer" ? buyer_overlay_setup : entrepreneur_overlay_setup;
  setupFn(true, errorHTML);

  return new Promise((resolve) => {
    setTimeout(() => {
      setupFn(false);
      resolve();
    }, duration);
  });
}
