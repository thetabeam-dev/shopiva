import Link from 'next/link';
import { getPool } from '../../../lib/db';
import {
  DetailRow,
  EventsTable,
  ItemsTable,
  PartyCards,
  ProgressCard,
  formatDate,
  humanize,
  koboToNaira,
  loadLineItems,
  loadParties,
  naira,
} from '../../../lib/detailHelpers';
import '../../styles/style.css';

/** Must match ORDER_COMMISSION_RATE in node/src/socket/order.ts. */
const COMMISSION_RATE = 0.03;

const PROGRESS_STEPS = [
  { label: 'Pending', statuses: ['unpaid', 'payment_received'] },
  { label: 'Accepted', statuses: ['order_accepted'] },
  { label: 'Processing', statuses: ['order_processing'] },
  { label: 'Shipping', statuses: ['order_shipping'] },
  { label: 'Out for pickup', statuses: ['order_out_for_delivery'] },
  { label: 'Delivered', statuses: ['order_delivered'] },
  { label: 'Confirmed', statuses: ['order_confirmed'] },
  { label: 'Completed', statuses: ['order_completed'] },
];

const STOPPED_STATUSES = ['order_cancelled', 'order_rejected', 'order_disputed'];

async function loadOrder(orderId) {
  const pool = getPool();
  const { rows: [order] } = await pool.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!order) return null;

  const [parties, items, escrowRes, eventsRes] = await Promise.all([
    loadParties(pool, order.customer_id, order.shop_id),
    loadLineItems(pool, 'order_items', 'order_id', orderId),
    pool.query(`SELECT * FROM escrow_transactions WHERE order_id = $1 LIMIT 1`, [orderId]).catch(() => ({ rows: [] })),
    pool.query(
      `SELECT id, stage, event_type, actor_type, actor_id, outcome, notes, meta, created_at
       FROM order_events WHERE order_id = $1 ORDER BY created_at ASC`,
      [orderId],
    ),
  ]);

  return { order, ...parties, items, escrow: escrowRes.rows[0] ?? null, events: eventsRes.rows };
}

export default async function OrderDetailPage({ params }) {
  const { id } = await params;
  const orderId = parseInt(id ?? '', 10);
  if (Number.isNaN(orderId)) {
    return (
      <div className="resource-page">
        <h1>Order details</h1>
        <p>Invalid order identifier.</p>
      </div>
    );
  }

  const data = await loadOrder(orderId);
  if (!data) {
    return (
      <div className="resource-page">
        <Link className="back-link" href="/">&larr; Back to dashboard</Link>
        <h1>Order details</h1>
        <p>Order #{orderId} was not found.</p>
      </div>
    );
  }

  const { order, buyer, shop, vendor, items, escrow, events } = data;
  const status = String(order.fulfillment_status ?? '').toLowerCase();

  const goods = Number(order.amount_paid ?? 0);
  const shippingPending = ['', 'unpaid', 'payment_received'].includes(status);
  const shipping = Number(order.shipping_fee ?? 0);
  const escrowFee = escrow ? koboToNaira(escrow.fee_kobo) : 0;
  const completedMeta = events.find((e) => e.stage === 'order_completed')?.meta ?? null;
  const commission = Number.isFinite(Number(completedMeta?.commission_naira))
    ? Number(completedMeta.commission_naira)
    : Math.round(goods * COMMISSION_RATE * 100) / 100;
  const buyerTotal = goods + (shippingPending ? 0 : shipping) + (Number.isFinite(escrowFee) ? escrowFee : 0);
  const vendorReceives = goods + (shippingPending ? 0 : shipping) - commission;

  return (
    <section className="resource-page review-page">
      <div className="resource-header review-header">
        <div>
          <Link className="back-link" href="/">&larr; Back to dashboard</Link>
          <span className="section-kicker">ORDER</span>
          <h1>Order #{order.id}</h1>
          <p>Placed {formatDate(order.created_at)} · Ref {order.payment_reference || '—'}</p>
        </div>
        <div className="review-summary-card">
          <div>
            <span className="summary-label">Fulfillment</span>
            <span className={`status-pill ${status === 'order_completed' ? 'status-verified' : 'status-pending'}`}>
              {humanize(status)}
            </span>
          </div>
          <div>
            <span className="summary-label">Payment</span>
            <span>{humanize(order.payment_status)}</span>
          </div>
          <div>
            <span className="summary-label">Escrow</span>
            <span>{humanize(escrow?.status ?? order.escrow_status)}</span>
          </div>
        </div>
      </div>

      <ProgressCard
        steps={PROGRESS_STEPS}
        status={status}
        stoppedStatuses={STOPPED_STATUSES}
        subtitle="Where this order is in the fulfillment flow."
      />

      <div className="review-grid">
        <PartyCards
          buyer={buyer}
          vendor={vendor}
          shop={shop}
          customerId={order.customer_id}
          shopId={order.shop_id}
          shippingAddress={order.shipping_address}
        />

        <div className="review-card">
          <div className="review-card-header">
            <div>
              <h2>Payment breakdown</h2>
              <p className="review-card-subtitle">What the buyer paid and what the vendor receives.</p>
            </div>
          </div>
          <div className="review-card-body">
            <DetailRow label="Order amount (goods)">{naira(goods)}</DetailRow>
            <DetailRow label="Shipping fee">{shippingPending ? 'Pending' : naira(shipping)}</DetailRow>
            <DetailRow label="Escrow charge (buyer)">{escrow ? naira(escrowFee) : '—'}</DetailRow>
            <DetailRow label="Buyer paid in total"><strong>{naira(buyerTotal)}</strong></DetailRow>
            <DetailRow label="Recorded total (goods + shipping)">{naira(order.total_paid)}</DetailRow>
            <hr className="order-detail-divider" />
            <DetailRow label={`App commission (vendor, ${COMMISSION_RATE * 100}% of goods)`}>
              -{naira(commission)}
            </DetailRow>
            <DetailRow label={status === 'order_completed' ? 'Vendor received' : 'Vendor will receive'}>
              <strong>{shippingPending ? `${naira(vendorReceives)} + shipping` : naira(vendorReceives)}</strong>
            </DetailRow>
            {escrow ? (
              <>
                <hr className="order-detail-divider" />
                <DetailRow label="Escrow held">{naira(koboToNaira(escrow.amount_held_kobo))}</DetailRow>
                <DetailRow label="Escrow released">{naira(koboToNaira(escrow.amount_released_kobo))}</DetailRow>
                <DetailRow label="Escrow refunded">{naira(koboToNaira(escrow.amount_refunded_kobo))}</DetailRow>
              </>
            ) : (
              <p className="empty-note">No escrow record for this order.</p>
            )}
          </div>
        </div>
      </div>

      <ItemsTable items={items} title="Products purchased" />
      <EventsTable events={events} />
    </section>
  );
}
