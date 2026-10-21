
CREATE TABLE escrow_transactions (
    id SERIAL PRIMARY KEY,

    order_id SERIAL NOT NULL REFERENCES orders(id),
    buyer_id SERIAL NOT NULL REFERENCES users(id),
    vendor_id SERIAL NOT NULL REFERENCES users(id),

    currency VARCHAR(3) NOT NULL DEFAULT 'NGN',

    amount_held_kobo BIGINT NOT NULL
        CHECK (amount_held_kobo >= 0),

    amount_released_kobo BIGINT NOT NULL DEFAULT 0
        CHECK (amount_released_kobo >= 0),

    amount_refunded_kobo BIGINT NOT NULL DEFAULT 0
        CHECK (amount_refunded_kobo >= 0),

    status VARCHAR(20) NOT NULL DEFAULT 'held'
        CHECK (status IN (
            'held',
            'locked',
            'partially_released',
            'released',
            'partially_refunded',
            'refunded',
            'disputed'
        )),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,

    CHECK (
        amount_released_kobo + amount_refunded_kobo
        <= amount_held_kobo
    )
);

CREATE INDEX idx_escrow_order_id
    ON escrow_transactions(order_id);

CREATE INDEX idx_escrow_buyer_id
    ON escrow_transactions(buyer_id);

CREATE INDEX idx_escrow_vendor_id
    ON escrow_transactions(vendor_id);

CREATE INDEX idx_escrow_status
    ON escrow_transactions(status);
