import admin from "firebase-admin";
import dotenv from "dotenv";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
dotenv.config();

function initFirebaseAdmin() {
  if (admin.apps.length) return;

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT
    ? resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (serviceAccountPath && existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(
      readFileSync(serviceAccountPath, "utf8")
    ) as admin.ServiceAccount & { project_id?: string };

    const projectId =
      serviceAccount.projectId || serviceAccount.project_id;
    if (!projectId) {
      throw new Error(
        "Firebase service account JSON is missing project_id."
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
    console.log(
      `[firebase] initialized from ${process.env.FIREBASE_SERVICE_ACCOUNT} (project ${projectId})`
    );
    return;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY."
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
    projectId,
  });
  // console.log(`[firebase] initialized from env vars (project ${projectId})`);
  // admin.initializeApp({
  //   credential: admin.credential.cert(serviceAccount as any)
  // })
}

initFirebaseAdmin();

/**
 * Flatten navigation keys onto FCM data (all values must be strings).
 * Keeps full meta JSON for richer clients.
 */
function buildNavData(
  title: string,
  body: string,
  meta: Record<string, any> | null | undefined,
  extra: Record<string, string> = {}
): Record<string, string> {
  const m = meta && typeof meta === "object" ? meta : {};
  const data: Record<string, string> = {
    title: String(title ?? ""),
    body: String(body ?? ""),
    meta: JSON.stringify(m),
    ...extra,
  };

  const put = (key: string, value: unknown) => {
    if (value == null || value === "") return;
    data[key] = String(value);
  };

  put("type", m.type ?? m.entity ?? m.kind ?? m.activity_type);
  put("order_id", m.order_id ?? m.orderId);
  put("dispute_id", m.dispute_id ?? m.disputeId);
  put("return_id", m.return_id ?? m.returnId);
  put("room_id", m.room_id ?? m.roomId);
  put("room_name", m.room_name ?? m.roomName ?? m.name);

  return data;
}

/**
 * Build a displayable FCM message (system banner when app is backgrounded / killed).
 * Data-only messages do not show a tray notification on iOS.
 */
function buildDisplayMessage(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>
) {
  const safeTitle = String(title || "Deedyte");
  const safeBody = String(body || "");

  return {
    token,
    notification: {
      title: safeTitle,
      body: safeBody,
    },
    data,
    android: {
      priority: "high" as const,
      notification: {
        title: safeTitle,
        body: safeBody,
        sound: "default",
      },
    },
    apns: {
      headers: {
        "apns-priority": "10",
      },
      payload: {
        aps: {
          alert: {
            title: safeTitle,
            body: safeBody,
          },
          sound: "default",
          // Ensures delivery when app is backgrounded / not running
          "content-available": 1,
        },
      },
    },
  };
}

export async function sendFcmForActivities(
  token: string,
  title: string,
  body: string,
  media: unknown,
  meta: Record<string, any>
) {
  try {
    const message = buildDisplayMessage(
      token,
      title,
      body,
      buildNavData(title, body, meta, {
        media: JSON.stringify(media ?? null),
      })
    );

    const response = await admin.messaging().send(message);

    console.log("Successfully sent notification:", response);

    return {
      success: true,
      response,
    };
  } catch (error: any) {
    console.error("Failed to send notification:", error);
    return {
      success: false,
      error: error.message || error,
      code: error.code || error.errorInfo?.code,
      hint:
        error.code === "messaging/third-party-auth-error"
          ? "FCM server auth is fine; this usually means missing/invalid APNs (.p8) for iOS or Web Push certificates in Firebase Console → Project settings → Cloud Messaging. Also confirm the device token belongs to project deedyte-f66b6."
          : undefined,
    };
  }
}

export async function sendFcmForNewMssg(
  token: string,
  title: string,
  body: string,
  meta: Record<string, any>
) {
  try {
    const messageMeta = {
      type: "message",
      ...(meta && typeof meta === "object" ? meta : {}),
    };
    const message = buildDisplayMessage(
      token,
      title,
      body,
      buildNavData(title, body, messageMeta)
    );

    const response = await admin.messaging().send(message);

    console.log("Successfully sent notification:", response);

    return {
      success: true,
      response,
    };
  } catch (error: any) {
    console.error("Error sending notification:", error);

    return {
      success: false,
      error: error.message || error,
    };
  }
}
