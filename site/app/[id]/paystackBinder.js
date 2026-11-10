"use client";

import { useEffect } from "react";
import { usePaystackPayment } from "react-paystack";

/** Loaded only in the browser. react-paystack reads `window` at import time. */
export default function PaystackBinder({ config, paymentRef }) {
  const initializePayment = usePaystackPayment(config);

  useEffect(() => {
    paymentRef.current = initializePayment;
  }, [initializePayment, paymentRef]);

  return null;
}
