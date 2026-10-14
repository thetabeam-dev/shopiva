ALTER TABLE admin_email_campaigns
    ADD COLUMN channel VARCHAR(20) NOT NULL DEFAULT 'email'
        CHECK (channel IN ('email', 'whatsapp'));

ALTER TABLE users
    ALTER COLUMN notificationPreferences SET DEFAULT '{
      "email": {"enabled": true, "marketing": false, "updates": true},
      "sms": {"enabled": true, "critical": true},
      "push": {"enabled": true, "marketing": false},
      "whatsapp": {"enabled": true, "marketing": false}
    }'::jsonb;

UPDATE users
SET notificationPreferences = jsonb_set(
    COALESCE(notificationPreferences, '{}'::jsonb),
    '{whatsapp}',
    COALESCE(notificationPreferences->'whatsapp', '{"enabled": true, "marketing": false}'::jsonb),
    true
)
WHERE notificationPreferences->'whatsapp' IS NULL;

UPDATE users
SET notificationPreferences = jsonb_set(
    jsonb_set(
        jsonb_set(
            COALESCE(notificationPreferences, '{}'::jsonb),
            '{whatsapp,enabled}',
            'true'::jsonb,
            true
        ),
        '{whatsapp,marketing}',
        'true'::jsonb,
        true
    ),
    '{whatsapp,marketingConsentAt}',
    to_jsonb(createdAt),
    true
)
WHERE role = 'entrepreneur'
  AND isActive = true
  AND accountStatus = 'active'
  AND phone IS NOT NULL
  AND BTRIM(phone) <> '';
