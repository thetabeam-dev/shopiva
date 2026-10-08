
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,

    recipient_id INTEGER NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'unread'
        CHECK (status IN ('unread', 'read')),

    source_type VARCHAR(30) NOT NULL
        CHECK (source_type IN ('order', 'dispute', 'return', 'chat')),

    source_id INTEGER NOT NULL,
    
    role VARCHAR(44) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient_created
    ON notifications (recipient_id, created_at DESC);

CREATE INDEX idx_notifications_recipient_status
    ON notifications (recipient_id, status);

CREATE INDEX idx_notifications_source
    ON notifications (source_type, source_id);
