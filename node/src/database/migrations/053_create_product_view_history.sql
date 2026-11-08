-- Recently viewed products for the customer home tab.

CREATE TABLE product_view_history (
    id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, product_id)
);

CREATE INDEX idx_product_view_history_user_viewed
    ON product_view_history (user_id, viewed_at DESC);
