import { db } from "../config/database.js";
import { notifyUser } from "./socketBroadcast.js";

export type NotificationRole = "buyer" | "vendor";
export type NotificationSource = "order" | "dispute" | "return" | "chat";

export type NotificationRow = {
  id: number;
  recipient_id: number;
  title: string;
  message: string;
  status: "unread" | "read";
  source_type: NotificationSource;
  source_id: number;
  role: NotificationRole;
  created_at: string;
  updated_at: string;
};

export function appRoleToNotificationRole(role: unknown): NotificationRole | null {
  const value = String(role ?? "").trim().toLowerCase();
  if (value === "vendor" || value === "seller") return "vendor";
  if (value === "buyer" || value === "customer") return "buyer";
  return null;
}

export async function createAndEmitNotification(input: {
  recipientId: number;
  title: string;
  message: string;
  sourceType: NotificationSource;
  sourceId: number;
  role: NotificationRole;
}): Promise<NotificationRow | null> {
  const recipientId = Number(input.recipientId);
  const sourceId = Number(input.sourceId);
  if (!Number.isFinite(recipientId) || recipientId <= 0) return null;
  if (!Number.isFinite(sourceId) || sourceId <= 0) return null;
  const title = String(input.title ?? "").trim().slice(0, 255);
  const message = String(input.message ?? "").trim();
  if (!title || !message) return null;

  const pool = await db();
  const { rows } = await pool.query<NotificationRow>(
    `INSERT INTO notifications
      (recipient_id, title, message, status, source_type, source_id, role)
     VALUES ($1, $2, $3, 'unread', $4, $5, $6)
     RETURNING *`,
    [recipientId, title, message, input.sourceType, sourceId, input.role],
  );
  const row = rows[0];
  if (!row) return null;
  notifyUser(recipientId, "notification_created", { notification: row });
  return row;
}

export async function listNotifications(
  recipientId: number,
  role: NotificationRole,
): Promise<NotificationRow[]> {
  const pool = await db();
  const { rows } = await pool.query<NotificationRow>(
    `SELECT * FROM notifications
     WHERE recipient_id = $1 AND role = $2
     ORDER BY created_at DESC
     LIMIT 80`,
    [recipientId, role],
  );
  return rows;
}

export async function markNotificationRead(
  recipientId: number,
  notificationId: number,
): Promise<NotificationRow | null> {
  const pool = await db();
  const { rows } = await pool.query<NotificationRow>(
    `UPDATE notifications
     SET status = 'read', updated_at = NOW()
     WHERE id = $1 AND recipient_id = $2
     RETURNING *`,
    [notificationId, recipientId],
  );
  return rows[0] ?? null;
}
