-- Per-shop vendor order draft (Start Purchase), stored per signed-in buyer.

CREATE TABLE vendor_order_items (
    id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_id INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    inventory_id INT NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1
        CHECK (quantity >= 1 AND quantity <= 99),
    unit_price_snapshot NUMERIC(15,2) NOT NULL DEFAULT 0,
    variant_label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, shop_id, inventory_id)
);

CREATE INDEX idx_vendor_order_items_user_shop ON vendor_order_items(user_id, shop_id);
CREATE INDEX idx_vendor_order_items_shop ON vendor_order_items(shop_id);
