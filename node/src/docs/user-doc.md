# Users Documentation

## Overview

The Users module manages user accounts, authentication, and profile management for the Deedyte platform. Users can have different roles (customer, entrepreneur, admin) and access various features based on their role.

---

## Database Schema

### Table: `users`

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | SERIAL | PRIMARY KEY | auto-increment | Unique user identifier |
| `role` | VARCHAR(50) | CHECK constraint | `'customer'` | User type: `customer`, `entrepreneur`, `admin` |
| `fname` | VARCHAR(100) | NOT NULL | - | First name |
| `lname` | VARCHAR(100) | NOT NULL | - | Last name |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | - | Email address (unique identifier) |
| `phone` | VARCHAR(20) | UNIQUE, NOT NULL | - | Phone number (unique identifier) |
| `gender` | VARCHAR(50) | - | - | Gender |
| `photo` | TEXT | - | - | Profile photo URL |
| `location` | JSONB | - | `{"city": null, "state": null, "country": null, "zipcode": null}` | Geographic location object |
| `dateOfBirth` | DATE | - | - | Date of birth |
| `password` | VARCHAR(255) | NOT NULL | - | Hashed password (bcrypt) |
| `twoFactorEnabled` | BOOLEAN | - | `false` | 2FA activation status |
| `verificationCode` | VARCHAR(6) | - | - | OTP for email/phone verification |
| `resetPasswordToken` | TEXT | - | - | Token for password reset flow |
| `loginAttempts` | JSONB | - | `{"count": 0, "lastAttempt": null, "history": []}` | Failed login attempts tracking |
| `isActive` | BOOLEAN | - | `true` | Account active/inactive flag |
| `isVerified` | BOOLEAN | - | `false` | Overall verification status |
| `isEmailVerified` | BOOLEAN | - | `false` | Email verification flag |
| `isPhoneVerified` | BOOLEAN | - | `false` | Phone verification flag |
| `accountStatus` | VARCHAR(50) | CHECK constraint | `'active'` | Account state: `active`, `suspended`, `banned`, `deleted` |
| `status` | JSONB | - | See below | Detailed status history |
| `deviceId` | VARCHAR(255) | - | - | Device identifier |
| `deviceToken` | JSONB | - | `[]` | FCM tokens for push notifications |
| `notificationPreferences` | JSONB | - | See below | User notification settings |
| `preferredLanguage` | VARCHAR(10) | - | `'en'` | Preferred language code |
| `timezone` | VARCHAR(50) | - | `'UTC'` | User timezone |
| `lastLogin` | TIMESTAMP | - | - | Last successful authentication |
| `lastseen` | TIMESTAMP | - | - | Last activity timestamp |
| `createdAt` | TIMESTAMP | - | `CURRENT_TIMESTAMP` | Account creation timestamp |
| `updatedAt` | TIMESTAMP | - | `CURRENT_TIMESTAMP` | Last profile update timestamp |
| `socialLinks` | JSONB | - | `{"linkedin": null, "twitter": null, "instagram": null}` | Social media profiles |
| `profileCompletion` | INTEGER | CHECK (0-100) | `0` | Profile completion percentage |

### JSONB Field Structures

#### `loginAttempts`
```json
{
  "count": 0,
  "lastAttempt": null,
  "history": [
    {
      "timestamp": "2025-01-15T10:30:00.000Z",
      "error": "Invalid password"
    }
  ]
}
```

#### `status`
```json
{
  "active": { "enabled": true, "history": [] },
  "deleted": { "enabled": false, "history": [] },
  "suspended": { "enabled": false, "reason": null, "history": [] },
  "banned": { "enabled": false, "reason": null, "history": [] },
  "recreated": { "enabled": false, "history": [] }
}
```

#### `notificationPreferences`
```json
{
  "email": { "enabled": true, "marketing": false, "updates": true },
  "sms": { "enabled": true, "critical": true },
  "push": { "enabled": true, "marketing": false }
}
```

### Indexes

| Index Name | Column(s) | Purpose |
|-----------|-----------|---------|
| `idx_users_id` | `id` | Primary key lookup |
| `idx_users_email` | `email` | Email-based queries |
| `idx_users_phone` | `phone` | Phone-based queries |
| `idx_users_role` | `role` | Role-based filtering |
| `idx_users_isActive` | `isActive` | Active user filtering |
| `idx_users_createdAt` | `createdAt` | Chronological sorting |
| `idx_users_lastLogin` | `lastLogin` | Activity tracking |

---

## API Endpoints

### Authentication

#### Sign Up
**POST** `/user/signup`

Creates a new user account. If an account with the same email exists but was deleted, it will be recreated.

**Request Body:**
```json
{
  "fname": "John",
  "lname": "Doe",
  "email": "john.doe@example.com",
  "phone": "+2348012345678",
  "password": "securePassword123",
  "gender": "male",
  "role": "customer",
  "src": "web",
  "deviceId": "device-uuid",
  "deviceToken": "fcm-token"
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "token": "jwt-token-here",
  "user": {
    "id": 1,
    "fname": "John",
    "lname": "Doe",
    "email": "john.doe@example.com",
    "role": "customer",
    ...
  }
}
```

**Notes:**
- `src` can be `"web"` or `"mobile"` - affects device tracking
- Passwords are hashed using bcrypt (10 salt rounds)
- JWT tokens expire after 7 days

---

#### Sign In
**POST** `/user/signin`

Authenticates a user and returns a JWT token.

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "jwt-token-here",
  "user": { ... }
}
```

**Behavior:**
- Records failed login attempts in `loginAttempts`
- Resets `loginAttempts.count` on successful login
- Updates `lastLogin` and `lastseen` timestamps

---

### Profile Management (Protected Routes)

All routes below require the `authenticate` middleware with a valid JWT token.

#### Update Profile
**PUT** `/user/update/profile/:id`

Updates basic profile information.

**Request Body:**
```json
{
  "fname": "John",
  "lname": "Smith",
  "gender": "male"
}
```

---

#### Update Email
**PUT** `/user/update/email/:id`

Updates user email. Validates uniqueness before update.

**Request Body:**
```json
{
  "email": "new.email@example.com"
}
```

---

#### Update Phone
**PUT** `/user/update/phone/:id`

Updates user phone number. Validates uniqueness before update.

**Request Body:**
```json
{
  "phone": "+2348098765432"
}
```

---

#### Update Role
**PUT** `/user/update/role/:id`

Updates user role (e.g., upgrading from customer to entrepreneur).

**Request Body:**
```json
{
  "role": "entrepreneur"
}
```

---

#### Update Photo
**PUT** `/user/update/photo/:id`

Updates profile photo URL.

**Request Body:**
```json
{
  "photo": "https://cdn.example.com/photos/profile.jpg"
}
```

---

#### Update Password
**PUT** `/user/update/password/:id`

Updates user password. New password is hashed before storage.

**Request Body:**
```json
{
  "password": "newSecurePassword456"
}
```

---

#### Delete User
**DELETE** `/user/delete/:id`

Soft deletes a user account. Sets `accountStatus` to `'deleted'` and updates the `status` JSONB field.

**Behavior:**
- Does NOT permanently delete the user record
- Sets `status.deleted.enabled` to `true`
- Appends deletion timestamp to `status.deleted.history`
- User can be recreated by signing up with the same email

---

## Business Logic

### Account Deletion & Recreation

The system implements a soft-delete pattern:

1. **Deletion**: When a user deletes their account:
   - `accountStatus` is set to `'deleted'`
   - `status.deleted.enabled` becomes `true`
   - Timestamp is recorded in `status.deleted.history`

2. **Recreation**: When a deleted user signs up again with the same email:
   - Existing record is updated (not created fresh)
   - `accountStatus` is set back to `'active'`
   - `status.recreated.enabled` becomes `true`
   - `status.deleted.enabled` becomes `false`
   - Profile fields are updated with new signup data

### Login Attempt Tracking

Failed login attempts are tracked in the `loginAttempts` JSONB field:
- `count` increments on each failed attempt
- `lastAttempt` records the timestamp
- On successful login, `count` is reset to 0

### Source-Based Device Tracking

During signup, the `src` parameter determines device tracking:
- `src: "web"` - No device ID or token stored
- `src: "mobile"` - `deviceId` and `deviceToken` are stored as JSON arrays

---

## Type Definitions

```typescript
type UserRole = "customer" | "entrepreneur" | "admin";

type AccountStatus = "active" | "suspended" | "banned" | "deleted";

interface UserLocation {
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
}

interface LoginAttempts {
  count: number;
  lastAttempt: Date | null;
  history: Array<{ timestamp: Date; error: string }>;
}

interface StatusFlag {
  enabled: boolean;
  history: Date[];
}

interface StatusFlagWithReason extends StatusFlag {
  reason: string | null;
}

interface UserStatus {
  active: StatusFlag;
  deleted: StatusFlag;
  suspended: StatusFlagWithReason;
  banned: StatusFlagWithReason;
  recreated: StatusFlag;
}

interface NotificationPreferences {
  email: { enabled: boolean; marketing: boolean; updates: boolean };
  sms: { enabled: boolean; critical: boolean };
  push: { enabled: boolean; marketing: boolean };
}

interface User {
  id: number;
  role: UserRole;
  fname: string;
  lname: string;
  email: string;
  phone?: string;
  gender?: string;
  photo?: string;
  location?: UserLocation;
  dateOfBirth?: Date;
  password: string;
  twoFactorEnabled: boolean;
  verificationCode?: string | null;
  resetPasswordToken?: string | null;
  loginAttempts: LoginAttempts;
  isActive: boolean;
  isVerified: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  accountStatus: AccountStatus;
  status: UserStatus;
  deviceId?: string;
  deviceTokens?: string[];
  notificationPreferences: NotificationPreferences;
  preferredLanguage: string;
  timezone: string;
  lastLogin?: Date | null;
  lastseen?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  socialLinks?: { linkedin?: string; twitter?: string; instagram?: string };
  profileCompletion?: number;
}
```
