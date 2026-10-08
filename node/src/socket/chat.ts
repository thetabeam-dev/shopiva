import type { Namespace } from "socket.io";
import { db } from "../config/database.js";
import { chatModel, type ParticipantRole } from "../models/chat.js";
import { createAndEmitNotification, appRoleToNotificationRole } from "../services/notifications.js";
import { MODERATION_CONFIG } from "../utils/moderationConfig.js";
import {
  getSessionModerationStrikes,
  incrementSessionModerationStrikes,
} from "../utils/moderationStrikes.js";
import {
  logModerationBlock,
  scanConversationContext,
  scanMessage,
} from "../utils/messageModeration.js";

type AckFn = (response: Record<string, unknown>) => void;

/** Mobile sends app_role: customer | vendor — maps to participant row buyer | seller. */
function parseAppRoleToParticipant(payload: unknown): ParticipantRole | null {
  if (payload == null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const raw = String(p.app_role ?? p.appRole ?? "").toLowerCase();
  if (raw === "vendor" || raw === "seller") return "seller";
  if (raw === "customer" || raw === "buyer") return "buyer";
  return null;
}

async function assertMatchingAppRole(
  room_id: string,
  userId: number,
  payload: Record<string, unknown>,
  ack: unknown
): Promise<boolean> {
  const required = parseAppRoleToParticipant(payload);
  if (!required) {
    respond(ack, {
      success: false,
      result: null,
      message: "app_role is required (customer or vendor)",
      error: "missing_app_role",
    });
    return false;
  }
  const actual = await chatModel.getParticipantRole(room_id, userId);
  if (!actual) {
    respond(ack, {
      success: false,
      result: null,
      message: "Not a participant",
      error: "forbidden",
    });
    return false;
  }
  if (actual === "admin") return true;
  if (actual !== required) {
    respond(ack, {
      success: false,
      result: null,
      message: "Use buyer mode or seller mode that matches this conversation",
      error: "role_context_mismatch",
    });
    return false;
  }
  return true;
}

function respond(ack: unknown, payload: Record<string, unknown>): void {
  if (typeof ack === "function") {
    (ack as AckFn)(payload);
  }
}

function parsePositiveInt(value: unknown): number | null {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function handleCreateRoom(
  userId: number,
  nsp: Namespace,
  payload: Record<string, unknown>,
  ack?: unknown
): Promise<void> {
  const order_id = parsePositiveInt(payload.order_id);
  const recipient_id = parsePositiveInt(payload.recipient_id);
  const initiator_role = (payload.initiator_role as ParticipantRole) ?? "buyer";
  const recipient_role = (payload.recipient_role as ParticipantRole) ?? "seller";

  if (!order_id || !recipient_id) {
    respond(ack, {
      success: false,
      result: null,
      message: "order_id and recipient_id are required",
      error: "invalid_payload",
    });
    return;
  }
  if (recipient_id === userId) {
    respond(ack, {
      success: false,
      result: null,
      message: "recipient must differ from initiator",
      error: "invalid_recipient",
    });
    return;
  }

  const existingId = await chatModel.findRoomForOrderAndUsers(
    order_id,
    userId,
    recipient_id
  );
  if (existingId) {
    const room = await chatModel.getRoomById(existingId);
    respond(ack, {
      success: true,
      result: { room, existing: true },
      message: "Room already exists for this order",
    });
    if (room) {
      nsp.to(`user:${recipient_id}`).emit("room_created", { room, existing: true });
    }
    return;
  }

  const room = await chatModel.createRoom({
    order_id,
    initiator: userId,
    participants: [
      { user_id: userId, role: initiator_role },
      { user_id: recipient_id, role: recipient_role },
    ],
  });

  respond(ack, {
    success: true,
    result: { room, existing: false },
    message: "Room created",
  });

  nsp.to(`user:${recipient_id}`).emit("room_created", { room, existing: false });
}

export async function handleCreateMessage(
  userId: number,
  nsp: Namespace,
  payload: Record<string, unknown>,
  ack?: unknown
): Promise<void> {
  const room_id =
    typeof payload.room_id === "string"
      ? payload.room_id
      : payload.room_id != null
        ? String(payload.room_id)
        : "";
  const type = payload.type as "text" | "image" | "file" | "system";
  const allowed = ["text", "image", "file", "system"] as const;
  if (!room_id || !allowed.includes(type)) {
    respond(ack, {
      success: false,
      result: null,
      message: "room_id and valid type are required",
      error: "invalid_payload",
    });
    return;
  }

  const roleOk = await assertMatchingAppRole(room_id, userId, payload, ack);
  if (!roleOk) return;

  const content =
    typeof payload.content === "string"
      ? payload.content
      : payload.content != null
        ? String(payload.content)
        : null;

  if (type === "text" && content) {
    const strikes = getSessionModerationStrikes(userId, room_id);

    const single = scanMessage(content);
    if (!single.isAllowed) {
      incrementSessionModerationStrikes(userId, room_id);
      logModerationBlock({
        userId,
        roomId: room_id,
        violations: single.violations,
        severityScore: single.severityScore ?? 0,
        preview: content,
        context: false,
      });
      respond(ack, {
        success: false,
        result: {
          violations: single.violations,
          severityScore: single.severityScore,
        },
        message:
          "This message cannot be sent because it may contain contact details or off-platform requests.",
        error: "message_moderation_failed",
      });
      return;
    }

    const recent = await chatModel.listRecentTextFromSender(
      room_id,
      userId,
      MODERATION_CONFIG.HISTORY_MAX_MESSAGES,
    );
    const prevTexts = recent
      .map((r: { content: string | null; created_at: Date }) =>
        String(r.content ?? "").trim(),
      )
      .filter((t: string) => t.length > 0);
    const prevTs = recent.map((r: { content: string | null; created_at: Date }) =>
      new Date(r.created_at).getTime(),
    );
    const ctx = scanConversationContext(content, prevTexts, {
      messageTimestamps: prevTs,
      now: Date.now(),
      sessionBlockCount: strikes,
    });
    if (!ctx.isAllowed) {
      incrementSessionModerationStrikes(userId, room_id);
      logModerationBlock({
        userId,
        roomId: room_id,
        violations: ctx.violations,
        severityScore: ctx.severityScore ?? 0,
        riskScore: ctx.riskScore ?? 0,
        preview: content,
        context: true,
      });
      respond(ack, {
        success: false,
        result: {
          violations: ctx.violations,
          severityScore: ctx.severityScore,
          fromContext: true,
        },
        message:
          "This message cannot be sent because it may contain contact details or off-platform requests.",
        error: "message_moderation_failed",
      });
      return;
    }
  }

  const message = await chatModel.createMessage({
    room_id,
    sender: userId,
    type,
    content,
  });

  respond(ack, {
    success: true,
    result: { message },
    message: "Message sent",
  });

  const others = await chatModel.otherParticipantIds(room_id, userId);
  const room = await chatModel.getRoomById(room_id);
  const orderId = Number(room?.order_id);
  const seen = new Set<number>();
  for (const uid of others) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    nsp.to(`user:${uid}`).emit("message_created", { message });
    const participantRole = await chatModel.getParticipantRole(room_id, uid);
    const role = appRoleToNotificationRole(participantRole);
    if (role && Number.isFinite(orderId) && orderId > 0) {
      const preview = String(content ?? "").trim().slice(0, 140) || "New chat message";
      void createAndEmitNotification({
        recipientId: uid,
        title: "New message",
        message: preview,
        sourceType: "chat",
        sourceId: orderId,
        role,
      });
    }
  }
  nsp.to(`user:${userId}`).emit("message_created", { message });
}

export async function handleTyping(
  userId: number,
  nsp: Namespace,
  payload: Record<string, unknown>,
  ack?: unknown
): Promise<void> {
  const room_id =
    typeof payload.room_id === "string"
      ? payload.room_id
      : payload.room_id != null
        ? String(payload.room_id)
        : "";
  if (!room_id) {
    respond(ack, {
      success: false,
      result: null,
      message: "room_id is required",
      error: "invalid_payload",
    });
    return;
  }

  const roleOk = await assertMatchingAppRole(room_id, userId, payload, ack);
  if (!roleOk) return;

  respond(ack, { success: true, result: null, message: "ok" });

  const others = await chatModel.otherParticipantIds(room_id, userId);
  for (const uid of others) {
    nsp.to(`user:${uid}`).emit("user_typing", { room_id, user_id: userId });
  }
}

export async function handleGetRooms(
  userId: number,
  _nsp: Namespace,
  payload: unknown,
  ack?: unknown
): Promise<void> {
  const role = parseAppRoleToParticipant(payload);
  if (!role) {
    respond(ack, {
      success: false,
      result: null,
      message: "app_role is required (customer or vendor)",
      error: "missing_app_role",
    });
    return;
  }
  const rooms = await chatModel.listRoomsForUser(userId, role);
  respond(ack, {
    success: true,
    result: { rooms },
    message: "ok",
  });
}

export async function handleGetRoomMessages(
  userId: number,
  _nsp: Namespace,
  payload: Record<string, unknown>,
  ack?: unknown
): Promise<void> {
  const room_id =
    typeof payload.room_id === "string"
      ? payload.room_id
      : payload.room_id != null
        ? String(payload.room_id)
        : "";
  const lim = parsePositiveInt(payload.limit) ?? 50;

  if (!room_id) {
    respond(ack, {
      success: false,
      result: null,
      message: "room_id is required",
      error: "invalid_payload",
    });
    return;
  }

  const roleOk = await assertMatchingAppRole(room_id, userId, payload, ack);
  if (!roleOk) return;

  const messages = await chatModel.listMessages(room_id, userId, lim);
  await chatModel.markRoomRead(room_id, userId);
  respond(ack, {
    success: true,
    result: { messages },
    message: "ok",
  });
}

export async function handleMarkMessageRead(
  userId: number,
  _nsp: Namespace,
  payload: Record<string, unknown>,
  ack?: unknown
): Promise<void> {
  const message_id =
    typeof payload.message_id === "string"
      ? payload.message_id
      : payload.message_id != null
        ? String(payload.message_id)
        : "";

  if (!message_id) {
    respond(ack, {
      success: false,
      result: null,
      message: "message_id is required",
      error: "invalid_payload",
    });
    return;
  }

  const pool = await db();
  const { rows: midRows } = await pool.query<{ room_id: string }>(
    `SELECT room_id AS room_id FROM chat_messages WHERE id = $1`,
    [message_id]
  );
  const rid = midRows[0]?.room_id;
  if (!rid) {
    respond(ack, {
      success: false,
      result: null,
      message: "Message not found",
      error: "not_found",
    });
    return;
  }
  const roleOk = await assertMatchingAppRole(rid, userId, payload, ack);
  if (!roleOk) return;

  const read = await chatModel.markMessageRead(message_id, userId);
  respond(ack, {
    success: true,
    result: { read },
    message: "ok",
  });
}
