-- Track Google Merchant API product synchronization status (DeeDyte ↔ Merchant Center).
CREATE TABLE IF NOT EXISTS google_merchant_product_sync (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  shop_id INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  offer_id VARCHAR(128) NOT NULL,
  google_product_name TEXT,
  google_product_input_name TEXT,
  data_source_id VARCHAR(64),
  data_source_name TEXT,
  sync_status VARCHAR(32) NOT NULL DEFAULT 'pending'
    CHECK (sync_status IN (
      'pending',
      'queued',
      'syncing',
      'submitted',
      'approved',
      'disapproved',
      'warning',
      'deleted',
      'skipped',
      'error'
    )),
  google_approval_status VARCHAR(64),
  last_synced_at TIMESTAMP,
  last_error TEXT,
  diagnostics JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (product_id),
  UNIQUE (offer_id)
);

CREATE INDEX IF NOT EXISTS idx_gm_sync_shop ON google_merchant_product_sync(shop_id);
CREATE INDEX IF NOT EXISTS idx_gm_sync_status ON google_merchant_product_sync(sync_status);
