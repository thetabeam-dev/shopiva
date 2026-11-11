import { db } from "../config/database.js";
import { withErrorHandling } from "../utils/errHandler.js";

export type ChatRoomRecord = {
  id: string;
  order_id: string;
  initiator: number;
  last_message: string;
  created_at: Date;
  updated_at: Date;
  unread_count?: number;
  counterpart_name?: string | null;
};

export type ChatMessageRecord = {
  id: string;
  sender: number;
  room_id: string;
  type: "text" | "image" | "file" | "system";
  content: string | null;
  created_at: Date;
  updated_at: Date;
  is_read?: boolean;
};

export type ParticipantRole = "buyer" | "seller" | "admin";

export type CreateChatRoomInput = {
  order_id: number;
  initiator: number;
  participants: { user_id: number; role: ParticipantRole }[];
};

export class chatModel {
  /** Returns an existing room id when the same order already has both users as participants. */
  static getRoomById = withErrorHandling(
    async (room_id: string): Promise<ChatRoomRecord | null> => {
      const { rows } = await (await db()).query<ChatRoomRecord>(
        `SELECT id, order_id, initiator, last_message, created_at, updated_at
         FROM chat_rooms WHERE id = $1`,
        [room_id]
      );
      return rows[0] ?? null;
    }
  );

  static findRoomForUsers = withErrorHandling(
    async (userA: number, userB: number): Promise<string | null> => {
      const { rows } = await (await db()).query<{ id: string }>(
        `SELECT cr.id AS id
         FROM chat_rooms cr
         WHERE EXISTS (
             SELECT 1 FROM chat_room_participants p
             WHERE p.room_id = cr.id AND p.user_id = $1
           )
           AND EXISTS (
             SELECT 1 FROM chat_room_participants p
             WHERE p.room_id = cr.id AND p.user_id = $2
           )
         ORDER BY cr.updated_at DESC
         LIMIT 1`,
        [userA, userB]
      );
      return rows[0]?.id ?? null;
    }
  );

  static getShopForRoom = withErrorHandling(
    async (room_id: string): Promise<{ shopId: number; shopName: string; shopSlug: string } | null> => {
      const { rows } = await (await db()).query<{
        shop_id: string | number | null;
        name: string | null;
        slug: string | null;
      }>(
        `SELECT COALESCE(s_order.id, s_owner.id) AS shop_id,
                COALESCE(NULLIF(TRIM(s_order.name), ''), NULLIF(TRIM(s_owner.name), '')) AS name,
                COALESCE(NULLIF(TRIM(s_order.slug), ''), NULLIF(TRIM(s_owner.slug), '')) AS slug
         FROM chat_rooms cr
         LEFT JOIN orders o ON o.id = cr.order_id AND cr.order_id > 0
         LEFT JOIN shops s_order ON s_order.id::text = TRIM(o.shop_id::text)
         LEFT JOIN LATERAL (
           SELECT s.id, s.name, s.slug
           FROM chat_room_participants p
           INNER JOIN shops s ON s.ownerid = p.user_id
           WHERE p.room_id = cr.id AND p.role = 'seller'
           ORDER BY s.id
           LIMIT 1
         ) s_owner ON true
         WHERE cr.id = $1
         LIMIT 1`,
        [room_id],
      );
      const shopId = Number(rows[0]?.shop_id);
      if (!Number.isFinite(shopId) || shopId < 1) return null;
      return {
        shopId,
        shopName: String(rows[0]?.name ?? "").trim(),
        shopSlug: String(rows[0]?.slug ?? "").trim(),
      };
    },
  );

  static getShopOwnerId = withErrorHandling(
    async (shop_id: number): Promise<{ ownerId: number; shopName: string } | null> => {
      const { rows } = await (await db()).query<{ ownerid: number; name: string | null }>(
        `SELECT ownerid, name FROM shops WHERE id = $1 LIMIT 1`,
        [shop_id]
      );
      const ownerId = Number(rows[0]?.ownerid);
      if (!Number.isFinite(ownerId) || ownerId < 1) return null;
      return {
        ownerId,
        shopName: String(rows[0]?.name ?? "").trim(),
      };
    }
  );

  static findRoomForOrderAndUsers = withErrorHandling(
    async (
      order_id: number,
      userA: number,
      userB: number
    ): Promise<string | null> => {
      const { rows } = await (await db()).query<{ id: string }>(
        `SELECT cr.id AS id
         FROM chat_rooms cr
         WHERE cr.order_id = $1
           AND EXISTS (
             SELECT 1 FROM chat_room_participants p
             WHERE p.room_id = cr.id AND p.user_id = $2
           )
           AND EXISTS (
             SELECT 1 FROM chat_room_participants p
             WHERE p.room_id = cr.id AND p.user_id = $3
           )
         LIMIT 1`,
        [order_id, userA, userB]
      );
      return rows[0]?.id ?? null;
    }
  );

  static createRoom = withErrorHandling(
    async (payload: CreateChatRoomInput): Promise<ChatRoomRecord> => {
      const { order_id, initiator, participants } = payload;
      const pool = await db();
      const conn = await pool.connect();
      try {
        await conn.query("BEGIN");
        const { rows } = await conn.query<ChatRoomRecord>(
          `INSERT INTO chat_rooms (order_id, initiator)
           VALUES ($1, $2)
           RETURNING id, order_id, initiator, last_message, created_at, updated_at`,
          [order_id, initiator]
        );
        const room = rows[0];
        if (!room) {
          throw new Error("Failed to create chat room");
        }
        for (const p of participants) {
          await conn.query(
            `INSERT INTO chat_room_participants (room_id, user_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT (room_id, user_id) DO NOTHING`,
            [room.id, p.user_id, p.role]
          );
        }
        await conn.query("COMMIT");
        return room;
      } catch (e) {
        await conn.query("ROLLBACK");
        throw e;
      } finally {
        conn.release();
      }
    }
  );

  static isParticipant = withErrorHandling(
    async (room_id: string, user_id: number): Promise<boolean> => {
      const { rows } = await (await db()).query<{ ok: boolean }>(
        `SELECT true AS ok
         FROM chat_room_participants
         WHERE room_id = $1 AND user_id = $2
         LIMIT 1`,
        [room_id, user_id]
      );
      return Boolean(rows[0]?.ok);
    }
  );

  /**
   * Chat threads visible in the app for this identity.
   * @param participantRole When set, only rooms where the user joined with this role (buyer vs seller) — isolates customer vs vendor modes for the same account.
   */
  static listRoomsForUser = withErrorHandling(
    async (
      user_id: number,
      participantRole?: ParticipantRole
    ): Promise<ChatRoomRecord[]> => {
      if (participantRole === "buyer" || participantRole === "seller") {
        const { rows } = await (await db()).query<ChatRoomRecord>(
          `SELECT cr.id, cr.order_id, cr.initiator, cr.last_message, cr.created_at, cr.updated_at,
            (
              SELECT COUNT(*)::int
              FROM chat_messages m
              LEFT JOIN chat_message_reads r ON r.message_id = m.id AND r.user_id = $1
              WHERE m.room_id = cr.id AND m.sender <> $1 AND r.id IS NULL
            ) AS unread_count
           FROM chat_rooms cr
           INNER JOIN chat_room_participants p ON p.room_id = cr.id AND p.user_id = $1 AND p.role = $2
           ORDER BY cr.updated_at DESC`,
          [user_id, participantRole]
        );
        return rows;
      }
      const { rows } = await (await db()).query<ChatRoomRecord>(
        `SELECT cr.id, cr.order_id, cr.initiator, cr.last_message, cr.created_at, cr.updated_at,
          (
            SELECT COUNT(*)::int
            FROM chat_messages m
            LEFT JOIN chat_message_reads r ON r.message_id = m.id AND r.user_id = $1
            WHERE m.room_id = cr.id AND m.sender <> $1 AND r.id IS NULL
          ) AS unread_count
         FROM chat_rooms cr
         INNER JOIN chat_room_participants p ON p.room_id = cr.id AND p.user_id = $1
         ORDER BY cr.updated_at DESC`,
        [user_id]
      );
      return rows;
    }
  );

  /** Display name of the other party: shop name for buyers, customer name for sellers. */
  static getCounterpartName = withErrorHandling(
    async (
      room_id: string,
      user_id: number,
      participantRole?: ParticipantRole | null,
    ): Promise<string> => {
      const pool = await db();
      const role =
        participantRole === "buyer" || participantRole === "seller"
          ? participantRole
          : (await chatModel.getParticipantRole(room_id, user_id));

      const { rows: people } = await pool.query<{
        fname: string | null;
        lname: string | null;
        email: string | null;
      }>(
        `SELECT u.fname, u.lname, u.email
         FROM chat_room_participants op
         INNER JOIN users u ON u.id = op.user_id
         WHERE op.room_id = $1 AND op.user_id <> $2
         ORDER BY CASE op.role
           WHEN 'seller' THEN 0
           WHEN 'buyer' THEN 1
           ELSE 2
         END
         LIMIT 1`,
        [room_id, user_id],
      );
      const person = people[0];
      const personName = String(
        [person?.fname, person?.lname].filter(Boolean).join(" "),
      ).trim();
      const emailName = String(person?.email ?? "").split("@")[0]?.trim() ?? "";

      let shopName = "";
      if (role === "buyer") {
        try {
          const { rows: shops } = await pool.query<{ name: string | null }>(
            `SELECT s.name
             FROM chat_rooms cr
             INNER JOIN orders o ON o.id = cr.order_id
             LEFT JOIN shops s ON (
               s.id::text = TRIM(o.shop_id::text)
               OR s.ownerid = (
                 SELECT op.user_id FROM chat_room_participants op
                 WHERE op.room_id = cr.id AND op.role = 'seller'
                 LIMIT 1
               )
             )
             WHERE cr.id = $1
             LIMIT 1`,
            [room_id],
          );
          shopName = String(shops[0]?.name ?? "").trim();
        } catch {
          shopName = "";
        }
      }

      if (role === "buyer") return shopName || personName || emailName || "Seller";
      return personName || emailName || "Customer";
    },
  );

  /** Current user's participant role in a room (buyer / seller / admin). */
  static getParticipantRole = withErrorHandling(
    async (
      room_id: string,
      user_id: number
    ): Promise<ParticipantRole | null> => {
      const { rows } = await (await db()).query<{ role: ParticipantRole }>(
        `SELECT role FROM chat_room_participants
         WHERE room_id = $1 AND user_id = $2`,
        [room_id, user_id]
      );
      return rows[0]?.role ?? null;
    }
  );

  /** Rooms the buyer is in for an order id (checkout idempotent replay — buyer context only). */
  static listRoomsForUserByOrderId = withErrorHandling(
    async (user_id: number, order_id: number): Promise<ChatRoomRecord[]> => {
      const { rows } = await (await db()).query<ChatRoomRecord>(
        `SELECT cr.id, cr.order_id, cr.initiator, cr.last_message, cr.created_at, cr.updated_at
         FROM chat_rooms cr
         INNER JOIN chat_room_participants p ON p.room_id = cr.id AND p.user_id = $1 AND p.role = 'buyer'
         WHERE cr.order_id = $2
         ORDER BY cr.updated_at DESC`,
        [user_id, order_id]
      );
      return rows;
    }
  );

  static listMessages = withErrorHandling(
    async (
      room_id: string,
      user_id: number,
      limit: number
    ): Promise<ChatMessageRecord[]> => {
      const ok = await chatModel.isParticipant(room_id, user_id);
      if (!ok) {
        throw new Error("Not a participant of this room");
      }
      const lim = Math.min(Math.max(1, limit), 100);
      const { rows } = await (await db()).query<ChatMessageRecord>(
        `SELECT m.id, m.sender, m.room_id, m.type, m.content, m.created_at, m.updated_at,
            EXISTS (
              SELECT 1 FROM chat_message_reads r
              WHERE r.message_id = m.id AND r.user_id <> m.sender
            ) AS is_read
         FROM chat_messages m
         WHERE m.room_id = $1
         ORDER BY m.created_at DESC
         LIMIT $2`,
        [room_id, lim]
      );
      return rows.reverse();
    }
  );

  /** Recent text lines from one sender — oldest first (for moderation context). */
  static listRecentTextFromSender = withErrorHandling(
    async (
      room_id: string,
      sender_id: number,
      limit: number
    ): Promise<Pick<ChatMessageRecord, "content" | "created_at">[]> => {
      const lim = Math.min(Math.max(1, limit), 30);
      const { rows } = await (await db()).query<
        Pick<ChatMessageRecord, "content" | "created_at">
      >(
        `SELECT content, created_at
         FROM chat_messages
         WHERE room_id = $1
           AND sender = $2
           AND type = 'text'
           AND content IS NOT NULL
           AND length(trim(content)) > 0
         ORDER BY created_at DESC
         LIMIT $3`,
        [room_id, sender_id, lim]
      );
      return rows.reverse();
    }
  );

  static createMessage = withErrorHandling(
    async (input: {
      room_id: string;
      sender: number;
      type: "text" | "image" | "file" | "system";
      content?: string | null;
    }): Promise<ChatMessageRecord> => {
      const ok = await chatModel.isParticipant(input.room_id, input.sender);
      if (!ok) {
        throw new Error("Not a participant of this room");
      }
      const pool = await db();
      const { rows } = await pool.query<ChatMessageRecord>(
        `INSERT INTO chat_messages (sender, room_id, type, content)
         VALUES ($1, $2, $3, $4)
         RETURNING id, sender, room_id, type, content, created_at, updated_at`,
        [
          input.sender,
          input.room_id,
          input.type,
          input.content ?? null,
        ]
      );
      const msg = rows[0];
      if (!msg) {
        throw new Error("Failed to create message");
      }
      let preview = (input.content ?? "").slice(0, 500);
      try {
        const parsed = JSON.parse(String(input.content ?? ""));
        const kind = parsed && typeof parsed === "object" ? String(parsed.kind ?? parsed.type ?? "") : "";
        const title = String(parsed?.itemTitle ?? "").trim();
        const labels: Record<string, string> = {
          invoice: "Checkout invoice",
          invoice_request: "Checkout invoice requested",
          invoice_paid: "Order placed · Paid",
          invoice_cancelled: "Checkout invoice cancelled",
          shipping: "Shipping details",
          inquiry: "Product enquiry",
        };
        if (labels[kind]) {
          preview = title && kind !== "shipping" && kind !== "invoice_cancelled" ? `${labels[kind]}: ${title}` : labels[kind];
        }
      } catch {
        /* keep preview */
      }
      await pool.query(
        `UPDATE chat_rooms SET last_message = $2, updated_at = now() WHERE id = $1`,
        [input.room_id, preview]
      );
      return msg;
    }
  );

  static markRoomRead = withErrorHandling(
    async (room_id: string, user_id: number): Promise<void> => {
      const ok = await chatModel.isParticipant(room_id, user_id);
      if (!ok) return;
      await (await db()).query(
        `INSERT INTO chat_message_reads (message_id, user_id, read_at)
         SELECT m.id, $2, now()
         FROM chat_messages m
         WHERE m.room_id = $1 AND m.sender <> $2
         ON CONFLICT (message_id, user_id)
         DO UPDATE SET read_at = EXCLUDED.read_at`,
        [room_id, user_id]
      );
    }
  );

  static markMessageRead = withErrorHandling(
    async (message_id: string, user_id: number) => {
      const pool = await db();
      const { rows: msgRows } = await pool.query<{ room_id: string }>(
        `SELECT room_id AS room_id FROM chat_messages WHERE id = $1`,
        [message_id]
      );
      const room_id = msgRows[0]?.room_id;
      if (!room_id) {
        throw new Error("Message not found");
      }
      const ok = await chatModel.isParticipant(room_id, user_id);
      if (!ok) {
        throw new Error("Not a participant of this room");
      }
      const { rows } = await pool.query(
        `INSERT INTO chat_message_reads (message_id, user_id, read_at)
         VALUES ($1, $2, now())
         ON CONFLICT (message_id, user_id)
         DO UPDATE SET read_at = EXCLUDED.read_at
         RETURNING id, message_id, user_id, read_at`,
        [message_id, user_id]
      );
      return rows[0];
    }
  );

  static otherParticipantIds = withErrorHandling(
    async (room_id: string, except_user_id: number): Promise<number[]> => {
      const { rows } = await (await db()).query<{ user_id: number }>(
        `SELECT user_id FROM chat_room_participants
         WHERE room_id = $1 AND user_id <> $2`,
        [room_id, except_user_id]
      );
      return rows.map((r) => r.user_id);
    }
  );
}
