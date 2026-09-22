/**
 * Paystack Payment Component
 * 
 * React component for handling Paystack payment integration.
 * Must be used as a component (not a regular function) because it uses React hooks.
 * 
 * @module components/entrepreneur/payment
 */

"use client";

import React, { useEffect, useCallback } from "react";
import { usePaystackPayment } from "react-paystack";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Paystack public key from environment
 * @constant {string}
 */
const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "";

/**
 * Default currency
 * @constant {string}
 */
const DEFAULT_CURRENCY = "NGN";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generates a unique transaction reference
 * 
 * @returns {string} Unique reference string
 */
export function generateReference() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `deedyte_${timestamp}_${random}`;
}

/**
 * Converts Naira to Kobo (Paystack uses kobo)
 * 
 * @param {number} naira - Amount in Naira
 * @returns {number} Amount in Kobo
 */
export function nairaToKobo(naira) {
  return Math.round(naira * 100);
}

/**
 * Converts Kobo to Naira
 * 
 * @param {number} kobo - Amount in Kobo
 * @returns {number} Amount in Naira
 */
export function koboToNaira(kobo) {
  return kobo / 100;
}

// ============================================================================
// PAYSTACK PAYMENT BUTTON COMPONENT
// ============================================================================

/**
 * Paystack Payment Button Component
 * 
 * A button that triggers Paystack payment when clicked.
 * Uses the usePaystackPayment hook internally.
 * 
 * @param {Object} props - Component props
 * @param {string} props.email - Customer email address
 * @param {number} props.amount - Amount in Naira (will be converted to Kobo)
 * @param {string} [props.reference] - Transaction reference (auto-generated if not provided)
 * @param {string} [props.currency="NGN"] - Currency code
 * @param {Object} [props.metadata={}] - Additional metadata for the transaction
 * @param {Function} props.onSuccess - Callback on successful payment
 * @param {Function} [props.onClose] - Callback when payment modal is closed
 * @param {string} [props.buttonText="Pay Now"] - Text to display on button
 * @param {string} [props.className=""] - Additional CSS classes for button
 * @param {Object} [props.style={}] - Inline styles for button
 * @param {boolean} [props.disabled=false] - Whether button is disabled
 * @param {React.ReactNode} [props.children] - Custom button content
 * @returns {JSX.Element} Payment button component
 */
export function PaystackButton({
  email,
  amount,
  reference,
  currency = DEFAULT_CURRENCY,
  metadata = {},
  onSuccess,
  onClose,
  buttonText = "Pay Now",
  className = "",
  style = {},
  disabled = false,
  children,
}) {
  // Payment configuration - use defaults if email/amount missing to keep hooks order consistent
  const config = {
    reference: reference || generateReference(),
    email: email || "",
    amount: nairaToKobo(amount || 0),
    publicKey: PAYSTACK_PUBLIC_KEY,
    currency,
    metadata: {
      custom_fields: [
        {
          display_name: "Platform",
          variable_name: "platform",
          value: "Deedyte",
        },
        ...Object.entries(metadata).map(([key, value]) => ({
          display_name: key,
          variable_name: key.toLowerCase().replace(/\s+/g, "_"),
          value: String(value),
        })),
      ],
    },
  };

  // Initialize Paystack payment hook
  const initializePayment = usePaystackPayment(config);

  /**
   * Handles successful payment
   * @param {Object} response - Paystack response object
   */
  const handleSuccess = useCallback((response) => {
    if (onSuccess) {
      onSuccess({
        ...response,
        amountPaid: koboToNaira(config.amount),
        currency: config.currency,
      });
    }
  }, [onSuccess, config.amount, config.currency]);

  /**
   * Handles payment modal close
   */
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  /**
   * Triggers the payment
   */
  const handlePayment = () => {
    if (disabled || !email || !amount) return;
    initializePayment(handleSuccess, handleClose);
  };

  // Default button styles
  const defaultStyle = {
    padding: "12px 24px",
    backgroundColor: "#00926e",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: (disabled || !email || !amount) ? "not-allowed" : "pointer",
    fontSize: "16px",
    fontWeight: "500",
    opacity: (disabled || !email || !amount) ? 0.6 : 1,
    transition: "all 0.2s ease",
    ...style,
  };

  // Validate required props - return null after hooks are called
  if (!email || !amount) {
    console.error("PaystackButton: email and amount are required");
    return null;
  }

  return (
    <button
      type="button"
      onClick={handlePayment}
      className={className}
      style={defaultStyle}
      disabled={disabled}
    >
      {children || buttonText}
    </button>
  );
}

// ============================================================================
// PAYSTACK INLINE COMPONENT
// ============================================================================

/**
 * Paystack Inline Payment Component
 * 
 * Automatically triggers payment on mount.
 * Useful for checkout flows where payment should start immediately.
 * 
 * @param {Object} props - Component props
 * @param {string} props.email - Customer email address
 * @param {number} props.amount - Amount in Naira
 * @param {string} [props.reference] - Transaction reference
 * @param {Function} props.onSuccess - Callback on successful payment
 * @param {Function} [props.onClose] - Callback when payment modal is closed
 * @param {boolean} [props.autoStart=true] - Whether to auto-start payment
 * @returns {null} This component doesn't render anything
 */
export function PaystackInline({
  email,
  amount,
  reference,
  onSuccess,
  onClose,
  autoStart = true,
}) {
  // Payment configuration
  const config = {
    reference: reference || generateReference(),
    email,
    amount: nairaToKobo(amount),
    publicKey: PAYSTACK_PUBLIC_KEY,
  };

  // Initialize Paystack payment hook
  const initializePayment = usePaystackPayment(config);

  // Handle successful payment
  const handleSuccess = useCallback((response) => {
    if (onSuccess) {
      onSuccess({
        ...response,
        amountPaid: koboToNaira(config.amount),
      });
    }
  }, [onSuccess, config.amount]);

  // Handle payment modal close
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  // Auto-start payment on mount if enabled
  useEffect(() => {
    if (autoStart && email && amount) {
      initializePayment(handleSuccess, handleClose);
    }
  }, [autoStart, email, amount, initializePayment, handleSuccess, handleClose]);

  // This component doesn't render anything
  return null;
}

// ============================================================================
// HOOK FOR CUSTOM IMPLEMENTATIONS
// ============================================================================

/**
 * Custom hook for Paystack payment
 * 
 * Use this hook when you need more control over the payment flow.
 * 
 * @param {Object} config - Payment configuration
 * @param {string} config.email - Customer email
 * @param {number} config.amount - Amount in Naira
 * @param {string} [config.reference] - Transaction reference
 * @returns {Object} Payment controls
 */
export function usePayment({ email, amount, reference }) {
  const config = {
    reference: reference || generateReference(),
    email,
    amount: nairaToKobo(amount),
    publicKey: PAYSTACK_PUBLIC_KEY,
  };

  const initializePayment = usePaystackPayment(config);

  /**
   * Starts the payment process
   * @param {Function} onSuccess - Success callback
   * @param {Function} [onClose] - Close callback
   */
  const startPayment = useCallback((onSuccess, onClose) => {
    initializePayment(
      (response) => {
        if (onSuccess) {
          onSuccess({
            ...response,
            amountPaid: koboToNaira(config.amount),
          });
        }
      },
      onClose || (() => {})
    );
  }, [initializePayment, config.amount]);

  return {
    startPayment,
    reference: config.reference,
    amountInKobo: config.amount,
    amountInNaira: amount,
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default PaystackButton;
