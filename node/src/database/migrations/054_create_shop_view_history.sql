-- Recently viewed shops for the customer home tab.

CREATE TABLE shop_view_history (
    id BIGSERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_id INT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, shop_id)
);

CREATE INDEX idx_shop_view_history_user_viewed
    ON shop_view_history (user_id, viewed_at DESC);
