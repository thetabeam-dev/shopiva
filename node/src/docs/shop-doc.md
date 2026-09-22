# Shops Documentation

## Overview

The Shops module manages virtual storefronts for entrepreneurs on the Deedyte platform. Shops enable vendors to sell products, manage policies, handle payments, and receive reviews from customers.

---

## Database Schema

### Table: `shops`

The core shop table storing identity, profile, and verification information.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | SERIAL | PRIMARY KEY | auto-increment | Unique shop identifier |
| `ownerId` | INTEGER | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | - | Shop owner's user ID |
| `name` | VARCHAR(255) | NOT NULL | - | Shop display name |
| `slug` | VARCHAR(255) | UNIQUE, NOT NULL | - | URL-friendly unique identifier |
| `description` | TEXT | - | - | Shop description/about |
| `logo` | TEXT | - | - | Shop logo URL |
| `banner` | TEXT | - | - | Shop banner image URL |
| `category` | VARCHAR(100) | - | - | Shop category (electronics, fashion, etc.) |
| `tags` | TEXT[] | - | `'{}'` | Tags for discoverability |
| `contactEmail` | VARCHAR(255) | - | - | Shop contact email |
| `contactPhone` | VARCHAR(20) | - | - | Shop contact phone |
| `location` | JSONB | - | See below | Shop location object |
| `socialLinks` | JSONB | - | See below | Social media profiles |
| `isActive` | BOOLEAN | - | `true` | Shop active/inactive status |
| `isVerified` | BOOLEAN | - | `false` | Shop verification status |
| `status` | VARCHAR(50) | CHECK constraint | `'pending_approval'` | Shop state |
| `verificationDocuments` | JSONB | - | See below | Documents for verification |
| `createdAt` | TIMESTAMP | - | `CURRENT_TIMESTAMP` | Shop creation timestamp |
| `updatedAt` | TIMESTAMP | - | `CURRENT_TIMESTAMP` | Last update timestamp |

#### JSONB Field Structures

**`location`**
```json
{
  "address": null,
  "city": null,
  "state": null,
  "country": null,
  "zipcode": null,
  "coordinates": null
}
```

**`socialLinks`**
```json
{
  "facebook": null,
  "instagram": null,
  "twitter": null,
  "website": null
}
```

**`verificationDocuments`**
```json
{
  "businessLicense": { "url": null, "verified": false, "submittedAt": null },
  "taxId": { "url": null, "verified": false, "submittedAt": null },
  "identityProof": { "url": null, "verified": false, "submittedAt": null }
}
```

#### Shop Status Values
- `active` - Shop is live and operational
- `suspended` - Shop is temporarily suspended
- `closed` - Shop is permanently closed
- `pending_approval` - Awaiting admin approval (default)

#### Indexes

| Index Name | Column(s) | Purpose |
|-----------|-----------|---------|
| `idx_shops_ownerId` | `ownerId` | Owner-based queries |
| `idx_shops_slug` | `slug` | URL slug lookup |
| `idx_shops_status` | `status` | Status filtering |
| `idx_shops_isActive` | `isActive` | Active shop filtering |
| `idx_shops_category` | `category` | Category filtering |
| `idx_shops_createdAt` | `createdAt` | Chronological sorting |

---

### Table: `shop_accounts`

Financial account tracking for shops with balance management.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | BIGSERIAL | PRIMARY KEY | auto-increment | Account identifier |
| `shop_id` | BIGINT | NOT NULL, REFERENCES shops(id), UNIQUE | - | Associated shop |
| `available_balance` | DECIMAL(15,2) | NOT NULL | `0` | Funds available for withdrawal |
| `pending_balance` | DECIMAL(15,2) | NOT NULL | `0` | Funds in escrow/pending release |
| `frozen_balance` | DECIMAL(15,2) | NOT NULL | `0` | Funds frozen (disputes, etc.) |
| `currency` | CHAR(3) | NOT NULL | `'NGN'` | Currency code |
| `status` | VARCHAR(20) | NOT NULL, CHECK constraint | - | Account status: `active`, `suspended`, `closed` |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | Last update timestamp |

---

### Table: `shop_account_ledger`

Transaction history for shop accounts (audit trail).

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | BIGSERIAL | PRIMARY KEY | auto-increment | Ledger entry ID |
| `shop_account_id` | BIGINT | REFERENCES shop_accounts(id) | - | Associated account |
| `source_type` | VARCHAR(30) | NOT NULL, CHECK constraint | - | Transaction source type |
| `source_id` | BIGINT | - | - | Reference ID (order_id, dispute_id, etc.) |
| `amount` | DECIMAL(15,2) | NOT NULL | - | Transaction amount |
| `direction` | VARCHAR(10) | NOT NULL, CHECK constraint | - | `credit` or `debit` |
| `balance_after` | DECIMAL(15,2) | - | - | Balance after transaction |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Transaction timestamp |

#### Source Type Values
- `order_payment` - Payment from customer order
- `escrow_release` - Funds released from escrow
- `refund` - Refund processed
- `dispute_hold` - Funds frozen for dispute
- `payout` - Withdrawal to bank account
- `adjustment` - Manual adjustment

---

### Table: `shop_payout_accounts`

Bank account information for receiving payouts.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | BIGSERIAL | PRIMARY KEY | auto-increment | Payout account ID |
| `shop_id` | BIGINT | NOT NULL, REFERENCES shops(id) | - | Associated shop |
| `provider` | VARCHAR(30) | NOT NULL, CHECK constraint | - | Payment provider |
| `country_code` | CHAR(2) | NOT NULL | `'NG'` | Country code |
| `currency` | CHAR(3) | NOT NULL | `'NGN'` | Currency code |
| `bank_name` | VARCHAR(100) | - | - | Bank name |
| `bank_code` | VARCHAR(20) | - | - | Bank code |
| `account_name` | VARCHAR(150) | - | - | Account holder name |
| `account_number_last4` | CHAR(4) | - | - | Last 4 digits of account |
| `provider_recipient_id` | VARCHAR(120) | - | - | Provider recipient code |
| `provider_account_id` | VARCHAR(120) | - | - | Provider account ID |
| `is_primary` | BOOLEAN | - | `TRUE` | Primary payout account |
| `status` | VARCHAR(20) | NOT NULL, CHECK constraint | - | Account status |
| `verification_method` | VARCHAR(30) | CHECK constraint | - | Verification method |
| `verification_failed_reason` | TEXT | - | - | Reason for verification failure |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | Last update timestamp |

#### Provider Values
- `paystack` - Paystack payment gateway
- `flutterwave` - Flutterwave payment gateway
- `stripe` - Stripe payment gateway
- `manual` - Manual bank transfer

#### Status Values
- `pending` - Awaiting verification
- `verified` - Verified and active
- `rejected` - Verification failed
- `disabled` - Account disabled

#### Verification Method Values
- `bank` - Bank account verification
- `kyc` - Know Your Customer verification
- `manual` - Manual admin verification

---

### Table: `shop_policies`

Shop delivery, refund, and custom policies.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | SERIAL | PRIMARY KEY | auto-increment | Policy ID |
| `shopid` | INTEGER | NOT NULL, UNIQUE, REFERENCES shops(id) | - | Associated shop |
| `deliverypolicy` | JSONB | - | See below | Delivery terms |
| `refundpolicy` | JSONB | - | See below | Refund terms |
| `custompolicies` | JSONB | - | `'[]'` | Custom policies array |
| `createdat` | TIMESTAMP | - | `CURRENT_TIMESTAMP` | Creation timestamp |
| `updatedat` | TIMESTAMP | - | `CURRENT_TIMESTAMP` | Last update timestamp |

#### JSONB Field Structures

**`deliverypolicy`**
```json
{
  "restrictions": null,
  "processingTime": null,
  "shippingMethods": [],
  "domesticShipping": { "regions": [], "available": true },
  "trackingProvided": true,
  "interstateShipping": { "available": false, "countries": [] }
}
```

**`refundpolicy`**
```json
{
  "refundMethod": "original_payment",
  "returnWindow": 30,
  "restockingFee": 0,
  "returnConditions": null,
  "damagedItemsPolicy": null,
  "refundProcessingTime": null
}
```

**`custompolicies`**
```json
[
  {
    "title": "Order Cancellation Policy",
    "content": "Orders can be cancelled within 12 hours...",
    "lastUpdated": "2025-01-10T00:00:00.000Z"
  }
]
```

#### Indexes

| Index Name | Column(s) | Purpose |
|-----------|-----------|---------|
| `idx_shop_policies_deliverypolicy` | `deliverypolicy` (GIN) | JSONB queries |
| `idx_shop_policies_refundpolicy` | `refundpolicy` (GIN) | JSONB queries |
| `idx_shop_policies_custompolicies` | `custompolicies` (GIN) | JSONB queries |

---

### Table: `shop_reviews`

Customer reviews for shops.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | BIGSERIAL | PRIMARY KEY | auto-increment | Review ID |
| `shop_id` | BIGINT | NOT NULL, REFERENCES shops(id) | - | Reviewed shop |
| `reviewer_id` | BIGINT | NOT NULL, REFERENCES users(id) | - | Review author |
| `order_id` | BIGINT | REFERENCES orders(id) ON DELETE SET NULL | - | Associated order |
| `rating` | SMALLINT | NOT NULL, CHECK (1-5) | - | Star rating (1-5) |
| `title` | VARCHAR(120) | - | - | Review title |
| `comment` | TEXT | - | - | Review text |
| `is_verified_purchase` | BOOLEAN | - | `FALSE` | Verified purchase flag |
| `is_hidden` | BOOLEAN | - | `FALSE` | Hidden/moderated flag |
| `hidden_reason` | TEXT | - | - | Reason for hiding |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Review timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | Last update timestamp |

**Unique Constraint:** `(shop_id, reviewer_id, order_id)` - One review per order per user

---

### Table: `shop_review_metrics`

Aggregated review statistics for shops (denormalized for performance).

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `shop_id` | BIGINT | PRIMARY KEY, REFERENCES shops(id) | - | Shop ID |
| `review_count` | INTEGER | NOT NULL | `0` | Total reviews |
| `average_rating` | NUMERIC(3,2) | NOT NULL | `0.00` | Average rating |
| `rating_1_count` | INTEGER | NOT NULL | `0` | 1-star reviews |
| `rating_2_count` | INTEGER | NOT NULL | `0` | 2-star reviews |
| `rating_3_count` | INTEGER | NOT NULL | `0` | 3-star reviews |
| `rating_4_count` | INTEGER | NOT NULL | `0` | 4-star reviews |
| `rating_5_count` | INTEGER | NOT NULL | `0` | 5-star reviews |
| `last_reviewed_at` | TIMESTAMPTZ | - | - | Most recent review timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | `now()` | Metrics update timestamp |

---

## API Endpoints

All shop routes require authentication via the `authenticate` middleware.

### Shop CRUD Operations

#### Create Shop
**POST** `/shop/create/:id`

Creates a new shop for the authenticated user.

**URL Parameters:**
- `id` - User ID (shop owner)

**Request Body:**
```json
{
  "name": "Cargo Tech Store",
  "slug": "cargo-tech-store",
  "description": "Premium tech accessories and gadgets",
  "logo": "https://cdn.example.com/logo.png",
  "category": "Electronics",
  "vendortype": "reseller"
}
```

**Response (201):**
```json
{
  "message": "Shop created successfully",
  "result": 1
}
```

**Notes:**
- `vendortype` can be: `manufacturer`, `reseller`, `dropshipper`
- `slug` must be unique across all shops
- Shop status defaults to `pending_approval`

---

#### Update Shop
**POST** `/shop/update/:shopId/:id`

Updates an existing shop's information.

**URL Parameters:**
- `shopId` - Shop ID
- `id` - User ID (owner)

**Request Body:**
```json
{
  "name": "Fabian Tech Store",
  "slug": "fabian-tech-store",
  "description": "A verified shop selling brand-new tech accessories.",
  "logo": "https://cdn.deedyte.com/shops/logo.png",
  "banner": "https://cdn.deedyte.com/shops/banner.jpg",
  "category": "Electronics",
  "tags": ["tech", "gadgets", "accessories"],
  "contactEmail": "support@fabiantechstore.com",
  "contactPhone": "+2348012345678",
  "vendorType": "reseller",
  "location": {
    "country": "Nigeria",
    "state": "Lagos",
    "city": "Ikeja",
    "address": "12 Allen Avenue, Ikeja",
    "zipcode": "100271",
    "coordinates": { "lat": 6.6018, "lng": 3.3515 }
  },
  "socialLinks": {
    "website": "https://fabiantechstore.com",
    "instagram": "https://instagram.com/fabiantechstore",
    "twitter": "https://twitter.com/fabiantech",
    "facebook": null,
    "tiktok": null
  },
  "isActive": true,
  "isVerified": true,
  "status": "active",
  "verificationDocuments": {
    "businessLicense": { "url": "...", "verified": true, "submittedAt": "..." },
    "taxId": { "url": null, "verified": false, "submittedAt": null },
    "identityProof": { "url": "...", "verified": true, "submittedAt": "..." }
  }
}
```

---

#### Delete Shop
**POST** `/shop/delete/:shopId/:id`

Permanently deletes a shop and all associated data.

**URL Parameters:**
- `shopId` - Shop ID
- `id` - User ID (owner)

**Note:** This is a hard delete. All related records (policies, reviews, accounts) are deleted via CASCADE.

---

#### Get Shop
**GET** `/shop/:shopId/:id`

Retrieves shop details.

**Response (200):**
```json
{
  "message": "Shop retrieved successfully",
  "shop": { ... }
}
```

---

### Shop Policies

#### Create Policy
**POST** `/shop/policy/create/:shopId/:id`

Creates shop policies (one policy record per shop).

**Request Body:**
```json
{
  "deliveryPolicy": {
    "processingTime": 2,
    "shippingMethods": ["Standard Delivery", "Express Delivery"],
    "domesticShipping": {
      "available": true,
      "regions": ["Lagos", "Abuja", "Ogun"]
    },
    "interstateShipping": {
      "available": true,
      "countries": ["Nigeria"]
    },
    "restrictions": "No prohibited items.",
    "trackingProvided": true
  },
  "refundPolicy": {
    "returnWindow": 7,
    "returnConditions": "Items must be unused, in original packaging.",
    "refundMethod": "original_payment",
    "restockingFee": 0,
    "damagedItemsPolicy": "Report within 48 hours with photo evidence.",
    "refundProcessingTime": 5
  },
  "customPolicies": [
    {
      "title": "Order Cancellation Policy",
      "content": "Orders can be cancelled within 12 hours.",
      "lastUpdated": "2025-01-10T00:00:00.000Z"
    }
  ]
}
```

---

#### Update Policy
**POST** `/shop/policy/update/:policyId/:id`

Updates existing shop policies.

**URL Parameters:**
- `policyId` - Policy record ID
- `id` - User ID

---

### Shop Payout Accounts

#### Create Payout Account
**POST** `/shop/payment/:shopId/:id`

Creates a payout account for receiving withdrawals. Integrates with Paystack for recipient verification.

**Request Body:**
```json
{
  "bank_name": "First Bank of Nigeria",
  "bank_code": "011",
  "account_name": "John Doe",
  "account_number": "1234567890"
}
```

**Behavior:**
1. Calls Paystack API to create a transfer recipient
2. Stores the `recipient_code` and account details
3. Only the last 4 digits of the account number are stored
4. Status is automatically set to `verified` on success

---

#### Update Payout Account
**PUT** `/shop/payment/:shopId/:id`

Updates an existing payout account. Re-verifies with Paystack.

---

### Shop Reviews & Metrics

#### Get Shop Reviews
**GET** `/shop/reviews/:shopId/:id`

Retrieves all reviews for a shop.

**Response (200):**
```json
{
  "message": "Shop reviews retrieved successfully",
  "reviews": [
    {
      "id": 1,
      "shop_id": 10,
      "reviewer_id": 25,
      "rating": 5,
      "title": "Great service!",
      "comment": "Fast delivery and quality products.",
      "is_verified_purchase": true,
      "created_at": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

#### Get Shop Metrics
**GET** `/shop/metrics/:shopId/:id`

Retrieves aggregated review metrics for a shop.

**Response (200):**
```json
{
  "message": "Shop metrics retrieved successfully",
  "metrics": {
    "shop_id": 10,
    "review_count": 150,
    "average_rating": 4.72,
    "rating_1_count": 2,
    "rating_2_count": 5,
    "rating_3_count": 10,
    "rating_4_count": 33,
    "rating_5_count": 100,
    "last_reviewed_at": "2025-01-15T10:30:00.000Z"
  }
}
```

---

## Type Definitions

```typescript
type VendorType = 'manufacturer' | 'reseller' | 'dropshipper';

type ShopStatus = 'active' | 'suspended' | 'closed' | 'pending_approval';

interface ShopLocation {
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipcode: string | null;
  coordinates: { lat?: number; lng?: number } | null;
}

interface ShopSocialLinks {
  facebook: string | null;
  instagram: string | null;
  twitter: string | null;
  website: string | null;
  tiktok: string | null;
}

interface VerificationDocument {
  url: string | null;
  verified: boolean;
  submittedAt: string | null;
}

interface ShopVerificationDocuments {
  businessLicense: VerificationDocument;
  taxId: VerificationDocument;
  identityProof: VerificationDocument;
}

interface NewShopDocument {
  ownerId: string;
  name: string;
  description: string;
  logo: string;
  slug: string;
  vendortype: VendorType;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ShopDocument {
  ownerId: number;
  shopId: number;
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  category?: string | null;
  tags: string[];
  contactEmail?: string | null;
  contactPhone?: string | null;
  vendorType: VendorType;
  location: ShopLocation;
  socialLinks: ShopSocialLinks;
  isActive: boolean;
  isVerified: boolean;
  status: ShopStatus;
  verificationDocuments: ShopVerificationDocuments;
  createdAt: string;
  updatedAt: string;
}

interface ShopPolicies {
  shopId?: number;
  policyId?: number;
  deliveryPolicy: {
    processingTime: number | null;
    shippingMethods: string[];
    domesticShipping: { available: boolean; regions: string[] };
    interstateShipping: { available: boolean; countries: string[] };
    restrictions: string | null;
    trackingProvided: boolean;
  };
  refundPolicy: {
    returnWindow: number;
    returnConditions: string | null;
    refundMethod: 'original_payment';
    restockingFee: number;
    damagedItemsPolicy: string | null;
    refundProcessingTime: number | null;
  };
  customPolicies: Array<{
    title: string;
    content: string;
    lastUpdated?: string;
  }>;
}

interface NewPayoutAccount {
  shopId: string;
  bank_name: string;
  bank_code: string;
  account_name: string;
  account_number: string;
  provider_recipient_id: string;
  provider_account_id: string;
  verification_method: 'bank' | 'kyc' | 'manual';
  status: 'pending' | 'verified' | 'rejected' | 'disabled';
}
```

---

## Business Logic

### Shop Creation Flow

1. User (with `entrepreneur` role) submits shop creation request
2. Shop is created with `status: 'pending_approval'`
3. Admin reviews and approves the shop
4. Shop status changes to `active`

### Payout Account Verification

When creating/updating a payout account:
1. Bank details are sent to Paystack API
2. Paystack returns a `recipient_code` for transfers
3. Only last 4 digits of account number are stored (security)
4. Account is marked as `verified` on successful Paystack response

### Balance Management

Shop accounts track three balance types:
- **available_balance**: Funds ready for withdrawal
- **pending_balance**: Funds in escrow (awaiting delivery confirmation)
- **frozen_balance**: Funds frozen due to disputes

All balance changes are recorded in `shop_account_ledger` for audit purposes.

### Review Metrics

The `shop_review_metrics` table is denormalized for performance:
- Updated whenever a new review is added/modified
- Provides quick access to aggregate statistics
- Should be kept in sync with `shop_reviews` table
