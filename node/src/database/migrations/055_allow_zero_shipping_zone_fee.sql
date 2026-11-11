-- Shipping zones only record coverage now; fees are agreed per order in the chat invoice.
ALTER TABLE shipping_zones DROP CONSTRAINT IF EXISTS shipping_zones_base_fee_check;
ALTER TABLE shipping_zones ADD CONSTRAINT shipping_zones_base_fee_check CHECK (base_fee >= 0);
