import { connectChatSocket, emitChatSocketAck } from '../socket/chatSocket';

/**
 * Posts an `invoice_paid` card to the pre-order chat so both sides see the invoice as paid
 * and the buyer gets a "View order" shortcut. The order is resolved later by payment reference.
 * @param {{ roomId?: string; invoiceMessageId?: string; reference: string; lines: Array<{ title: string; image?: string; qty: number; unitPrice: number; productId?: number }>; total: number }} p
 */
export async function postChatInvoicePaid({ roomId, invoiceMessageId, reference, lines, total }) {
  const rid = String(roomId ?? '').trim();
  if (!rid || !reference) return;
  const first = lines?.[0];
  try {
    await connectChatSocket();
    await emitChatSocketAck('create_message', {
      room_id: rid,
      type: 'system',
      content: JSON.stringify({
        kind: 'invoice_paid',
        invoiceMessageId: invoiceMessageId || undefined,
        reference,
        itemTitle: first?.title || 'Product',
        itemImage: first?.image || undefined,
        productId: first?.productId || undefined,
        qty: (lines ?? []).reduce((sum, line) => sum + (Number(line.qty) || 0), 0) || 1,
        total: Number(total) || 0,
      }),
      app_role: 'customer',
    });
  } catch {
    /* payment already succeeded; the chat card is best-effort */
  }
}
