import Link from 'next/link';
import { getPool } from '../../../lib/db';
import {
  DetailRow,
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
  { label: 'Open', statuses: ['open'] },
  { label: 'Under review', statuses: ['pending', 'escalated', 'under_review', 'in_review'] },
  { label: 'Resolved', statuses: ['resolved', 'closed', 'won', 'lost', 'refunded'] },
];

const STOPPED_STATUSES = ['denied', 'dismissed', 'withdrawn'];

function urlsIn(value) {
  const found = new Set();
  const walk = (v) => {
    if (typeof v === 'string') {
      if (/^https?:\/\//.test(v)) found.add(v);
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(walk);
    }
  };
  walk(value);
  return [...found];
}

async function loadDispute(disputeId) {
  const pool = getPool();
  const { rows: [dispute] } = await pool.query(`SELECT * FROM disputes WHERE id = $1`, [disputeId]);
  if (!dispute) return null;

  const order = dispute.order_id
    ? (await pool.query(`SELECT * FROM orders WHERE id = $1`, [dispute.order_id])).rows[0] ?? null
    : null;

  const [parties, items] = await Promise.all([
    loadParties(pool, dispute.customer_id, order?.shop_id ?? null),
    order ? loadLineItems(pool, 'order_items', 'order_id', order.id) : [],
  ]);

  return { dispute, order, ...parties, items };
}

export default async function DisputeDetailPage({ params }) {
  const { id } = await params;
  const disputeId = parseInt(id ?? '', 10);
  if (Number.isNaN(disputeId)) {
    return (
      <div className="resource-page">
        <h1>Dispute details</h1>
        <p>Invalid dispute identifier.</p>
      </div>
    );
  }

  const data = await loadDispute(disputeId);
  if (!data) {
    return (
      <div className="resource-page">
        <Link className="back-link" href="/">&larr; Back to dashboard</Link>
        <h1>Dispute details</h1>
        <p>Dispute #{disputeId} was not found.</p>
      </div>
    );
  }

  const { dispute, order, buyer, shop, vendor, items } = data;
  const status = String(dispute.status ?? '').toLowerCase();
  const evidence = urlsIn(dispute.metadata);
  const response = dispute.response;

  return (
    <section className="resource-page review-page">
      <div className="resource-header review-header">
        <div>
          <Link className="back-link" href="/">&larr; Back to dashboard</Link>
          <span className="section-kicker">DISPUTE</span>
          <h1>Dispute {dispute.dispute_ref || `#${dispute.id}`}</h1>
          <p>
            Opened {formatDate(dispute.created_at)} by {humanize(dispute.source)} · Order{' '}
            {order ? <Link href={`/orders/${order.id}`}>#{order.id}</Link> : '—'}
          </p>
        </div>
        <div className="review-summary-card">
          <div>
            <span className="summary-label">Status</span>
            <span className={`status-pill ${['resolved', 'closed'].includes(status) ? 'status-verified' : 'status-pending'}`}>
              {humanize(status)}
            </span>
          </div>
          <div>
            <span className="summary-label">Order status</span>
            <span>{humanize(order?.fulfillment_status)}</span>
          </div>
          <div>
            <span className="summary-label">Last update</span>
            <span>{formatDate(dispute.updated_at)}</span>
          </div>
        </div>
      </div>

      <ProgressCard
        steps={PROGRESS_STEPS}
        status={status}
        stoppedStatuses={STOPPED_STATUSES}
        subtitle="Where this dispute is in the resolution flow."
      />

      <div className="review-grid">
        <div className="review-card">
          <div className="review-card-header">
            <div>
              <h2>Complaint</h2>
              <p className="review-card-subtitle">What was raised and any response.</p>
            </div>
          </div>
          <div className="review-card-body">
            <DetailRow label="Reason">{dispute.reason}</DetailRow>
            <DetailRow label="Description">{dispute.description}</DetailRow>
            <DetailRow label="Raised by">{humanize(dispute.source)}</DetailRow>
            {response ? (
              <>
                <hr className="order-detail-divider" />
                <DetailRow label="Response">
                  {typeof response === 'string'
                    ? response
                    : response.message ?? response.text ?? response.note ?? JSON.stringify(response)}
                </DetailRow>
              </>
            ) : null}
            {evidence.length ? (
              <>
                <hr className="order-detail-divider" />
                <span className="summary-label">Evidence</span>
                <div className="order-product-cell" style={{ flexWrap: 'wrap', marginTop: 8 }}>
                  {evidence.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      <img src={url} alt="Evidence" className="order-product-thumb" />
                    </a>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <PartyCards
          buyer={buyer}
          vendor={vendor}
          shop={shop}
          customerId={dispute.customer_id}
          shopId={order?.shop_id}
        />

        {order ? (
          <div className="review-card">
            <div className="review-card-header">
              <div>
                <h2>Order amounts</h2>
                <p className="review-card-subtitle">What is at stake in this dispute.</p>
              </div>
            </div>
            <div className="review-card-body">
              <DetailRow label="Order amount (goods)">{naira(order.amount_paid)}</DetailRow>
              <DetailRow label="Shipping fee">{naira(order.shipping_fee)}</DetailRow>
              <DetailRow label="Total paid">{naira(order.total_paid)}</DetailRow>
              <DetailRow label="Escrow status">{humanize(order.escrow_status)}</DetailRow>
            </div>
          </div>
        ) : null}
      </div>

      <ItemsTable items={items} title="Products in dispute" />
    </section>
  );
}
