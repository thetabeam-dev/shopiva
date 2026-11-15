#!/usr/bin/env node
/**
 * Human-user OAuth 2.0 (Authorization Code) for Google Merchant / Content API.
 * Uses a Desktop OAuth client JSON — not a service account.
 *
 *   npm install
 *   cp oauth-client.example.json oauth-client.json
 *   npm run token
 *   npm run revoke
 */

"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");
const { OAuth2Client } = require("google-auth-library");

const SCOPE = "https://www.googleapis.com/auth/content";
const CLIENT_FILE = path.join(__dirname, "oauth-client.json");
const TOKEN_STORE = path.join(__dirname, "token-store.json");
const DEFAULT_PORT = Number(process.env.OAUTH_CALLBACK_PORT || 3000);
const REDIRECT_PATH = "/oauth2callback";

function fail(message, err) {
  console.error(`\nError: ${message}`);
  if (err && process.env.DEBUG_MERCHANT_OAUTH === "1") {
    console.error("Details:", {
      name: err.name,
      code: err.code,
      message: String(err.message || "")
        .replace(/GOCSPX-[^\s"']+/g, "GOCSPX-[REDACTED]")
        .replace(/client_secret[^,]*/gi, "client_secret:[REDACTED]"),
    });
  }
  process.exit(1);
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(
      `Missing ${label} at ${filePath}.\n` +
        (label.includes("oauth-client")
          ? "Copy oauth-client.example.json to oauth-client.json and paste your Desktop OAuth client credentials."
          : "")
    );
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    fail(`${label} is not valid JSON.`, err);
  }
}

function loadOAuthClientConfig() {
  const raw = readJson(CLIENT_FILE, "oauth-client.json");
  const cfg = raw.installed || raw.web || raw;
  const clientId = String(cfg.client_id || "").trim();
  const clientSecret = String(cfg.client_secret || "").trim();
  if (!clientId || !clientSecret) {
    fail(
      'oauth-client.json must include client_id and client_secret (Desktop "installed" client).'
    );
  }
  return { clientId, clientSecret };
}

function loadTokenStore() {
  if (!fs.existsSync(TOKEN_STORE)) return null;
  try {
    return JSON.parse(fs.readFileSync(TOKEN_STORE, "utf8"));
  } catch {
    return null;
  }
}

function saveTokenStore(tokens) {
  const payload = {
    access_token: tokens.access_token || null,
    refresh_token: tokens.refresh_token || loadTokenStore()?.refresh_token || null,
    expiry_date: tokens.expiry_date || null,
    scope: tokens.scope || SCOPE,
    token_type: tokens.token_type || "Bearer",
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(TOKEN_STORE, JSON.stringify(payload, null, 2), {
    mode: 0o600,
  });
  return payload;
}

function clearTokenStore() {
  if (fs.existsSync(TOKEN_STORE)) fs.unlinkSync(TOKEN_STORE);
}

function createOAuthClient(redirectUri) {
  const { clientId, clientSecret } = loadOAuthClientConfig();
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

function printTokenResult(tokens, source) {
  const accessToken = tokens.access_token;
  if (!accessToken) {
    fail("No access_token in the OAuth response.");
  }

  const expiryDate = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : null;
  const secondsLeft = expiryDate
    ? Math.max(0, Math.floor((expiryDate.getTime() - Date.now()) / 1000))
    : null;

  console.log("\nAuthentication successful (" + source + ").\n");
  console.log("Access token:\n");
  console.log(accessToken);
  console.log("");

  if (expiryDate) {
    console.log(
      `Expires at: ${expiryDate.toISOString()} (in ~${secondsLeft}s)`
    );
  } else {
    console.log("Expires at: unknown (typically ~1 hour from issue).");
  }

  if (tokens.refresh_token || loadTokenStore()?.refresh_token) {
    console.log(
      `Refresh token: saved securely in ${path.basename(TOKEN_STORE)} (gitignored).`
    );
  } else {
    console.log(
      "Refresh token: not returned. Re-run with prompt=consent after revoking prior grants, or remove old app access at https://myaccount.google.com/permissions"
    );
  }

  console.log(`\nScope: ${SCOPE}`);
  console.log(
    "\nAccess tokens are temporary. Re-run `npm run token` to refresh without a browser when a refresh token is stored."
  );
  console.log(`
Merchant API developer registration example:

  curl -X POST \\
    "https://merchantapi.googleapis.com/accounts/v1/accounts/{ACCOUNT_ID}/developerRegistration:registerGcp" \\
    -H "Authorization: Bearer ${accessToken.slice(0, 12)}…(use full token)" \\
    -H "Content-Type: application/json" \\
    -d '{"developerEmail":"YOUR_PERSONAL_GOOGLE_EMAIL"}'

Replace {ACCOUNT_ID} with your Merchant Center ID and developerEmail with the human Admin Google email.
`);
}

async function refreshFromStore(oAuth2Client) {
  const store = loadTokenStore();
  if (!store?.refresh_token) return null;

  oAuth2Client.setCredentials({ refresh_token: store.refresh_token });
  try {
    const { credentials } = await oAuth2Client.refreshAccessToken();
    const merged = {
      ...store,
      ...credentials,
      refresh_token: credentials.refresh_token || store.refresh_token,
    };
    saveTokenStore(merged);
    return merged;
  } catch (err) {
    console.error(
      "Stored refresh token failed (expired or revoked). Starting browser consent again…"
    );
    if (process.env.DEBUG_MERCHANT_OAUTH === "1") {
      console.error(err?.message || err);
    }
    return null;
  }
}

function waitForAuthCode(port, expectedState) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url || "/", `http://127.0.0.1:${port}`);
        if (reqUrl.pathname !== REDIRECT_PATH) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not found");
          return;
        }

        const errParam = reqUrl.searchParams.get("error");
        if (errParam) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            `<html><body><h1>Authorization failed</h1><p>${errParam}</p><p>You can close this window.</p></body></html>`
          );
          server.close();
          reject(new Error(`Google authorization error: ${errParam}`));
          return;
        }

        const code = reqUrl.searchParams.get("code");
        const state = reqUrl.searchParams.get("state");
        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            "<html><body><h1>Missing code</h1><p>You can close this window.</p></body></html>"
          );
          server.close();
          reject(new Error("Callback did not include an authorization code."));
          return;
        }
        if (expectedState && state !== expectedState) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            "<html><body><h1>Invalid state</h1><p>You can close this window.</p></body></html>"
          );
          server.close();
          reject(new Error("OAuth state mismatch (possible CSRF). Try again."));
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          "<html><body><h1>Authentication successful</h1><p>You can close this window and return to the terminal.</p></body></html>"
        );
        server.close();
        resolve(code);
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.on("error", (err) => {
      reject(err);
    });

    server.listen(port, "127.0.0.1", () => {
      console.log(
        `Listening for OAuth callback on http://127.0.0.1:${port}${REDIRECT_PATH}`
      );
    });
  });
}

async function tryOpenBrowser(url) {
  try {
    const open = require("open");
    await open(url);
    console.log("Opened the authorization URL in your default browser.");
  } catch {
    console.log("Could not open a browser automatically. Open this URL manually:");
  }
}

async function authorizeInteractive() {
  const port = DEFAULT_PORT;
  const redirectUri = `http://localhost:${port}${REDIRECT_PATH}`;
  const oAuth2Client = createOAuthClient(redirectUri);
  const state =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [SCOPE],
    prompt: "consent",
    state,
    include_granted_scopes: true,
  });

  console.log("\nGoogle authorization URL:\n");
  console.log(authUrl);
  console.log("");
  console.log(
    `Redirect URI configured in this script: ${redirectUri}\n` +
      "Add the same URI under your OAuth Desktop client in Google Cloud Console → APIs & Services → Credentials → your OAuth client → Authorized redirect URIs."
  );
  console.log("");

  const codePromise = waitForAuthCode(port, state);
  await tryOpenBrowser(authUrl);

  let code;
  try {
    code = await codePromise;
  } catch (err) {
    if (err?.code === "EADDRINUSE") {
      fail(
        `Port ${port} is already in use. Free it or set OAUTH_CALLBACK_PORT=3001 (and add the matching redirect URI in Google Cloud Console).`,
        err
      );
    }
    fail("Did not receive a valid OAuth callback.", err);
  }

  let tokenResponse;
  try {
    tokenResponse = await oAuth2Client.getToken(code);
  } catch (err) {
    fail(
      "Failed to exchange authorization code for tokens (code may be expired or redirect URI mismatch).",
      err
    );
  }

  const tokens = tokenResponse.tokens || {};
  oAuth2Client.setCredentials(tokens);
  saveTokenStore(tokens);
  printTokenResult(tokens, "browser consent");
}

async function revoke() {
  const store = loadTokenStore();
  if (!store?.access_token && !store?.refresh_token) {
    fail("No token-store.json to revoke. Run npm run token first.");
  }

  const oAuth2Client = createOAuthClient("http://localhost");
  const tokenToRevoke = store.access_token || store.refresh_token;
  try {
    await oAuth2Client.revokeToken(tokenToRevoke);
  } catch (err) {
    // Still clear local store; remote revoke can fail if already revoked.
    console.error(
      "Remote revoke may have failed; clearing local token store anyway."
    );
    if (process.env.DEBUG_MERCHANT_OAUTH === "1") {
      console.error(err?.message || err);
    }
  }
  clearTokenStore();
  console.log(
    "Local tokens removed. Also review https://myaccount.google.com/permissions to revoke the app if needed."
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--revoke") || args.includes("revoke")) {
    await revoke();
    return;
  }

  // Prefer silent refresh when we already have a refresh token.
  const redirectUri = `http://localhost:${DEFAULT_PORT}${REDIRECT_PATH}`;
  const oAuth2Client = createOAuthClient(redirectUri);
  const refreshed = await refreshFromStore(oAuth2Client);
  if (refreshed?.access_token) {
    printTokenResult(refreshed, "refresh_token");
    return;
  }

  await authorizeInteractive();
}

main().catch((err) => {
  fail("Unexpected failure during OAuth.", err);
});
