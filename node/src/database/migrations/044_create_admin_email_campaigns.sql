CREATE TABLE admin_email_campaigns (
    id SERIAL PRIMARY KEY,
    request_id UUID NOT NULL UNIQUE,
    campaign_type VARCHAR(100) NOT NULL,
    admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('pending', 'sent', 'partial', 'failed', 'no_recipients')),
    selected_count INTEGER NOT NULL DEFAULT 0 CHECK (selected_count >= 0),
    sent_count INTEGER NOT NULL DEFAULT 0 CHECK (sent_count >= 0),
    failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
    skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_admin_email_campaigns_type_created
    ON admin_email_campaigns (campaign_type, created_at DESC);

CREATE TABLE admin_email_campaign_recipients (
    campaign_id INTEGER NOT NULL
        REFERENCES admin_email_campaigns(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
    failure_code VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempted_at TIMESTAMPTZ,
    PRIMARY KEY (campaign_id, user_id)
);

CREATE INDEX idx_admin_email_campaign_recipients_user_status
    ON admin_email_campaign_recipients (user_id, status, campaign_id);