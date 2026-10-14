ALTER TABLE admin_email_campaigns
    ALTER COLUMN admin_id DROP NOT NULL;

ALTER TABLE admin_email_campaigns
    DROP CONSTRAINT IF EXISTS admin_email_campaigns_admin_id_fkey;

ALTER TABLE admin_email_campaigns
    ADD CONSTRAINT admin_email_campaigns_admin_id_fkey
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;