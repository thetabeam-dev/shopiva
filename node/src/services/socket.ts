import type { Namespace } from "socket.io";
import type { Socket } from "socket.io";
import {
  handleCreateMessage,
  handleCreateRoom,
  handleGetRoomMessages,
  handleGetRooms,
  handleMarkMessageRead,
  handleTyping,
} from "../socket/chat.js";
import { handleDisputeEscalation, handleDisputeResponse, handleNewDispute } from "../socket/dispute.js";
import { handleOrderAcceptance, handleOrderCancellation, handleOrderConfirmation, handleOrderDelivered, handleOrderOutForDelivery, handleOrderProcessing, handleOrderReleaseFunds, handleOrderShipping } from "../socket/order.js";
import { handleReturnAcceptance, handleReturnCancellation, handleReturnConfirmation, handleReturnDelivered, handleReturnOutForDelivery, handleReturnProcessing, handleReturnShipping } from "../socket/return.js";

type SocketWithAuth = Socket & {
  user?: { id: string };
  data?: { userId?: number; email?: string | null };
};

export default function handleSocketConnection(client: SocketWithAuth) {
  const raw =
    client.data?.userId ??
    (client.user?.id != null ? Number(client.user.id) : undefined);
  const userId = typeof raw === "number" && Number.isFinite(raw) ? raw : NaN;

  if (!Number.isFinite(userId)) {
    client.emit("error", { message: "Unauthorized socket connection" });
    client.disconnect(true);
    return;
  }

  client.join(`user:${userId}`);

  const nsp = client.nsp as Namespace;

  const asPayload = (p: unknown): Record<string, unknown> =>
    p != null && typeof p === "object" ? (p as Record<string, unknown>) : {};

  client.on("create_message", wrapSocketHandler((p, a) =>
    handleCreateMessage(userId, nsp, asPayload(p), a)
  ));
  client.on("create_room", wrapSocketHandler((p, a) =>
    handleCreateRoom(userId, nsp, asPayload(p), a)
  ));
  client.on("typing", wrapSocketHandler((p, a) =>
    handleTyping(userId, nsp, asPayload(p), a)
  ));
  client.on("get_rooms", wrapSocketHandler((p, a) =>
    handleGetRooms(userId, nsp, p, a)
  ));
  client.on("get_room_messages", wrapSocketHandler((p, a) =>
    handleGetRoomMessages(userId, nsp, asPayload(p), a)
  ));
  client.on("mark_message_as_read", wrapSocketHandler((p, a) =>
    handleMarkMessageRead(userId, nsp, asPayload(p), a)
  ));

  // order updates
  client.on("order_acceptance", wrapSocketHandler((p, a) =>
    handleOrderAcceptance(userId, nsp, asPayload(p), a)
  ));
  client.on("order_processing", wrapSocketHandler((p, a) =>
    handleOrderProcessing(userId, nsp, asPayload(p), a)
  ));
  client.on("order_shipping", wrapSocketHandler((p, a) =>
    handleOrderShipping(userId, nsp, asPayload(p), a)
  ));
  client.on("order_out_for_delivery", wrapSocketHandler((p, a) =>
    handleOrderOutForDelivery(userId, nsp, asPayload(p), a)
  ));
  client.on("order_delivered", wrapSocketHandler((p, a) =>
    handleOrderDelivered(userId, nsp, asPayload(p), a)
  ));
  client.on("order_cancelled", wrapSocketHandler((p, a) =>
    handleOrderCancellation(userId, nsp, asPayload(p), a)
  ));
  client.on("order_confirmed", wrapSocketHandler((p, a) =>
    handleOrderConfirmation(userId, nsp, asPayload(p), a)
  ));
  client.on("order_release_funds", wrapSocketHandler((p, a) =>
    handleOrderReleaseFunds(userId, nsp, asPayload(p), a)
  ));

  // return updates
  client.on("return_acceptance", wrapSocketHandler((p, a) =>
    handleReturnAcceptance(userId, nsp, asPayload(p), a)
  ));
  client.on("return_processing", wrapSocketHandler((p, a) =>
    handleReturnProcessing(userId, nsp, asPayload(p), a)
  ));
  client.on("return_shipping", wrapSocketHandler((p, a) =>
    handleReturnShipping(userId, nsp, asPayload(p), a)
  ));
  client.on("return_out_for_delivery", wrapSocketHandler((p, a) =>
    handleReturnOutForDelivery(userId, nsp, asPayload(p), a)
  ));
  client.on("return_delivered", wrapSocketHandler((p, a) =>
    handleReturnDelivered(userId, nsp, asPayload(p), a)
  ));
  client.on("return_cancelled", wrapSocketHandler((p, a) =>
    handleReturnCancellation(userId, nsp, asPayload(p), a)
  ));
  client.on("return_confirmed", wrapSocketHandler((p, a) =>
    handleReturnConfirmation(userId, nsp, asPayload(p), a)
  ));

  // disputes
  client.on("raise_dispute", wrapSocketHandler((p, a) =>
    handleNewDispute(userId, nsp, asPayload(p), a)
  ));
  client.on("dispute_acceptance", wrapSocketHandler((p, a) =>
    handleDisputeResponse(userId, nsp, asPayload(p), a)
  ));
  client.on("dispute_escalation", wrapSocketHandler((p, a) =>
    handleDisputeEscalation(userId, nsp, asPayload(p), a)
  ));



  function wrapSocketHandler(
    handler: (payload: unknown, ack?: unknown) => Promise<void>
  ) {
    return async (payload: unknown, ack?: unknown) => {
      try {
        await handler(payload, ack);
      } catch (error) {
        console.error("Error during socket event handling:", error);
        const msg =
          error instanceof Error ? error.message : "An error occurred";
        if (typeof ack === "function") {
          ack({
            success: false,
            message: msg,
            error: msg,
            result: null,
            others: null
          });
        }
      }
    };
  }
}
