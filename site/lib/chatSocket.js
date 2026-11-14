/**
 * Buyer chat socket helpers (same Node chat events as the mobile app).
 */
"use client";

import { io } from "socket.io-client";
import { getCookie } from "@/reusables/shopBackendAuth";

/** @type {import('socket.io-client').Socket | null} */
let socketSingleton = null;
/** @type {Promise<import('socket.io-client').Socket | null> | null} */
let connectPromise = null;

function backendUrl() {
  const raw =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BACKEND_URL) ||
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
    "";
  return String(raw).trim().replace(/\/$/, "");
}

export async function connectChatSocket() {
  if (socketSingleton?.connected) return socketSingleton;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const token = getCookie("customer_secret");
    const base = backendUrl();
    if (!token || !base) return null;

    if (!socketSingleton) {
      socketSingleton = io(base, {
        autoConnect: false,
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        auth: { token },
      });
    } else {
      socketSingleton.auth = { token };
    }

    if (!socketSingleton.connected) {
      await new Promise((resolve) => {
        const done = () => {
          socketSingleton?.off("connect", done);
          socketSingleton?.off("connect_error", done);
          resolve(undefined);
        };
        socketSingleton.on("connect", done);
        socketSingleton.on("connect_error", done);
        socketSingleton.connect();
      });
    }

    return socketSingleton?.connected ? socketSingleton : null;
  })();

  const out = await connectPromise;
  connectPromise = null;
  return out;
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} [payload]
 */
export async function emitChatSocketAck(event, payload = {}) {
  const socket = await connectChatSocket();
  if (!socket?.connected) {
    return {
      success: false,
      message: "Chat unavailable. Sign in again and try once more.",
      result: null,
    };
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ success: false, message: "Chat timed out. Try again.", result: null });
    }, 20000);
    socket.emit(event, payload, (ack) => {
      clearTimeout(timer);
      resolve(
        ack && typeof ack === "object"
          ? ack
          : { success: false, message: "Unexpected chat response.", result: null },
      );
    });
  });
}
