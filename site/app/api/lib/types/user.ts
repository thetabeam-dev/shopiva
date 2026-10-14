/**
 * User Types
 * 
 * Type definitions for user-related operations.
 * 
 * @module app/api/lib/types/user
 */

export interface NewUserDocument {
    whatsappMarketingConsent?: boolean;
  fname: string,
  lname: string,
  email: string,
  provider: "local" | "google" | "facebook" | "apple"
  phone?: string | null,
  password: string,
  gender?: string | null,
  role: string
}

export interface AuthData {
  email: string;
  password: string;
}

export interface OAuthData {
  email: string;
  provider: string;
  fname?: string;
  lname?: string;
}

export type UserRole = "customer" | "entrepreneur" | "admin";

export type AccountStatus = "active" | "suspended" | "banned" | "deleted";

export interface UserLocation {
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
}

export interface LoginAttemptHistory {
  timestamp: Date;
  error: string;
}

export interface LoginAttempts {
  count: number;
  lastAttempt: Date | null;
  history: LoginAttemptHistory[];
}

export interface StatusFlag {
  enabled: boolean;
  history: Date[];
}

export interface StatusFlagWithReason extends StatusFlag {
  reason: string | null;
}

export interface UserStatus {
  active: StatusFlag;
  deleted: StatusFlag;
  suspended: StatusFlagWithReason;
  banned: StatusFlagWithReason;
  recreated: StatusFlag;
}

export interface NotificationPreferences {
  email: {
    enabled: boolean;
    marketing: boolean;
    updates: boolean;
  };
  sms: {
    enabled: boolean;
    critical: boolean;
  };
  push: {
    enabled: boolean;
    marketing: boolean;
  };
  whatsapp: {
    enabled: boolean;
    marketing: boolean;
    marketingConsentAt?: string | null;
  };
}

export interface SocialLinks {
  linkedin?: string;
  twitter?: string;
  instagram?: string;
}

export interface User {
  id: number;
  role: UserRole;
  fname: string;
  lname: string;
  email: string;
  phone?: string;
  gender?: string;
  photo?: string;
  bio?: string;
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
  socialLinks?: SocialLinks;
  profileCompletion?: number;
}

