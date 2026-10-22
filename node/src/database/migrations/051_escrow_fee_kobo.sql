ALTER TABLE escrow_transactions
  ADD COLUMN IF NOT EXISTS fee_kobo BIGINT NOT NULL DEFAULT 0;

ALTER TABLE escrow_transactions
  DROP CONSTRAINT IF EXISTS escrow_transactions_fee_kobo_check;

ALTER TABLE escrow_transactions
  ADD CONSTRAINT escrow_transactions_fee_kobo_check CHECK (fee_kobo >= 0);

UPDATE escrow_transactions e
SET fee_kobo = LEAST(
  150000,
  GREATEST(3000, FLOOR((o.amount_paid * 100) * 300 / 10000))
)
FROM orders o
WHERE o.id = e.order_id
  AND e.fee_kobo = 0
  AND o.amount_paid > 0;
