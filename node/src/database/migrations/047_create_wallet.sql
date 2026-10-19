CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    address INTEGER NOT NULL UNIQUE REFERENCES users(phone),
    pin VARCHAR,
    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
    balance_kobo BIGINT NOT NULL DEFAULT 0
        CHECK (balance_kobo >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE virtual_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL UNIQUE REFERENCES wallets(id),
    paystack_customer_code TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT,
    bank_name TEXT,
    provider VARCHAR(30) NOT NULL DEFAULT 'paystack',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (provider, account_number),
    UNIQUE (provider, paystack_customer_code)
);

CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id),
    type VARCHAR(20) NOT NULL,
    amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
    reference TEXT NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);