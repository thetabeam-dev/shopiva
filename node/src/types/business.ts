/**
 * Shop interface 
 * This section is for shop interface for new shop document and also Full shop document
 */

export type VendorType = 'manufacturer' | 'reseller' | 'dropshipper';

// {
//   "name": "Cargo",
//   "description": "....",
//   "slug": "shop-1",
//   "logo": "https://logo.com",
//   "category": "Electronics",
//   "vendortype": "dropshipper"
// }

export interface NewShopDocument{
    ownerId: string | number,
    name: string,
    description?: string | null,
    logo?: string | null,
    slug: string,
    vendortype?: VendorType,
    category?: string | null,
    location?: ShopLocation | Record<string, unknown> | null,
    createdAt?: Date,
    updatedAt?: Date
}


export type ShopStatus =
  | 'active'
  | 'suspended'
  | 'closed'
  | 'pending_approval';

export interface ShopLocation {
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipcode: string | null;
  coordinates: {
    lat?: number;
    lng?: number;
  } | null;
}

export interface ShopSocialLinks {
  facebook: string | null;
  instagram: string | null;
  twitter: string | null;
  website: string | null;
  tiktok: string | null
}

export interface VerificationDocument {
  url: string | null;
  verified: boolean;
  submittedAt: string | null; // ISO timestamp
}

export interface ShopVerificationDocuments {
  businessLicense: VerificationDocument;
  taxId: VerificationDocument;
  identityProof: VerificationDocument;
}

export interface ShopDocument {
  // Identity & Profile
  ownerId: number;
  shopId: number,
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  banner?: string | null;
  category?: string | null;
  tags: string[];
  contactEmail?: string | null;
  contactPhone?: string | null;

  // Vendor Type
  vendorType: VendorType;

  // Location & Social
  location: ShopLocation;
  socialLinks: ShopSocialLinks;

  // Status & Verification
  isActive: boolean;
  isVerified: boolean;
  status: ShopStatus;
  verificationDocuments: ShopVerificationDocuments;

  // Timestamps
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}



export interface ShopPolicies {
    // Identity
    // id: number;
    shopId?: number;
    policyId?: number;
  
    // Delivery Policy
    deliveryPolicy: {
      processingTime: number | null; // in days
      shippingMethods: string[];
      domesticShipping: {
        available: boolean;
        regions: string[];
      };
      interstateShipping: {
        available: boolean;
        countries: string[];
      };
      restrictions: string | null;
      trackingProvided: boolean;
    };
  
    // Refund Policy
    refundPolicy: {
    //   acceptsReturns: boolean;
      returnWindow: number; // days
      returnConditions: string | null;
      refundMethod: 'original_payment';
      restockingFee: number; // percentage or flat fee
    //   nonRefundableItems: string[];
    //   exchangePolicy: string | null;
      damagedItemsPolicy: string | null;
      refundProcessingTime: number | null; // days
    };
  
    // Custom Policies
    customPolicies: Array<{
      title: string;
      content: string;
      lastUpdated?: string;
    }>;
  
}
  

/**
 * 
 * Store update payload
 * 
 * 
 * 
 * {
  "name": "Fabian Tech Store",
  "slug": "fabian-tech-store",
  "description": "A verified shop selling brand-new tech accessories and gadgets.",
  "logo": "https://cdn.deedyte.com/shops/fabian-tech-store/logo.png",
  "banner": "https://cdn.deedyte.com/shops/fabian-tech-store/banner.jpg",
  "category": "Electronics",
  "tags": ["tech", "gadgets", "accessories", "electronics"],
  "contactEmail": "support@fabiantechstore.com",
  "contactPhone": "+2348012345678",

  "vendorType": "reseller",

  "location": {
    "country": "Nigeria",
    "state": "Lagos",
    "city": "Ikeja",
    "address": "12 Allen Avenue, Ikeja",
    "zipcode": "100271",
    "coordinates": {
        "lat": "43",
        "lng": "12"
    }
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
    "governmentId": "https://cdn.deedyte.com/docs/gov-id.pdf",
    "businessRegistration": null,
    "utilityBill": "https://cdn.deedyte.com/docs/utility-bill.pdf",
    "submittedAt": "2025-01-10T09:30:00.000Z",
    "verifiedAt": "2025-01-12T14:45:00.000Z"
  },

  "createdAt": "2025-01-05T08:00:00.000Z",
  "updatedAt": "2025-01-12T14:45:00.000Z"
}

 */


/**
 * This is the payload for updating and creating policy for shops
 * 
 * {
  "deliveryPolicy": {
    "processingTime": 2,
    "shippingMethods": [
      "Standard Delivery",
      "Express Delivery"
    ],
    "domesticShipping": {
      "available": true,
      "regions": [
        "Lagos",
        "Abuja",
        "Ogun",
        "Oyo"
      ]
    },
    "interstateShipping": {
      "available": true,
      "countries": [
        "Nigeria"
      ]
    },
    "restrictions": "We do not ship prohibited or restricted items as defined by local regulations.",
    "trackingProvided": true
  },

  "refundPolicy": {
    "returnWindow": 7,
    "returnConditions": "Items must be unused, in original packaging, and returned with proof of purchase.",
    "refundMethod": "original_payment",
    "restockingFee": 0,
    "damagedItemsPolicy": "Damaged items must be reported within 48 hours of delivery with photo evidence.",
    "refundProcessingTime": 5
  },

  "customPolicies": [
    {
      "title": "Order Cancellation Policy",
      "content": "Orders can be cancelled within 12 hours of placement provided the item has not been shipped.",
      "lastUpdated": "2025-01-10T00:00:00.000Z"
    },
    {
      "title": "Holiday Shipping Policy",
      "content": "Processing times may be extended during public holidays and peak sales periods.",
      "lastUpdated": "2025-01-10T00:00:00.000Z"
    }
  ]
}

 */


export interface NewPayoutAccount{
  shopId: string,
  bank_name: string,
  bank_code: string,
  account_name: string,
  account_number: string,
  provider_recipient_id: string,
  provider_account_id: string,
  verification_method: 'bank' | 'kyc' | 'manual',
  status: 'pending' | 'verified' | 'rejected' | 'disabled'
}

export interface NewPaystackRecipient{
  name: string, 
  account_number: string | number, 
  bank_code: string | number
}

export interface InitiateTransfer{
  amount: number, 
  recipient: string, 
  reason: string, 
  reference: string
}

export interface TransferRecipientResponse {
  status: boolean;
  message: string;
  data: TransferRecipientData;
}

export interface TransferRecipientData {
  active: boolean;
  createdAt: string; // ISO date string
  currency: string;
  domain: string;
  id: number;
  integration: number;
  name: string;
  recipient_code: string;
  type: string;
  updatedAt: string; // ISO date string
  is_deleted: boolean;
  details: TransferRecipientDetails;
}

export interface TransferRecipientDetails {
  authorization_code: string | null;
  account_number: string;
  account_name: string;
  bank_code: string;
  bank_name: string;
}
