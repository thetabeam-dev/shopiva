/**
 * USER MODEL
 * 
 * Handles all database operations related to users:
 * - User creation and authentication
 * - Profile information updates (email, phone, password, photo)
 * - User data retrieval and validation
 * 
 * @see types/user.ts for type definitions
 * @see middleware/auth.ts for authentication middleware
 */

import type { Url } from "url";
import { db } from "../config/database.js";
import type { AuthData, NewUserDocument, User } from "../types/user.js";
import { withErrorHandling } from "../utils/errHandler.js";

export class model{
    static createUserDoc = withErrorHandling(async (
    payload: NewUserDocument & { src: string; deviceId: string; deviceToken: string }
    ) => {
        const { role, fname, lname, email, provider, password, src, deviceId, deviceToken } = payload;
        const pool = await db();

        if (src === "web") {
            const { rows } = await pool.query(
                `INSERT INTO users (role, fname, lname, email, provider, password, createdAt)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING *`,
                [role, fname, lname, email, provider, password, new Date()]
            );
            return rows[0];
        }

        const { rows } = await pool.query(
            `INSERT INTO users (role, fname, lname, email, provider, password, createdAt, deviceId)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [role, fname, lname, email, provider, password, new Date(), deviceId]
        );
        return rows[0];
    });



    static findUserByEmail = withErrorHandling(async (email: string): Promise <User[]> =>{

        const {
            rows 
        } = await  (await db()).query(
            `
                SELECT * FROM users WHERE email = $1
            `,
            [email]
        )

        return rows;
    })

    static countEmail = withErrorHandling(async (email: string) => {
        const { rows } = await (await db()).query(
            `SELECT COUNT(*) AS count FROM users WHERE email = $1`,
            [email]
        );
        return rows[0].count;
    })

    static countPhone = withErrorHandling(async (phone: string | number) => {
        const { rows } = await (await db()).query(
            `SELECT COUNT(*) AS count FROM users WHERE phone = $1`,
            [phone]
        );
        console.log(rows)
        console.log(phone)
        return rows[0].count;
    })

    static findUserById = withErrorHandling(async (id: number)  => {
        const {
            rows
        } = await  (await db()).query(
            `
                SELECT * FROM users WHERE id = $1
            `,
            [id]
        )

        return rows;
    })

    static updateUserPhoneById = withErrorHandling(async (id: number, phone: string | number) => {
        const phoneVal = typeof phone === "number" ? String(phone) : String(phone ?? "").trim();
        const {
            rows
        } = await (await db()).query(
            `
                UPDATE users set phone = $1 WHERE id = $2 RETURNING *
            `,
                [phoneVal, id]

        )

        return rows;
    })

    static updateUserRoleById = withErrorHandling(async (id: number, role: string) => {
        const {
            rows
        } = await (await db()).query(
            `
                UPDATE users set role = $1 WHERE id = $2 RETURNING *
            `,
                [role, id]

        )

        return rows;
    })

    static updateUserEmailById = withErrorHandling(async (id: number, email: string) => {
        const {
            rows
        } = await (await db()).query(
            `
                UPDATE users set email = $1 WHERE id = $2 RETURNING *
            `,
                [email, id]

        )

        return rows;
    })

    static updateProfile = withErrorHandling(
        async (
            payload: Partial<NewUserDocument> & {
                id: number;
                preferredLanguage?: string | null;
                timezone?: string | null;
                location?: Record<string, unknown> | null;
            }
        ) => {
            const { fname, lname, gender, id, preferredLanguage, timezone, location } = payload;

            const locationJson =
                location !== undefined && location !== null ? JSON.stringify(location) : null;

            const { rows } = await (await db()).query(
                `
                UPDATE users SET
                    fname = COALESCE($1, fname),
                    lname = COALESCE($2, lname),
                    gender = COALESCE($3, gender),
                    preferredlanguage = COALESCE($4, preferredlanguage),
                    timezone = COALESCE($5, timezone),
                    location = $6
                WHERE id = $7
                RETURNING *
                `,
                [
                    fname ?? null,
                    lname ?? null,
                    gender ?? null,
                    preferredLanguage ?? null,
                    timezone ?? null,
                    (locationJson),
                    id,
                ]
            );

            return rows;
        }
    )

    static deleteProfile = withErrorHandling(async (payload: Partial<NewUserDocument> & {id: number}) => {
        const {
            email, id
        } = payload;

        const { rows } = await (await db()).query(
            `
                UPDATE users
                SET 
                accountStatus = $1,
                status = jsonb_set(
                    jsonb_set(
                        status,
                        '{deleted,enabled}',
                        'true'::jsonb,
                        true
                    ),
                    '{deleted,history}',
                    COALESCE(status->'deleted'->'history', '[]'::jsonb) || to_jsonb(NOW()),
                    true
                )
                WHERE id = $2
                RETURNING *
            `,
            ["deleted", id]
        );


        return rows;
    })

    static recreateProfile = withErrorHandling(
    async (payload: { id: number }) => {
        const { id } = payload;

        const { rows } = await (await db()).query(
            `
                UPDATE users
                SET
                accountStatus = 'active',
                status = jsonb_set(
                    jsonb_set(
                        jsonb_set(
                            status,
                            '{recreated,enabled}',
                            'true'::jsonb,
                            true
                        ),
                        '{recreated,history}',
                        COALESCE(status->'recreated'->'history', '[]'::jsonb) || to_jsonb(NOW()),
                        true
                    ),
                    '{deleted,enabled}',
                    'false'::jsonb,
                    true
                )
                WHERE id = $1
                RETURNING *
            `,
            [id]
        );

        return rows[0];
    }
    );

    static undeleteProfile = withErrorHandling(
        async (payload: { id: number }) => {
            const { id } = payload;

            const { rows } = await (await db()).query(
                `
                    UPDATE users
                    SET
                    accountStatus = 'active',
                    status = jsonb_set(
                        jsonb_set(
                            status,
                            '{deleted,enabled}',
                            'false'::jsonb,
                            true
                        ),
                        '{deleted,history}',
                        COALESCE(status->'deleted'->'history', '[]'::jsonb) || to_jsonb(NOW()),
                        true
                    )
                    WHERE id = $1
                    RETURNING *
                `,
                [id]
            );

            return rows[0];
        }
    );


    static updatePassword = withErrorHandling(async (payload: {id: number, password: string}) => {
         const {
            password, id
        } = payload;
        const {
            rows
        } = await (await db()).query(
            `
                UPDATE users set password=$1 WHERE id = $2 RETURNING *
            `,
            [password, id]
        )

        return rows;
    })

    static updatePhoto = withErrorHandling(async (paylaod: {photo: Url, id: number}) => {
        const {
            photo,
            id
        } = paylaod;
        const {
            rows
        } = await (await db()).query(
            `
                UPDATE users set photo = $1 WHERE id = $2 RETURNING *
            `,
            [photo, id]
        )
        return rows;
    })

    static updateFcm = withErrorHandling(async (paylaod: {fcm: string, id: number}) => {
        const {
            fcm, id
        } = paylaod;
        const {
            rows
        } = await (await db()).query(
            `
                UPDATE users SET fcm = $1 WHERE id = $2 RETURNING *
            `,
            [fcm, id]
        )

        return rows;
    })

    static recordFailedLoginAttempt = withErrorHandling(async (id: number) => {
        const { rows } = await (await db()).query(
            `
                UPDATE users 
                SET loginAttempts = jsonb_set(
                    loginAttempts,
                    '{count}',
                    to_jsonb((loginAttempts->>'count')::int + 1)
                ),
                loginAttempts = jsonb_set(
                    loginAttempts,
                    '{lastAttempt}',
                    to_jsonb(NOW())
                ),
                updatedAt = NOW()
                WHERE id = $1 
                RETURNING *
            `,
            [id]
        )
        return rows;
    })

    static resetLoginAttempts = withErrorHandling(async (id: number) => {
        const { rows } = await (await db()).query(
            `
                UPDATE users 
                SET loginAttempts = jsonb_set(
                    loginAttempts,
                    '{count}',
                    '0'::jsonb
                ),
                updatedAt = NOW()
                WHERE id = $1 
                RETURNING *
            `,
            [id]
        )
        return rows;
    })

    static updateLastLogin = withErrorHandling(async (id: number) => {
        const { rows } = await (await db()).query(
            `
                UPDATE users 
                SET lastLogin = NOW(), 
                    lastseen = NOW(),
                    updatedAt = NOW()
                WHERE id = $1 
                RETURNING *
            `,
            [id]
        )
        return rows;
    })

    /**
     * Shops reference users by ownerid (FK) but also store contactemail for the storefront.
     * When the account email changes, refresh that denormalized field where it matched the old
     * address or was left blank so the virtual shop stays consistent with the user row.
     */
    static syncOwnedShopsAfterUserEmailChange = withErrorHandling(
        async (ownerId: number, previousEmail: string | null | undefined, newEmail: string) => {
            const neu = String(newEmail ?? "").trim();
            if (!neu) return;
            const prev = previousEmail != null ? String(previousEmail).trim() : "";
            await (await db()).query(
                `
                    UPDATE shops
                    SET contactemail = $1, updatedat = NOW()
                    WHERE ownerid = $2
                      AND (
                        contactemail IS NULL
                        OR contactemail = ''
                        OR ($3 <> '' AND LOWER(contactemail) = LOWER($3))
                      )
                `,
                [neu, ownerId, prev]
            );
        }
    );

    /**
     * Same idea as email: shops.contactphone may mirror the owner's phone until they set a
     * dedicated shop line.
     */
    static syncOwnedShopsAfterUserPhoneChange = withErrorHandling(
        async (ownerId: number, previousPhone: string | null | undefined, newPhone: string) => {
            const neu = String(newPhone ?? "").trim();
            if (!neu) return;
            const prev = previousPhone != null ? String(previousPhone).trim() : "";
            await (await db()).query(
                `
                    UPDATE shops
                    SET contactphone = $1, updatedat = NOW()
                    WHERE ownerid = $2
                      AND (
                        contactphone IS NULL
                        OR contactphone = ''
                        OR ($3 <> '' AND contactphone = $3)
                      )
                `,
                [neu, ownerId, prev]
            );
        }
    );
}



