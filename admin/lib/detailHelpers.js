export function naira(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function koboToNaira(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n / 100 : NaN;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('en-NG');
}

export function humanize(value) {
  const s = String(value ?? '').trim();
  if (!s) return '—';
  return s.replace(/^(order|return)_/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function fullName(person) {
  return [person?.fname, person?.lname].filter(Boolean).join(' ').trim() || '—';
}

export function firstImage(product) {
  const images = product?.images;
  if (Array.isArray(images) && images.length) {
    const first = images[0];
    return typeof first === 'string' ? first : first?.url ?? null;
  }
  if (typeof images === 'string' && images.startsWith('http')) return images;
  return product?.thumbnail_url ?? null;
}

export function addressText(value) {
  if (!value) return '—';
  if (typeof value === 'string') {
    try {
      return addressText(JSON.parse(value));
    } catch {
      return value;
    }
  }
  if (typeof value === 'object') {
    return value.address
      ?? [value.street, value.city, value.state, value.country].filter(Boolean).join(', ')
      ?? '—';
  }
  return String(value);
}

export function DetailRow({ label, children }) {
  return (
    <div className="order-detail-row">
      <span className="summary-label">{label}</span>
      <span className="order-detail-value">{children ?? '—'}</span>
    </div>
  );
}

/** Buyer, shop and shop owner for an order/return/dispute. */
export async function loadParties(pool, customerId, shopId) {
  const [buyerRes, shopRes] = await Promise.all([
    customerId == null
      ? { rows: [] }
      : pool.query(
          `SELECT id, fname, lname, email, phone, location, accountstatus, createdat
           FROM users WHERE id::text = $1`,
          [String(customerId)],
        ),
    shopId == null
      ? { rows: [] }
      : pool.query(`SELECT * FROM shops WHERE id::text = $1`, [String(shopId)]),
  ]);
  const shop = shopRes.rows[0] ?? null;
  const vendor = shop
    ? (await pool.query(
        `SELECT id, fname, lname, email, phone, accountstatus FROM users WHERE id = $1`,
        [shop.ownerid],
      )).rows[0] ?? null
    : null;
  return { buyer: buyerRes.rows[0] ?? null, shop, vendor };
}

/** Line items joined to product name/images. `table` is order_items or return_items. */
export async function loadLineItems(pool, table, parentColumn, parentId) {
  const { rows } = await pool.query(
    `SELECT i.id, i.item_id, i.units, i.unit_price, i.total_price,
            p.name, p.images, p.thumbnail_url
     FROM ${table} i
     LEFT JOIN products p ON p.id::text = i.item_id
     WHERE i.${parentColumn}::text = $1
     ORDER BY i.id`,
    [String(parentId)],
  ).catch(() => ({ rows: [] }));
  return rows;
}

export function PartyCards({ buyer, vendor, shop, customerId, shopId, shippingAddress }) {
  return (
    <>
      <div className="review-card">
        <div className="review-card-header">
          <div>
            <h2>Buyer</h2>
            <p className="review-card-subtitle">Customer on this order.</p>
          </div>
        </div>
        <div className="review-card-body">
          <DetailRow label="Name">{fullName(buyer)}</DetailRow>
          <DetailRow label="User ID">{buyer?.id ?? customerId}</DetailRow>
          <DetailRow label="Email">{buyer?.email}</DetailRow>
          <DetailRow label="Phone">{buyer?.phone}</DetailRow>
          <DetailRow label="Account">{humanize(buyer?.accountstatus)}</DetailRow>
          {shippingAddress !== undefined ? (
            <DetailRow label="Shipping address">{addressText(shippingAddress)}</DetailRow>
          ) : null}
        </div>
      </div>

      <div className="review-card">
        <div className="review-card-header">
          <div>
            <h2>Vendor</h2>
            <p className="review-card-subtitle">Owner of the shop.</p>
          </div>
        </div>
        <div className="review-card-body">
          <DetailRow label="Name">{fullName(vendor)}</DetailRow>
          <DetailRow label="User ID">{vendor?.id}</DetailRow>
          <DetailRow label="Email">{vendor?.email}</DetailRow>
          <DetailRow label="Phone">{vendor?.phone}</DetailRow>
          <DetailRow label="Account">{humanize(vendor?.accountstatus)}</DetailRow>
        </div>
      </div>

      <div className="review-card">
        <div className="review-card-header">
          <div>
            <h2>Shop</h2>
            <p className="review-card-subtitle">Storefront details.</p>
          </div>
          {shop ? (
            <span className={`status-pill ${shop.isverified ? 'status-verified' : 'status-pending'}`}>
              {shop.isverified ? 'Verified' : 'Unverified'}
            </span>
          ) : null}
        </div>
        <div className="review-card-body">
          <DetailRow label="Name">{shop?.name}</DetailRow>
          <DetailRow label="Shop ID">
            {shop ? <a href={`/shop-kyc/${shop.id}`}>{shop.id}</a> : shopId}
          </DetailRow>
          <DetailRow label="Slug">{shop?.slug}</DetailRow>
          <DetailRow label="Category">{shop?.category}</DetailRow>
          <DetailRow label="Status">{humanize(shop?.status)}</DetailRow>
          <DetailRow label="Contact email">{shop?.contactemail}</DetailRow>
          <DetailRow label="Contact phone">{shop?.contactphone}</DetailRow>
          <DetailRow label="Address">{addressText(shop?.location)}</DetailRow>
        </div>
      </div>
    </>
  );
}

export function ProgressCard({ steps, status, stoppedStatuses = [], subtitle }) {
  const stopped = stoppedStatuses.includes(status);
  const current = steps.findIndex((step) => step.statuses.includes(status));
  return (
    <div className="review-card order-progress-card">
      <div className="review-card-header">
        <div>
          <h2>Progress</h2>
          <p className="review-card-subtitle">
            {stopped ? `This is ${humanize(status).toLowerCase()}.` : subtitle}
          </p>
        </div>
      </div>
      <ol className="order-progress">
        {steps.map((step, index) => {
          const state = stopped || current < 0
            ? ''
            : index < current ? 'done' : index === current ? 'active' : '';
          return (
            <li key={step.label} className={`order-progress-step ${state}`}>
              <span className="order-progress-dot">{index + 1}</span>
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ItemsTable({ items, title = 'Products', subtitle }) {
  return (
    <div className="review-card">
      <div className="review-card-header">
        <div>
          <h2>{title}</h2>
          <p className="review-card-subtitle">
            {subtitle ?? `${items.length} line item${items.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>
      <div className="resource-table-card">
        <table className="resource-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Product ID</th>
              <th>Units</th>
              <th>Unit price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const image = firstImage(item);
              return (
                <tr key={item.id}>
                  <td>
                    <div className="order-product-cell">
                      {image ? <img src={image} alt="" className="order-product-thumb" /> : null}
                      <span>{item.name || 'Deleted product'}</span>
                    </div>
                  </td>
                  <td>{item.item_id}</td>
                  <td>{item.units}</td>
                  <td>{naira(item.unit_price)}</td>
                  <td>{naira(item.total_price)}</td>
                </tr>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">No items recorded.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EventsTable({ events }) {
  return (
    <div className="review-card">
      <div className="review-card-header">
        <div>
          <h2>Activity</h2>
          <p className="review-card-subtitle">Every recorded event.</p>
        </div>
      </div>
      <div className="resource-table-card">
        <table className="resource-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Stage</th>
              <th>By</th>
              <th>Outcome</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{formatDate(event.created_at)}</td>
                <td>{humanize(event.stage)}</td>
                <td>{humanize(event.actor_type)}{event.actor_id ? ` #${event.actor_id}` : ''}</td>
                <td>{humanize(event.outcome)}</td>
                <td>{event.notes || event.meta?.reason || '—'}</td>
              </tr>
            ))}
            {events.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty-row">No events recorded.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
