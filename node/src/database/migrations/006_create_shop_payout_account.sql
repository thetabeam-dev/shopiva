CREATE TABLE wallet_payout_accounts (
  id BIGSERIAL PRIMARY KEY,

  -- Ownership
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,

  -- Provider
  provider VARCHAR(30) NOT NULL
    CHECK (provider IN ('paystack', 'flutterwave', 'stripe', 'manual')),

  -- Country & currency
  country_code CHAR(2) NOT NULL DEFAULT 'NG',
  currency CHAR(3) NOT NULL DEFAULT 'NGN',

  -- Bank details (NON-SENSITIVE ONLY)
  bank_name VARCHAR(100),
  bank_code VARCHAR(20),
  account_name VARCHAR(150),
  -- account_number_last4 CHAR(4),
  account_number CHAR(4),

  -- Provider references (safe to store)
  provider_recipient_id VARCHAR(120),
  provider_account_id VARCHAR(120),

  -- Status
  is_primary BOOLEAN DEFAULT TRUE,
  status VARCHAR(20) NOT NULL
    CHECK (status IN ('pending', 'verified', 'rejected', 'disabled')),

  -- Verification
  verification_method VARCHAR(30)
    CHECK (verification_method IN ('bank', 'kyc', 'manual')),
  verification_failed_reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (wallet_id, is_primary)
);
