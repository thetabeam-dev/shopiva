# WhatsApp Vendor Activation

Vendor activation sends business-initiated WhatsApp template messages through the Meta WhatsApp Cloud API.

## Server configuration

Set these variables in the Node service environment. Do not prefix them with `NEXT_PUBLIC_` or expose them to the browser.

```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_TEMPLATE_NAME=vendor_product_nudge
WHATSAPP_TEMPLATE_LANGUAGE=en
WHATSAPP_API_VERSION=v23.0
WHATSAPP_APP_SECRET=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
```

`WHATSAPP_TEMPLATE_NAME` must be an approved Meta template with one text parameter in the body. Parameter 1 is the vendor's first name. The approved template must include the campaign copy and a clear opt-out instruction. Use the matching template language code. The Graph API version must be supported by the connected Meta app.

Configure the Meta webhook callback as `https://<api-host>/webhooks/whatsapp`, subscribe to message events, and use the configured verify token. The webhook validates `X-Hub-Signature-256` with `WHATSAPP_APP_SECRET` and marks a matching account opted out when it receives `STOP`, `UNSUBSCRIBE`, `CANCEL`, `END`, or `QUIT`.

## Consent and recipients

The admin campaign queries `notificationPreferences.whatsapp.marketing` and requires an active entrepreneur, an empty shop, and a valid Nigerian phone number. The signup checkbox records a separate WhatsApp marketing choice and timestamp. Migration 046 initialized current active entrepreneurs with phone numbers as opted in based on the registration-policy confirmation supplied for this deployment; new accounts default to opted out unless they check the consent box.

The channel has a separate 30-day repeat-campaign cooldown. Meta delivery results are logged per recipient. A successful API response indicates provider acceptance, not final handset delivery.
