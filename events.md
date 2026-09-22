ORDER PAYMENT EVENTS
Payment Received
const orderEvent = {
  order_id: orderId,
  event_type: 'payment',
  stage: 'payment_received',
  actor_type: 'customer' as const,
  actor_id: customer_id || paystackData.customer.email,
  outcome: 'success' as const,
  notes: `Payment received via Paystack - Reference: ${reference}`,
  meta: JSON.stringify({
    channel: paystackData.channel,
    paystack_charge_id: paystackData.id,
    paid_at: paystackData.paid_at
  })
};
Payment Failed
const orderEvent = {
  order_id: orderId,
  event_type: 'payment',
  stage: 'payment_failed',
  actor_type: 'customer' as const,
  actor_id: customer_id,
  outcome: 'failed' as const,
  notes: 'Customer payment attempt failed',
  meta: JSON.stringify({
    reference,
    gateway_response: paystackData.gateway_response
  })
};


VENDOR ACCEPTANCE EVENTS
Vendor Accepted Order
const orderEvent = {
  order_id: orderId,
  event_type: 'vendor_action',
  stage: 'order_accepted',
  actor_type: 'vendor' as const,
  actor_id: vendor_id,
  outcome: 'success' as const,
  notes: 'Vendor accepted the order for fulfillment',
  meta: JSON.stringify({
    accepted_at: new Date(),
    estimated_processing_time: '24_hours'
  })
};
Vendor Rejected Order
const orderEvent = {
  order_id: orderId,
  event_type: 'vendor_action',
  stage: 'order_rejected',
  actor_type: 'vendor' as const,
  actor_id: vendor_id,
  outcome: 'cancelled' as const,
  notes: 'Vendor rejected the order',
  meta: JSON.stringify({
    rejection_reason: 'out_of_stock',
    rejected_at: new Date()
  })
};
Vendor Acceptance Timeout
const orderEvent = {
  order_id: orderId,
  event_type: 'vendor_action',
  stage: 'acceptance_timeout',
  actor_type: 'system' as const,
  actor_id: 'system',
  outcome: 'cancelled' as const,
  notes: 'Vendor failed to accept order within allowed timeframe',
  meta: JSON.stringify({
    timeout_hours: 2
  })
};


ORDER PROCESSING EVENTS
Vendor Started Processing
const orderEvent = {
  order_id: orderId,
  event_type: 'processing',
  stage: 'processing_started',
  actor_type: 'vendor' as const,
  actor_id: vendor_id,
  outcome: 'success' as const,
  notes: 'Vendor started preparing the order',
  meta: JSON.stringify({
    started_at: new Date()
  })
};
Order Packed
const orderEvent = {
  order_id: orderId,
  event_type: 'processing',
  stage: 'order_packed',
  actor_type: 'vendor' as const,
  actor_id: vendor_id,
  outcome: 'success' as const,
  notes: 'Order has been packed and is ready for shipment',
  meta: JSON.stringify({
    packed_at: new Date()
  })
};


SHIPPING EVENTS
Shipment Created
const orderEvent = {
  order_id: orderId,
  event_type: 'shipping',
  stage: 'shipment_created',
  actor_type: 'vendor' as const,
  actor_id: vendor_id,
  outcome: 'success' as const,
  notes: 'Vendor created shipment for order',
  meta: JSON.stringify({
    courier: 'GIG Logistics',
    tracking_number: trackingNumber
  })
};
Order Shipped
const orderEvent = {
  order_id: orderId,
  event_type: 'shipping',
  stage: 'order_shipped',
  actor_type: 'vendor' as const,
  actor_id: vendor_id,
  outcome: 'success' as const,
  notes: 'Vendor shipped the order',
  meta: JSON.stringify({
    tracking_number: trackingNumber,
    shipped_at: new Date()
  })
};
Logistics Picked Up Order
const orderEvent = {
  order_id: orderId,
  event_type: 'shipping',
  stage: 'picked_up',
  actor_type: 'logistics' as const,
  actor_id: rider_id,
  outcome: 'success' as const,
  notes: 'Logistics partner picked up the order',
  meta: JSON.stringify({
    pickup_time: new Date()
  })
};
In Transit
const orderEvent = {
  order_id: orderId,
  event_type: 'shipping',
  stage: 'in_transit',
  actor_type: 'logistics' as const,
  actor_id: rider_id,
  outcome: 'pending' as const,
  notes: 'Order is currently in transit',
  meta: JSON.stringify({
    current_location: 'Lagos Hub'
  })
};
Delivery Delayed
const orderEvent = {
  order_id: orderId,
  event_type: 'shipping',
  stage: 'delivery_delayed',
  actor_type: 'logistics' as const,
  actor_id: rider_id,
  outcome: 'pending' as const,
  notes: 'Delivery delayed due to logistics issue',
  meta: JSON.stringify({
    reason: 'bad_weather'
  })
};


DELIVERY EVENTS
Out For Delivery
const orderEvent = {
  order_id: orderId,
  event_type: 'delivery',
  stage: 'out_for_delivery',
  actor_type: 'logistics' as const,
  actor_id: rider_id,
  outcome: 'pending' as const,
  notes: 'Order is out for delivery',
  meta: JSON.stringify({
    dispatched_at: new Date()
  })
};
Order Delivered
const orderEvent = {
  order_id: orderId,
  event_type: 'delivery',
  stage: 'delivered',
  actor_type: 'logistics' as const,
  actor_id: rider_id,
  outcome: 'success' as const,
  notes: 'Order delivered successfully',
  meta: JSON.stringify({
    delivered_at: new Date(),
    proof_of_delivery: deliveryPhoto
  })
};
Customer Confirmed Delivery
const orderEvent = {
  order_id: orderId,
  event_type: 'delivery',
  stage: 'delivery_confirmed',
  actor_type: 'customer' as const,
  actor_id: customer_id,
  outcome: 'success' as const,
  notes: 'Customer confirmed successful delivery',
  meta: JSON.stringify({
    confirmed_at: new Date()
  })
};
Delivery Failed
const orderEvent = {
  order_id: orderId,
  event_type: 'delivery',
  stage: 'delivery_failed',
  actor_type: 'logistics' as const,
  actor_id: rider_id,
  outcome: 'failed' as const,
  notes: 'Delivery attempt failed',
  meta: JSON.stringify({
    reason: 'customer_unreachable'
  })
};


ESCROW EVENTS
Escrow Hold Created
const orderEvent = {
  order_id: orderId,
  event_type: 'escrow',
  stage: 'escrow_hold_created',
  actor_type: 'system' as const,
  actor_id: 'system',
  outcome: 'success' as const,
  notes: 'Customer payment placed in escrow',
  meta: JSON.stringify({
    amount: orderAmount
  })
};
Vendor Payout Released
const orderEvent = {
  order_id: orderId,
  event_type: 'escrow',
  stage: 'payout_released',
  actor_type: 'system' as const,
  actor_id: 'system',
  outcome: 'success' as const,
  notes: 'Vendor payout released successfully',
  meta: JSON.stringify({
    payout_amount: vendorAmount,
    released_at: new Date()
  })
};


Refund Issued
const orderEvent = {
  order_id: orderId,
  event_type: 'refund',
  stage: 'refund_issued',
  actor_type: 'admin' as const,
  actor_id: admin_id,
  outcome: 'success' as const,
  notes: 'Refund issued to customer',
  meta: JSON.stringify({
    refund_amount: refundAmount,
    reason: 'vendor_rejected_order'
  })
};


DISPUTE EVENTS
Dispute Opened
const orderEvent = {
  order_id: orderId,
  event_type: 'dispute',
  stage: 'dispute_opened',
  actor_type: 'customer' as const,
  actor_id: customer_id,
  outcome: 'pending' as const,
  notes: 'Customer opened a dispute',
  meta: JSON.stringify({
    reason: 'item_not_received'
  })
};
Dispute Resolved
const orderEvent = {
  order_id: orderId,
  event_type: 'dispute',
  stage: 'dispute_resolved',
  actor_type: 'admin' as const,
  actor_id: admin_id,
  outcome: 'success' as const,
  notes: 'Dispute resolved by admin',
  meta: JSON.stringify({
    resolution: 'refund_customer'
  })
};


ORDER CANCELLATION EVENTS
Customer Cancelled Order
const orderEvent = {
  order_id: orderId,
  event_type: 'cancellation',
  stage: 'customer_cancelled',
  actor_type: 'customer' as const,
  actor_id: customer_id,
  outcome: 'cancelled' as const,
  notes: 'Customer cancelled the order',
  meta: JSON.stringify({
    reason: 'ordered_by_mistake'
  })
};
Admin Cancelled Order
const orderEvent = {
  order_id: orderId,
  event_type: 'cancellation',
  stage: 'admin_cancelled',
  actor_type: 'admin' as const,
  actor_id: admin_id,
  outcome: 'cancelled' as const,
  notes: 'Admin cancelled the order',
  meta: JSON.stringify({
    reason: 'fraud_detection'
  })
};


SYSTEM EVENTS
Auto Completed Order
const orderEvent = {
  order_id: orderId,
  event_type: 'system',
  stage: 'auto_completed',
  actor_type: 'system' as const,
  actor_id: 'system',
  outcome: 'success' as const,
  notes: 'Order auto-completed after delivery confirmation timeout',
  meta: JSON.stringify({
    auto_completed_at: new Date()
  })
};

Recommended Event Flow
payment_received
    ↓
escrow_hold_created
    ↓
order_accepted
    ↓
processing_started
    ↓
order_packed
    ↓
shipment_created
    ↓
picked_up
    ↓
in_transit
    ↓
out_for_delivery
    ↓
delivered
    ↓
delivery_confirmed
    ↓
payout_released
Notes
Every important state transition should generate an event.
Events should never be edited after creation.
Events should be append-only for audit integrity.
Store timestamps at database level.
Meta should remain flexible JSON for future extensibility.
Events should power:
notifications
timelines
analytics
vendor scoring
dispute investigations
escrow operations
join all of it as a file
Deedyte Order Management Events Documentation
Order Management Events

This document defines the lifecycle events used in the order management system.

Each event follows a standardized structure for:

auditing
notifications
dispute resolution
analytics
escrow tracking


1. payment
2. accepteance
3. processing
4. shipping
5. delivery
6. escrow
7. refund
8. dispute
9. cancellation

What happens while handling events in the order management:

1. database is updated.
2. fcm notification is emitted to the recipient
3. socket.io is emitted to the recipient to update his/her order management.

order flow:
1. order_shipping
2. order_out_for_delivery
3. order_delivery