import { Router } from "express";
import passport from "passport";
import { finalizeOAuthSession } from "../services/user.js";

export const OAuthRouter = Router();

type OAuthState = {
    mode: "app" | "web";
    returnTo?: string;
    role?: string;
    next?: string;
};

function appRedirectBase(): string {
    return process.env.OAUTH_APP_REDIRECT_URI ?? "deedyte://oauth";
}

function allowedWebOrigins(): string[] {
    const fromEnv = String(process.env.OAUTH_WEB_ORIGINS ?? "")
        .split(",")
        .map((value) => value.trim().replace(/\/$/, ""))
        .filter(Boolean);
    const fromCors = String(process.env.CORS_ORIGIN ?? "")
        .split(",")
        .map((value) => value.trim().replace(/\/$/, ""))
        .filter(Boolean);
    const defaults = ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"];
    return [...new Set([...fromEnv, ...fromCors, ...defaults])];
}

function isAllowedWebReturnTo(raw: string): boolean {
    try {
        const url = new URL(raw);
        if (!allowedWebOrigins().includes(url.origin)) return false;
        return url.pathname === "/auth/oauth/callback";
    } catch {
        return false;
    }
}

function encodeState(state: OAuthState): string {
    return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

function decodeState(raw: unknown): OAuthState {
    if (typeof raw !== "string" || !raw.trim()) {
        return { mode: "app" };
    }
    try {
        const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as OAuthState;
        if (parsed?.mode === "web" && parsed.returnTo && isAllowedWebReturnTo(parsed.returnTo)) {
            const next =
                typeof parsed.next === "string" &&
                parsed.next.startsWith("/") &&
                !parsed.next.startsWith("//") &&
                !parsed.next.startsWith("/auth")
                    ? parsed.next
                    : "";
            const out: OAuthState = {
                mode: "web",
                returnTo: parsed.returnTo,
                role: parsed.role === "entrepreneur" ? "entrepreneur" : "customer",
            };
            if (next) out.next = next;
            return out;
        }
    } catch {
        /* fall through */
    }
    return { mode: "app" };
}

function stateFromRequest(req: import("express").Request): OAuthState {
    const returnTo = typeof req.query.return_to === "string" ? req.query.return_to.trim() : "";
    if (returnTo && isAllowedWebReturnTo(returnTo)) {
        const role = req.query.role === "entrepreneur" ? "entrepreneur" : "customer";
        const nextRaw = typeof req.query.next === "string" ? req.query.next.trim() : "";
        const next =
            nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/auth")
                ? nextRaw
                : "";
        const out: OAuthState = { mode: "web", returnTo, role };
        if (next) out.next = next;
        return out;
    }
    return { mode: "app" };
}

function redirectWithToken(
    res: import("express").Response,
    state: OAuthState,
    token: string,
    user: { id?: unknown; email?: unknown; fname?: unknown },
): void {
    const params = new URLSearchParams({
        token,
        id: String(user.id ?? ""),
        email: String(user.email ?? ""),
        fname: String(user.fname ?? ""),
    });
    if (state.mode === "web" && state.returnTo) {
        params.set("role", state.role || "customer");
        if (state.next) params.set("next", state.next);
        res.redirect(302, `${state.returnTo}?${params.toString()}`);
        return;
    }
    res.redirect(302, `${appRedirectBase()}?${params.toString()}`);
}

function redirectWithError(
    res: import("express").Response,
    state: OAuthState,
    code: string,
): void {
    if (state.mode === "web" && state.returnTo) {
        const params = new URLSearchParams({
            error: code,
            role: state.role || "customer",
        });
        if (state.next) params.set("next", state.next);
        res.redirect(302, `${state.returnTo}?${params.toString()}`);
        return;
    }
    res.redirect(302, `${appRedirectBase()}?error=${encodeURIComponent(code)}`);
}

function beginProviderAuth(
    provider: "google" | "facebook",
    options: passport.AuthenticateOptions,
) {
    return (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
        const state = stateFromRequest(req);
        passport.authenticate(provider, {
            ...options,
            session: false,
            state: encodeState(state),
        })(req, res, next);
    };
}

function finishProviderCallback(provider: "google" | "facebook") {
    return (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
        const state = decodeState(req.query.state);
        passport.authenticate(provider, { session: false }, async (err: Error | null, user: { id?: number } | false) => {
            try {
                if (err || !user || !user.id) {
                    redirectWithError(res, state, err?.message || "oauth_failed");
                    return;
                }
                const session = await finalizeOAuthSession(user.id);
                redirectWithToken(res, state, session.token, session.user);
            } catch (error) {
                next(error);
            }
        })(req, res, next);
    };
}

OAuthRouter.get("/failure", (req, res) => {
    const state = decodeState(req.query.state);
    const msg =
        typeof req.query.message === "string" ? req.query.message : "oauth_failed";
    redirectWithError(res, state, msg);
});

OAuthRouter.get("/google", (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        redirectWithError(res, stateFromRequest(req), "google_not_configured");
        return;
    }
    beginProviderAuth("google", { scope: ["profile", "email"] })(req, res, next);
});

OAuthRouter.get("/google/callback", finishProviderCallback("google"));

OAuthRouter.get("/facebook", (req, res, next) => {
    if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
        redirectWithError(res, stateFromRequest(req), "facebook_not_configured");
        return;
    }
    beginProviderAuth("facebook", { scope: ["email"] })(req, res, next);
});

OAuthRouter.get("/facebook/callback", finishProviderCallback("facebook"));

/** Placeholder until Sign in with Apple is configured (requires Apple Developer keys). */
OAuthRouter.get("/apple", (req, res) => {
    redirectWithError(res, stateFromRequest(req), "apple_not_configured");
});
