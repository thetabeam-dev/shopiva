CREATE TABLE shops (
  -- Identity & Profile
  id SERIAL PRIMARY KEY,
  ownerId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  logo TEXT,
  banner TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  contactEmail VARCHAR(255),
  contactPhone VARCHAR(20),
  vendortype VARCHAR(20),
  location JSONB DEFAULT '{"address": null, "city": null, "state": null, "country": null, "zipcode": null, "coordinates": null}',
  socialLinks JSONB DEFAULT '{"facebook": null, "instagram": null, "twitter": null, "website": null}',

  -- Status & Verification
  isActive BOOLEAN DEFAULT true,
  isVerified BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'pending_approval' CHECK (status IN ('active', 'suspended', 'closed', 'pending_approval')),
  verificationDocuments JSONB DEFAULT '{
    "businessLicense": {"url": null, "verified": false, "submittedAt": null},
    "taxId": {"url": null, "verified": false, "submittedAt": null},
    "identityProof": {"url": null, "verified": false, "submittedAt": null}
  }',

  -- Timestamps
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for frequently queried columns
CREATE INDEX idx_shops_ownerId ON shops(ownerId);
CREATE INDEX idx_shops_slug ON shops(slug);
CREATE INDEX idx_shops_status ON shops(status);
CREATE INDEX idx_shops_isActive ON shops(isActive);
CREATE INDEX idx_shops_category ON shops(category);
CREATE INDEX idx_shops_createdAt ON shops(createdAt);