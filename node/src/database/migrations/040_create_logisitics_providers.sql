CREATE TABLE logistics_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,

    description TEXT,

    logo_url TEXT,
    website_url TEXT,

    phone VARCHAR(30),
    email VARCHAR(150),

    -- Nigerian logistics coverage
    country_code CHAR(2) NOT NULL DEFAULT 'NG',
    coverage_type VARCHAR(30) NOT NULL DEFAULT 'nationwide',

    -- Basic capabilities
    supports_pickup BOOLEAN NOT NULL DEFAULT FALSE,
    supports_door_to_door BOOLEAN NOT NULL DEFAULT FALSE,
    supports_tracking BOOLEAN NOT NULL DEFAULT FALSE,
    supports_same_day BOOLEAN NOT NULL DEFAULT FALSE,
    supports_express BOOLEAN NOT NULL DEFAULT FALSE,
    supports_standard BOOLEAN NOT NULL DEFAULT TRUE,
    supports_interstate BOOLEAN NOT NULL DEFAULT TRUE,
    supports_international BOOLEAN NOT NULL DEFAULT FALSE,

    -- Whether Deedyte currently allows this provider
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT logistics_provider_coverage_check
        CHECK (
            coverage_type IN (
                'nationwide',
                'regional',
                'local',
                'international'
            )
        )
);

CREATE INDEX idx_logistics_providers_active
    ON logistics_providers(is_active);

CREATE INDEX idx_logistics_providers_coverage
    ON logistics_providers(coverage_type);