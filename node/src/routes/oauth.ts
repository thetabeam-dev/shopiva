import { Router } from "express";
import passport from "passport";
import { finalizeOAuthSession } from "../services/user.js";

export const OAuthRouter = Router();

function appRedirectBase(): string {
    return process.env.OAUTH_APP_REDIRECT_URI ?? "deedyte://oauth";
}

function redirectWithToken(res: import("express").Response, token: string): void {
    const uri = `${appRedirectBase()}?token=${encodeURIComponent(token)}`;
    res.redirect(302, uri);
}

function redirectWithError(res: import("express").Response, code: string): void {
    const uri = `${appRedirectBase()}?error=${encodeURIComponent(code)}`;
    res.redirect(302, uri);
}

OAuthRouter.get("/failure", (req, res) => {
    const msg =
        typeof req.query.message === "string" ? req.query.message : "oauth_failed";
    redirectWithError(res, msg);
});

OAuthRouter.get("/google", (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        redirectWithError(res, "google_not_configured");
        return;
    }
    passport.authenticate("google", {
        scope: ["profile", "email"],
        session: false,
    })(req, res, next);
});

OAuthRouter.get(
    "/google/callback",
    passport.authenticate("google", {
        session: false,
        failureRedirect: "/api/oauth/failure",
    }),
    async (req, res, next) => {
        try {
            const u = req.user as { id: number };
            const { token } = await finalizeOAuthSession(u.id);
            redirectWithToken(res, token);
        } catch (e) {
            next(e);
        }
    }
);

OAuthRouter.get("/facebook", (req, res, next) => {
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
        redirectWithError(res, "facebook_not_configured");
        return;
    }
    passport.authenticate("facebook", {
        scope: ["email"],
        session: false,
    })(req, res, next);
});

OAuthRouter.get(
    "/facebook/callback",
    passport.authenticate("facebook", {
        session: false,
        failureRedirect: "/api/oauth/failure",
    }),
    async (req, res, next) => {
        try {
            const u = req.user as { id: number };
            const { token } = await finalizeOAuthSession(u.id);
            redirectWithToken(res, token);
        } catch (e) {
            next(e);
        }
    }
);

/** Placeholder until Sign in with Apple is configured (requires Apple Developer keys). */
OAuthRouter.get("/apple", (_req, res) => {
    redirectWithError(res, "apple_not_configured");
});
