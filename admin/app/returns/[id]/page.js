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
  loadLineItems,
  loadParties,
  naira,
} from '../../../lib/detailHelpers';
import '../../styles/style.css';

const PROGRESS_STEPS = [
  { label: 'Pending', statuses: ['return_initiated'] },
  { label: 'Accepted', statuses: ['return_accepted'] },
  { label: 'Processing', statuses: ['return_processing'] },
  { label: 'Shipping', statuses: ['return_shipping'] },
  { label: 'Out for pickup', statuses: ['return_out_for_delivery'] },
  { label: 'Delivered', statuses: ['return_delivered'] },
  { label: 'Confirmed', statuses: ['return_confirmed'] },
];

const STOPPED_STATUSES = ['return_cancelled', 'return_cancellation', 'return_rejected'];

async function loadReturn(returnId) {
  const pool = getPool();
  const { rows: [ret] } = await pool.query(`SELECT * FROM returns WHERE id = $1`, [returnId]);
  if (!ret) return null;

  const [parties, returnItems, orderRes, eventsRes] = await Promise.all([
    loadParties(pool, ret.customer_id, ret.shop_id),
    loadLineItems(pool, 'return_items', 'return_id', returnId),
    ret.order_id
      ? pool.query(`SELECT * FROM orders WHERE id::text = $1`, [String(ret.order_id)])
      : { rows: [] },
    pool.query(
      `SELECT id, stage, event_type, actor_type, actor_id, outcome, notes, meta, created_at
       FROM return_events WHERE return_id = $1 ORDER BY created_at ASC`,
      [returnId],
    ).catch(() => ({ rows: [] })),
  ]);

  const items = returnItems.length
    ? returnItems
    : ret.order_id
      ? await loadLineItems(pool, 'order_items', 'order_id', ret.order_id)
      : [];

  return {
    ret,
    ...parties,
    items,
    itemsFromOrder: returnItems.length === 0,
    order: orderRes.rows[0] ?? null,
    events: eventsRes.rows,
  };
}

export default async function ReturnDetailPage({ params }) {
  const { id } = await params;
  const returnId = parseInt(id ?? '', 10);
  if (Number.isNaN(returnId)) {
    return (
      <div className="resource-page">
        <h1>Return details</h1>
        <p>Invalid return identifier.</p>
      </div>
    );
  }

  const data = await loadReturn(returnId);
  if (!data) {
    return (
      <div className="resource-page">
        <Link className="back-link" href="/">&larr; Back to dashboard</Link>
        <h1>Return details</h1>
        <p>Return #{returnId} was not found.</p>
      </div>
    );
  }

  const { ret, buyer, shop, vendor, items, itemsFromOrder, order, events } = data;
  const status = String(ret.status ?? '').toLowerCase();
  const itemsValue = items.reduce((sum, item) => sum + Number(item.total_price ?? 0), 0);

  return (
    <section className="resource-page review-page">
      <div className="resource-header review-header">
        <div>
          <Link className="back-link" href="/">&larr; Back to dashboard</Link>
          <span className="section-kicker">RETURN</span>
          <h1>Return #{ret.id}</h1>
          <p>
            Requested {formatDate(ret.created_at)} · Order{' '}
            {ret.order_id ? <Link href={`/orders/${ret.order_id}`}>#{ret.order_id}</Link> : '—'}
          </p>
        </div>
        <div className="review-summary-card">
          <div>
            <span className="summary-label">Status</span>
            <span className={`status-pill ${status === 'return_confirmed' ? 'status-verified' : 'status-pending'}`}>
              {humanize(status)}
            </span>
          </div>
          <div>
            <span className="summary-label">Tracking</span>
            <span>{ret.tracking_number || '—'}</span>
          </div>
          <div>
            <span className="summary-label">ETA</span>
            <span>{ret.estimated_delivery_date || '—'}</span>
          </div>
        </div>
      </div>

      <ProgressCard
        steps={PROGRESS_STEPS}
        status={status}
        stoppedStatuses={STOPPED_STATUSES}
        subtitle="Where this return is in the return flow."
      />

      <div className="review-grid">
        <PartyCards
          buyer={buyer}
          vendor={vendor}
          shop={shop}
          customerId={ret.customer_id}
          shopId={ret.shop_id}
          shippingAddress={ret.shipping_address}
        />

        <div className="review-card">
          <div className="review-card-header">
            <div>
              <h2>Return amounts</h2>
              <p className="review-card-subtitle">Value of returned items and return shipping.</p>
            </div>
          </div>
          <div className="review-card-body">
            <DetailRow label="Returned items value">{naira(itemsValue)}</DetailRow>
            <DetailRow label="Return shipping fee">
              {ret.return_shipping_fee == null || ret.return_shipping_fee === '' ? '—' : naira(ret.return_shipping_fee)}
            </DetailRow>
            <DetailRow label="Shipping paid by">{humanize(ret.return_shipping_paid_by)}</DetailRow>
            <DetailRow label="Shipping method">{humanize(ret.shipping_method)}</DetailRow>
            {order ? (
              <>
                <hr className="order-detail-divider" />
                <DetailRow label="Original order total">{naira(order.total_paid)}</DetailRow>
                <DetailRow label="Order status">{humanize(order.fulfillment_status)}</DetailRow>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <ItemsTable
        items={items}
        title="Products returned"
        subtitle={itemsFromOrder ? 'No return items recorded; showing the original order items.' : undefined}
      />
      <EventsTable events={events} />
    </section>
  );
}
