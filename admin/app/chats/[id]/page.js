import Link from 'next/link';
import { getPool } from '../../../lib/db';
import { parseChatCard, previewChatContent } from '../../../lib/chatPreview';
import '../../styles/style.css';

function participantName(user) {
  if (!user) return 'Unknown';
  return [user.fname, user.lname].filter(Boolean).join(' ').trim() || user.email || `User #${user.id}`;
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function timeLabel(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatShippingAddress(shipping) {
  if (!shipping || typeof shipping !== 'object') return '';
  return [
    shipping.street,
    shipping.area1 ?? shipping.junction,
    shipping.area2,
    shipping.city,
    shipping.state,
    shipping.zip,
  ]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(', ');
}

function shippingDetailLines(shipping) {
  if (!shipping || typeof shipping !== 'object') return [];
  const area1 = String(shipping.area1 ?? shipping.junction ?? '').trim();
  const area2 = String(shipping.area2 ?? '').trim();
  return [
    ['state', String(shipping.state ?? '').trim()],
    ['city', String(shipping.city ?? '').trim()],
    ['street', String(shipping.street ?? '').trim()],
    ['Area 1 (junction)', area1],
    ['Area 2 (any other details)', area2],
  ].filter(([, value]) => Boolean(value));
}

function Bubble({ message, outgoing, viewerIsVendor }) {
  const card = parseChatCard(message.content);
  const kind = String(card?.kind ?? '').toLowerCase();
  const time = timeLabel(message.created_at);
  const cls = outgoing ? 'wa-out' : 'wa-in';

  if (kind === 'inquiry') return null;

  if (kind === 'invoice_request' || kind === 'invoice_request_declined') {
    const declined = kind === 'invoice_request_declined';
    const image = String(card.itemImage ?? '').trim();
    const destination = formatShippingAddress(card.shippingAddress);
    return (
      <div className={`wa-row ${outgoing ? 'wa-row-out' : 'wa-row-in'}`}>
        <div className={`wa-tpl ${cls}`}>
          <div className="wa-tpl-body">
            <div className="wa-kicker">
              {viewerIsVendor ? 'Buyer requested a checkout invoice' : 'You requested a checkout invoice'}
            </div>
            <div className="wa-product">
              {image ? <img src={image} alt="" /> : <div className="wa-product-ph" />}
              <div>
                <strong>{String(card.itemTitle || 'Product')}</strong>
                <span>
                  Qty {Math.max(1, Number(card.qty) || 1)}
                  {Number(card.itemAmount) > 0 ? ` · ${formatMoney(card.itemAmount)} each` : ''}
                </span>
              </div>
            </div>
            {destination ? <p className="wa-line">{`Ship to: ${destination}`}</p> : null}
            {declined ? (
              <p className="wa-status wa-status-danger">
                {viewerIsVendor ? 'You declined this invoice request.' : 'Vendor declined this invoice request.'}
              </p>
            ) : null}
            <span className="wa-time">{time}</span>
          </div>
          {viewerIsVendor && !declined ? (
            <>
              <div className="wa-rule" />
              <div className="wa-action wa-action-primary">Create Invoice</div>
              <div className="wa-rule" />
              <div className="wa-action wa-action-danger">Decline Invoice</div>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  if (kind === 'invoice_paid') {
    const image = String(card.itemImage ?? '').trim();
    const qty = Math.max(1, Number(card.qty) || 1);
    return (
      <div className={`wa-row ${outgoing ? 'wa-row-out' : 'wa-row-in'}`}>
        <div className={`wa-tpl ${cls}`}>
          <div className="wa-tpl-body">
            <div className="wa-paid-badge">Order placed · Paid</div>
            <div className="wa-product">
              {image ? <img src={image} alt="" /> : <div className="wa-product-ph" />}
              <div>
                <strong>{String(card.itemTitle || 'Product')}</strong>
                <span>{`Qty ${qty} · ${formatMoney(card.total)}`}</span>
              </div>
            </div>
            <span className="wa-time">{time}</span>
          </div>
          <div className="wa-rule" />
          <div className="wa-action">View order</div>
        </div>
      </div>
    );
  }

  if (kind === 'shipping') {
    return (
      <div className={`wa-row ${outgoing ? 'wa-row-out' : 'wa-row-in'}`}>
        <div className={`wa-ship ${outgoing ? 'wa-ship-out' : ''}`}>
          <div className="wa-kicker">{outgoing ? 'Shipping details sent' : 'Buyer shipping details'}</div>
          {shippingDetailLines(card).map(([label, value]) => (
            <p key={label} className="wa-line">{`${label}: ${value}`}</p>
          ))}
          <span className="wa-time">{time}</span>
        </div>
      </div>
    );
  }

  if (kind === 'invoice' || kind === 'invoice_cancelled') {
    const invoiceQty = Math.max(1, Number(card.qty) || 1);
    const unitAmount = Number(card.amount) || 0;
    const amount = unitAmount * invoiceQty;
    const shippingFee = Number(card.shipping) || 0;
    const total = amount + shippingFee;
    const logistics = String(card.logistics ?? '').trim();
    const delivery = String(card.deliveryTime ?? card.delivery_time ?? '').trim();
    const destination = String(card.destination ?? '').trim() || formatShippingAddress(card.shippingAddress);
    const itemsValue =
      invoiceQty > 1
        ? `${invoiceQty} × ${formatMoney(unitAmount)} = ${formatMoney(amount)}`
        : formatMoney(amount);
    const rows = [
      ['Total', formatMoney(total)],
      destination ? ['Ship to', destination] : null,
      ['Items', itemsValue],
      ['Shipping', formatMoney(shippingFee)],
      logistics ? ['Logistics', logistics] : null,
      delivery ? ['Delivery', delivery] : null,
    ].filter(Boolean);
    const cancelled = kind === 'invoice_cancelled';
    const canPay = !viewerIsVendor && !cancelled;
    return (
      <div className={`wa-row ${outgoing ? 'wa-row-out' : 'wa-row-in'}`}>
        <div className={`wa-tpl ${cls}`}>
          <div className="wa-tpl-body">
            <div className="wa-kicker">Checkout invoice</div>
            {rows.map(([label, value]) => (
              <div key={label} className="wa-field">
                <span>{label}</span>
                <strong className={label === 'Total' ? 'wa-total' : undefined}>{value}</strong>
              </div>
            ))}
            <span className="wa-time">{time}</span>
          </div>
          {cancelled ? (
            <>
              <div className="wa-rule" />
              <p className="wa-status wa-status-danger">
                {viewerIsVendor ? 'Buyer cancelled this invoice.' : 'You cancelled this invoice.'}
              </p>
            </>
          ) : canPay ? (
            <>
              <div className="wa-rule" />
              <div className="wa-action">Pay now</div>
              <div className="wa-rule" />
              <div className="wa-action wa-action-danger">Cancel order</div>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`wa-row ${outgoing ? 'wa-row-out' : 'wa-row-in'}`}>
      <div className={`wa-bubble ${cls}`}>
        <p>{previewChatContent(message.content) || '—'}</p>
        <div className={`wa-meta ${outgoing ? 'wa-meta-out' : ''}`}>
          <span>{time}</span>
          {outgoing ? <span className="wa-ticks">✓✓</span> : null}
        </div>
      </div>
    </div>
  );
}

function PhoneChat({ title, subtitle, messages, perspectiveId, viewerIsVendor }) {
  return (
    <section className="wa-phone">
      <header className="wa-header">
        <span className="wa-back">‹</span>
        <div>
          <strong>{title}</strong>
          {subtitle ? <small>{subtitle}</small> : null}
        </div>
      </header>
      <div className="wa-screen">
        {messages.length ? (
          messages.map((message) => (
            <Bubble
              key={`${viewerIsVendor ? 'v' : 'c'}-${message.id}`}
              message={message}
              outgoing={Number(message.sender) === Number(perspectiveId)}
              viewerIsVendor={viewerIsVendor}
            />
          ))
        ) : (
          <p className="wa-empty">No messages yet. Say hello.</p>
        )}
      </div>
      <div className="wa-composer">
        <div className="wa-input">Message</div>
        <div className="wa-send">➤</div>
      </div>
    </section>
  );
}

async function loadChat(roomId) {
  const pool = getPool();
  const { rows: [room] } = await pool.query(
    `SELECT id, order_id, initiator, last_message, created_at, updated_at
     FROM chat_rooms WHERE id = $1`,
    [roomId],
  );
  if (!room) return null;

  const [{ rows: participants }, { rows: messages }] = await Promise.all([
    pool.query(
      `SELECT p.user_id, p.role, p.joined_at, u.fname, u.lname, u.email, u.phone
       FROM chat_room_participants p
       LEFT JOIN users u ON u.id = p.user_id
       WHERE p.room_id = $1
       ORDER BY p.joined_at`,
      [roomId],
    ),
    pool.query(
      `SELECT m.id, m.sender, m.type, m.content, m.created_at, p.role
       FROM chat_messages m
       LEFT JOIN chat_room_participants p
         ON p.room_id = m.room_id AND p.user_id = m.sender
       WHERE m.room_id = $1
       ORDER BY m.created_at ASC
       LIMIT 500`,
      [roomId],
    ),
  ]);

  const buyer = participants.find((row) => row.role === 'buyer') ?? null;
  const seller = participants.find((row) => row.role === 'seller') ?? null;
  let shop = null;
  if (seller?.user_id) {
    const shopRes = await pool.query(
      `SELECT id, name, slug FROM shops WHERE ownerid = $1 ORDER BY id LIMIT 1`,
      [seller.user_id],
    );
    shop = shopRes.rows[0] ?? null;
  }

  const visible = messages.filter((row) => {
    const kind = String(parseChatCard(row.content)?.kind ?? '').toLowerCase();
    return kind !== 'inquiry';
  });

  return { room, participants, messages: visible, buyer, seller, shop };
}

export default async function ChatDetailPage({ params }) {
  const { id } = await params;
  const roomId = String(id ?? '').trim();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(roomId)) {
    return (
      <div className="resource-page">
        <h1>Chat room</h1>
        <p>Invalid chat identifier.</p>
      </div>
    );
  }

  const data = await loadChat(roomId);
  if (!data) {
    return (
      <div className="resource-page">
        <Link className="back-link" href="/">&larr; Back to dashboard</Link>
        <h1>Chat room</h1>
        <p>This chat room was not found.</p>
      </div>
    );
  }

  const { room, buyer, seller, shop, messages } = data;
  const buyerName = participantName(buyer);
  const sellerName = shop?.name || participantName(seller);

  return (
    <div className="resource-page">
      <Link className="back-link" href="/">&larr; Back to dashboard</Link>
      <div className="resource-header">
        <div>
          <h1>Chat room</h1>
          <p>
            Same layout as the app. Left is the customer screen, right is the vendor screen.
            {room.order_id > 0 ? ` Order #${room.order_id}.` : ''}
          </p>
        </div>
      </div>

      <div className="wa-pair">
        <PhoneChat
          title={sellerName}
          subtitle="Customer view"
          messages={messages}
          perspectiveId={buyer?.user_id}
          viewerIsVendor={false}
        />
        <PhoneChat
          title={buyerName}
          subtitle="Vendor view"
          messages={messages}
          perspectiveId={seller?.user_id}
          viewerIsVendor
        />
      </div>
    </div>
  );
}
