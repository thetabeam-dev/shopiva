import { model } from "../models/user.js";
import type { NewUserDocument, AuthData } from "../types/user.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "../config/database.js";
import type { PoolClient } from "pg";
import { formatPhoneNumber } from "../utils/phone.js";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const SALT_ROUNDS = 10;

type DeleteAccountPayload = {
    password?: string;
    oauthProvider?: "google" | "facebook" | "apple";
    oauthReauthenticated?: boolean;
    oauthReauthenticatedAt?: string;
    oauthReauthToken?: string;
};

const OAUTH_REAUTH_WINDOW_MS = 10 * 60 * 1000;

async function tableExists(client: PoolClient, tableName: string): Promise<boolean> {
    const { rows } = await client.query<{ exists: string | null }>(
        "SELECT to_regclass($1) AS exists",
        [`public.${tableName}`]
    );
    return rows[0]?.exists != null;
}

async function executeIfTableExists(
    client: PoolClient,
    tableName: string,
    sql: string,
    params: unknown[]
): Promise<void> {
    if (!(await tableExists(client, tableName))) {
        return;
    }
    await client.query(sql, params);
}

function normalizeProvider(value: unknown): "local" | "google" | "facebook" | "apple" {
    const provider = String(value ?? "local").trim().toLowerCase();
    if (provider === "google" || provider === "facebook" || provider === "apple") {
        return provider;
    }
    return "local";
}

function validateOAuthReauthWindow(when: string | undefined): boolean {
    if (!when) return false;
    const parsed = Date.parse(when);
    if (!Number.isFinite(parsed)) return false;
    return Date.now() - parsed <= OAUTH_REAUTH_WINDOW_MS;
}

function verifyOAuthReauthTokenForUser(token: string | undefined, userId: number): boolean {
    if (!token) return false;
    try {
        const decoded = jwt.verify(String(token), JWT_SECRET) as {
            id?: number | string;
            iat?: number;
        };
        const tokenUserId = Number(decoded?.id);
        if (!Number.isFinite(tokenUserId) || tokenUserId <= 0) return false;
        if (tokenUserId !== userId) return false;
        const iatMs = Number(decoded?.iat ?? 0) * 1000;
        if (!Number.isFinite(iatMs) || iatMs <= 0) return false;
        return Date.now() - iatMs <= OAUTH_REAUTH_WINDOW_MS;
    } catch {
        return false;
    }
}

export async function SignupService(payload: NewUserDocument & { src: string; deviceId: string; deviceToken: string }) {
    const userDoc = await model.findUserByEmail(payload.email);
    
    // Check if user exists and has deleted account
    if (userDoc.length > 0 && userDoc[0].accountstatus === "deleted") {
        const userId = userDoc[0].id;
        
        // Update profile with new data and reactivate account
        await model.updateProfile({ ...payload, id: userId });
        await model.recreateProfile({ id: userId });
        
        // Fetch updated user data
        const updatedUser = await model.findUserById(userId);
        const { password, ...userWithoutPassword } = updatedUser[0];

        // Generate JWT token
        const token = jwt.sign(
            { id: userId, email: updatedUser[0].email },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return {
            token,
            user: userWithoutPassword
        };
    }
    // Check if email already exists
    const emailExists = await model.countEmail(payload.email);
    if (emailExists > 0) {
        throw new Error("Email already registered");
    }

    // Check if phone already exists (skip when absent — OAuth / partial profiles)
    const phoneVal = formatPhoneNumber(payload.phone);
    if (phoneVal) {
        payload.phone = phoneVal as typeof payload.phone;
        const phoneExists = await model.countPhone(phoneVal as unknown as number);
        if (phoneExists > 0) {
            throw new Error("Phone number already registered");
        }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(payload.password, SALT_ROUNDS);

    // Create user
    const result = await model.createUserDoc({
        ...payload,
        password: hashedPassword
    });

    if (result === 0) {
        throw new Error("Failed to create user");
    }

    const users = await model.findUserByEmail(payload.email);
    if (users.length === 0) {
        throw new Error("Failed to load created user");
    }
    const created = users[0];
    const { password, ...userWithoutPassword } = created;

    const token = jwt.sign(
        { id: created.id, email: created.email },
        JWT_SECRET,
        { expiresIn: "7d" }
    );

    return {
        token,
        user: userWithoutPassword
    };

}

/** After OAuth verifies identity — same token + user shape as email/password sign-in. */
export async function finalizeOAuthSession(userId: number): Promise<{ token: string; user: Record<string, unknown> }> {
    await model.resetLoginAttempts(userId);
    await model.updateLastLogin(userId);
    const users = await model.findUserById(userId);
    if (users.length === 0) {
        throw new Error("User not found");
    }
    const user = users[0];
    const { password, ...userWithoutPassword } = user;
    const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
    return {
        token,
        user: userWithoutPassword as Record<string, unknown>
    };
}

export async function SigninService(payload: AuthData) {
    // Find user by email
    const users = await model.findUserByEmail(payload.email);
    
    if (users.length === 0) {
        throw new Error("Invalid email or password");
    }

    const user = users[0];

    // Verify password
    const passwordMatch = await bcrypt.compare(payload.password, user.password);
    
    if (!passwordMatch) {
        // Record failed login attempt
        await model.recordFailedLoginAttempt(user.id);
        throw new Error("Invalid email or password");
    }

    // Reset login attempts on successful login
    await model.resetLoginAttempts(user.id);

    // Update last login
    await model.updateLastLogin(user.id);
    const pool = await db();

    // Generate JWT token
    const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
    await pool.query(
      `UPDATE users SET devicetoken = $1 WHERE id = $2
       RETURNING *`,
      [payload.fcmToken, user.id]
    );

    // Return user without password
    const { password, ...userWithoutPassword } = user;


    
    return {
        token,
        user: userWithoutPassword
    };
}

export async function UpdateProfileService(
    id: number,
    payload: Partial<NewUserDocument> & {
        preferredLanguage?: string | null;
        timezone?: string | null;
        location?: Record<string, unknown> | null;
    }
) {
    const result = await model.updateProfile({ ...payload, id });
    
    if (result.length === 0) {
        throw new Error("User not found");
    }

    const { password, ...userWithoutPassword } = result[0];
    return userWithoutPassword;
}

export async function UpdateRoleService(id: number, role: string) {
    // Check if user already exists
    const user = await model.findUserById(id);
    if (!user) {
        throw new Error("User not registered");
    }

    const result = await model.updateUserRoleById(id, role);
    
    if (result.length === 0) {
        throw new Error("User not found");
    }

    const { password, ...userWithoutPassword } = result[0];
    return userWithoutPassword;
}

export async function UpdateEmailService(id: number, email: string) {
    const existing = await model.findUserById(id);
    if (!existing || existing.length === 0) {
        throw new Error("User not found");
    }
    const previousEmail =
        existing[0].email != null && String(existing[0].email).trim() !== ""
            ? String(existing[0].email).trim()
            : "";

    // Check if email already exists
    const emailExists = await model.countEmail(email);
    if (emailExists > 0) {
        throw new Error("Email already in use");
    }

    const result = await model.updateUserEmailById(id, email);

    if (result.length === 0) {
        throw new Error("User not found");
    }

    await model.syncOwnedShopsAfterUserEmailChange(id, previousEmail || null, email);

    const { password, ...userWithoutPassword } = result[0];
    return userWithoutPassword;
}

export async function UpdatePhoneService(id: number, phone: string | number) {
    const phoneNorm = formatPhoneNumber(phone) ?? "";

    const existing = await model.findUserById(id);
    if (!existing || existing.length === 0) {
        throw new Error("User not found");
    }
    const previousPhone =
        existing[0].phone != null && String(existing[0].phone).trim() !== ""
            ? String(existing[0].phone).trim()
            : "";

    // Check if phone already exists
    const phoneExists = await model.countPhone(phoneNorm);
    if (phoneExists > 0) {
        throw new Error("Phone number already in use");
    }

    const result = await model.updateUserPhoneById(id, phoneNorm);

    if (result.length === 0) {
        throw new Error("User not found");
    }

    await model.syncOwnedShopsAfterUserPhoneChange(id, previousPhone || null, phoneNorm);

    const { password, ...userWithoutPassword } = result[0];
    return userWithoutPassword;
}

export async function UpdatePhotoService(id: number, photo: string) {
    const result = await model.updatePhoto({ photo, id });
    
    if (result.length === 0) {
        throw new Error("User not found");
    }

    const { password, ...userWithoutPassword } = result[0];
    return userWithoutPassword;
}

export async function UpdatePasswordService(id: number, password: string) {
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await model.updatePassword({ id, password: hashedPassword });
    
    if (result.length === 0) {
        throw new Error("User not found");
    }

    return true;
}

export async function DeleteUserService(id: number, payload: DeleteAccountPayload = {}) {
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
        throw new Error("Invalid user id");
    }

    const pool = await db();
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const userResult = await client.query<{
            id: number;
            email: string;
            password: string;
            provider: string;
        }>(
            `SELECT id, email, password, provider
             FROM users
             WHERE id = $1
             FOR UPDATE`,
            [userId]
        );

        const user = userResult.rows[0];
        if (!user) {
            throw new Error("User not found");
        }

        const provider = normalizeProvider(user.provider);
        if (provider === "local") {
            const password = String(payload.password ?? "");
            if (!password) {
                throw new Error("Password is required to delete your account.");
            }
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                throw new Error("Invalid password.");
            }
        } else {
            const providerMatches = payload.oauthProvider === provider;
            const reauthed = payload.oauthReauthenticated === true;
            const insideWindow = validateOAuthReauthWindow(payload.oauthReauthenticatedAt);
            const hasValidReauthToken = verifyOAuthReauthTokenForUser(
                payload.oauthReauthToken,
                userId
            );

            if (!providerMatches || !reauthed || !insideWindow || !hasValidReauthToken) {
                throw new Error(
                    `Re-authentication with ${provider} is required to delete this account.`
                );
            }
        }

        const anonymizedUserRef = `deleted_user_${userId}`;
        const redactedShippingAddress = "REDACTED_DUE_TO_ACCOUNT_DELETION";

        // Preserve transaction records while removing customer-identifying references.
        await executeIfTableExists(
            client,
            "orders",
            `UPDATE orders
             SET customer_id = $1,
                 shipping_address = $2,
                 updated_at = NOW()
             WHERE customer_id = $3`,
            [anonymizedUserRef, redactedShippingAddress, String(userId)]
        );

        await executeIfTableExists(
            client,
            "returns",
            `UPDATE returns
             SET customer_id = $1,
                 shipping_address = $2,
                 updated_at = NOW()
             WHERE customer_id = $3`,
            [anonymizedUserRef, redactedShippingAddress, String(userId)]
        );

        await executeIfTableExists(
            client,
            "reviews",
            `UPDATE reviews
             SET customer_id = $1,
                 updated_at = NOW()
             WHERE customer_id = $2`,
            [anonymizedUserRef, String(userId)]
        );

        await executeIfTableExists(
            client,
            "order_events",
            `UPDATE order_events
             SET actor_id = $1
             WHERE actor_id = $2`,
            [anonymizedUserRef, String(userId)]
        );

        await executeIfTableExists(
            client,
            "return_events",
            `UPDATE return_events
             SET actor_id = $1
             WHERE actor_id = $2`,
            [anonymizedUserRef, String(userId)]
        );

        // Best-effort cleanup before hard delete.
        await executeIfTableExists(client, "cart_items", "DELETE FROM cart_items WHERE user_id = $1", [userId]);
        await executeIfTableExists(client, "chat_message_reads", "DELETE FROM chat_message_reads WHERE user_id = $1", [userId]);
        await executeIfTableExists(client, "chat_room_participants", "DELETE FROM chat_room_participants WHERE user_id = $1", [userId]);

        await client.query(
            `UPDATE users
             SET devicetoken = NULL,
                 updatedat = NOW()
             WHERE id = $1`,
            [userId]
        );

        const deleteResult = await client.query(
            "DELETE FROM users WHERE id = $1 RETURNING id",
            [userId]
        );

        if (deleteResult.rowCount !== 1) {
            throw new Error("Failed to delete user account.");
        }

        await client.query("COMMIT");
        return true;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}