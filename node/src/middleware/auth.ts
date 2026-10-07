import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../config/database.js";

/** Passport attaches `Express.User` to `req.user`. Declared here so ts-node sees it whenever this module loads. */
declare global {
  namespace Express {
    interface User {
      id: number;
      /** Present after JWT verification or DB load; OAuth session may serialize `{ id }` only. */
      email?: string;
      fname?: string;
      lname?: string;
      phone?: string | null;
      gender?: string | null;
      role?: string | null;
      location?: Record<string, unknown> | null;
      preferredLanguage?: string;
      timezone?: string;
      isEmailVerified?: boolean;
      isPhoneVerified?: boolean;
      lastLogin?: string | null;
    }
  }
}

/** Same as Express `Request`; middleware populates `req.user`. */
interface AuthRequest extends Request {}

/** Row shape returned from `authenticateUser` (not `Express.User` — avoid reusing the name `User` in this file). */
interface AuthenticatedUserProfile {
  id: number;
  fname: string;
  lname: string;
  email: string;
  provider: string;
  accountstatus: string;
  phone: string | null;
  gender: string | null;
  role: string | null;
  devicetoken: string | null,
  location: Record<string, unknown> | null;
  photo: string | null;
  preferredLanguage: string;
  timezone: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  lastLogin: string | null;
}

/** Normalize secret so it matches Next.js / other loaders (trim, strip optional quotes). */
export function getJwtSecret(): string {
  const raw = process.env.JWT_SECRET ?? "";
  const trimmed = raw.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

// Authenticate user and return user data
const authenticateUser = async (id: number): Promise<AuthenticatedUserProfile | null> => {
  try {
    const result = await (await db()).query(
      `SELECT id, fname, lname, email, provider, accountstatus, phone, gender, role, location, devicetoken,
              photo, preferredlanguage, timezone, isemailverified, isphoneverified, lastlogin
       FROM users WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) return null;
    let locationParsed: Record<string, unknown> | null = null;
    const lr = row.location as unknown;
    if (lr != null) {
      if (typeof lr === "object" && !Array.isArray(lr)) {
        locationParsed = lr as Record<string, unknown>;
      } else if (typeof lr === "string") {
        try {
          const parsed = JSON.parse(lr) as unknown;
          if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
            locationParsed = parsed as Record<string, unknown>;
          }
        } catch {
          locationParsed = null;
        }
      }
    }
    return {
      id: row.id,
      fname: row.fname,
      lname: row.lname,
      email: row.email,
      provider: String(row.provider ?? "local"),
      accountstatus: String(row.accountstatus ?? "active"),
      phone: row.phone ?? null,
      gender: row.gender ?? null,
      role: row.role != null ? String(row.role) : null,
      devicetoken: row.devicetoken,
      location: locationParsed,
      photo: row.photo != null ? String(row.photo) : null,
      preferredLanguage: row.preferredlanguage ?? "en",
      timezone: row.timezone ?? "UTC",
      isEmailVerified: Boolean(row.isemailverified),
      isPhoneVerified: Boolean(row.isphoneverified),
      lastLogin: row.lastlogin != null ? String(row.lastlogin) : null,
    };
  } catch (error) {
    console.error("Database error:", error);
    return null;
  }
};

// Middleware to verify JWT token
const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.headers.authorization?.split(" ")[1];

  
  if (!token) {
    res.status(401).json({ message: "No token provided" });
    return;
  }

  const secret = getJwtSecret();
  if (!secret) {
    res.status(500).json({ message: "Server auth misconfiguration" });
    return;
  }
  try {
    const decoded = jwt.verify(token, secret) as { id: number; email: string };
    const user = await authenticateUser(Number(decoded.id));
    if (!user || user.accountstatus.toLowerCase() === "deleted") {
      res.status(401).json({ message: "Invalid or expired token" });
      return;
    }
    req.user = { id: user.id, email: user.email };
    next();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Invalid or expired token";
    if (process.env.NODE_ENV !== "production") {
      console.warn("JWT verify failed:", reason);
    }
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

/** Authenticate valid bearer tokens while preserving public access without one. */
const optionalVerifyToken = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    next();
    return;
  }

  try {
    const secret = getJwtSecret();
    if (!secret) {
      next();
      return;
    }
    const decoded = jwt.verify(token, secret) as { id: number };
    const user = await authenticateUser(Number(decoded.id));
    if (user && user.accountstatus.toLowerCase() !== "deleted") {
      req.user = { id: user.id, email: user.email };
    }
  } catch {
    // Discovery remains public when a token is absent or no longer valid.
  }
  next();
};

// Middleware to authenticate and attach user to request
const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await verifyToken(req, res, async () => {
      const tokenUserId = Number(req.user?.id);
      if (!Number.isFinite(tokenUserId) || tokenUserId <= 0) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }

      const paramIdRaw = req.params?.id;
      if (paramIdRaw != null) {
        const paramId = Number(paramIdRaw);
        if (!Number.isFinite(paramId) || paramId <= 0) {
          res.status(400).json({ message: "Invalid user id" });
          return;
        }
        if (paramId !== tokenUserId) {
          res.status(403).json({ message: "Forbidden" });
          return;
        }
      }

      const user = await authenticateUser(tokenUserId);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      req.user = user;
      next();
    });
  } catch (error) {
    res.status(500).json({ message: "Authentication error" });
  }
};

export { authenticate, verifyToken, optionalVerifyToken, authenticateUser };
export type { AuthRequest };