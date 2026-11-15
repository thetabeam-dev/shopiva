# Google Merchant human-user OAuth

Standalone Node.js tool that obtains a **human** Google OAuth 2.0 access token for the Merchant / Content API using a **Desktop** OAuth client.

Service accounts cannot call `developerRegistration:registerGcp` — this flow is required for that step.

## Scope

`https://www.googleapis.com/auth/content`

## Setup (Google Cloud Console)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → your project.
2. **APIs & Services → Library** → enable **Merchant API** (and Content API for Shopping if listed).
3. **APIs & Services → OAuth consent screen**
   - User type: **External** (or Internal for Workspace-only).
   - Add your Admin Google account as a **Test user** while the app is in Testing.
   - Add scope `https://www.googleapis.com/auth/content` if prompted.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Desktop app**.
5. Download the JSON client and save it as `oauth-client.json` in this folder  
   (or `cp oauth-client.example.json oauth-client.json` and paste `client_id` / `client_secret`).
6. Edit the OAuth client → **Authorized redirect URIs** → add exactly:

   ```text
   http://localhost:3000/oauth2callback
   ```

   If you change the port (`OAUTH_CALLBACK_PORT=3001`), add the matching URI.

7. Ensure the same Google account is an **Admin** on your Merchant Center account.

## Install & run (macOS)

```bash
cd google-merchant-oauth
npm install
cp oauth-client.example.json oauth-client.json
# edit oauth-client.json with your real Desktop client credentials
npm run token
```

First run opens a browser for consent, then a local server on port **3000** receives the callback automatically.

Later runs reuse `token-store.json` (refresh token) so you usually **do not** need the browser again.

```bash
# Force revoke local + attempt remote revoke
npm run revoke
```

Optional: `OAUTH_CALLBACK_PORT=3001 npm run token`  
Optional debug: `DEBUG_MERCHANT_OAUTH=1 npm run token`

## Example terminal output

```text
Google authorization URL:

https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=...&prompt=consent&...

Redirect URI configured in this script: http://localhost:3000/oauth2callback
Listening for OAuth callback on http://127.0.0.1:3000/oauth2callback
Opened the authorization URL in your default browser.

Authentication successful (browser consent).

Access token:

ya29.a0AfH6SMC_exampleHumanUserToken_not_real_abcdefg

Expires at: 2026-11-15T23:59:00.000Z (in ~3599s)
Refresh token: saved securely in token-store.json (gitignored).

Scope: https://www.googleapis.com/auth/content

Access tokens are temporary. Re-run `npm run token` to refresh without a browser when a refresh token is stored.
```

## Merchant API developer registration

After you have a human access token:

```bash
curl -X POST \
  "https://merchantapi.googleapis.com/accounts/v1/accounts/{ACCOUNT_ID}/developerRegistration:registerGcp" \
  -H "Authorization: Bearer YOUR_HUMAN_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"developerEmail":"YOUR_PERSONAL_GOOGLE_EMAIL"}'
```

- `{ACCOUNT_ID}` — numeric Merchant Center account ID.  
- `developerEmail` — the **human** Google email used in the browser consent (Admin on that Merchant account).  
- Header must use the **human** Bearer token from this script (not a service-account token).

## Tokens & security

| File | Purpose | Git |
|------|---------|-----|
| `oauth-client.json` | Desktop client id/secret | **Ignored** |
| `token-store.json` | Access + refresh tokens | **Ignored** |
| `oauth-client.example.json` | Fake template only | Safe to commit |

- Access tokens expire (~1 hour). Run `npm run token` again; with a stored refresh token the script refreshes silently.
- Refresh tokens stay on disk with mode `0600`. Do not commit or share them.
- To revoke: `npm run revoke`, and/or remove the app at [Google Account permissions](https://myaccount.google.com/permissions).

## Project layout

```text
google-merchant-oauth/
├── generate-user-token.js
├── oauth-client.example.json
├── oauth-client.json          # you create (gitignored)
├── token-store.json           # created after consent (gitignored)
├── package.json
├── .gitignore
└── README.md
```
