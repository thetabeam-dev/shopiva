# Email Automation Documentation

## Overview

The email system uses **Nodemailer** to send transactional emails. It includes pre-built templates for common use cases and supports customization.

---

## Setup

### 1. Environment Variables

Add these to your `.env` file:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@deedyte.com
EMAIL_FROM_NAME=Deedyte
```

### 2. Gmail Setup (if using Gmail)

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password: Google Account → Security → App Passwords
3. Use the 16-character app password as `EMAIL_PASS`

### 3. Other SMTP Providers

| Provider   | Host                  | Port |
|------------|----------------------|------|
| Gmail      | smtp.gmail.com       | 587  |
| Outlook    | smtp.office365.com   | 587  |
| SendGrid   | smtp.sendgrid.net    | 587  |
| Mailgun    | smtp.mailgun.org     | 587  |

---

## File Structure

```
src/
├── config/
│   └── email.ts              # Transporter configuration
├── services/
│   └── email.ts              # Email sending functions
├── templates/
│   └── email/
│       ├── index.ts          # Template exports
│       ├── base.ts           # Base HTML layout
│       ├── welcome.ts        # Welcome email
│       ├── password-reset.ts # Password reset
│       ├── verification.ts   # Email verification
│       ├── order-confirmation.ts
│       └── notification.ts   # Generic notifications
└── types/
    └── email.ts              # TypeScript interfaces
```

---

## Usage

### Import Functions

```typescript
import {
    sendEmail,
    sendWelcomeEmail,
    sendPasswordResetEmail,
    sendVerificationEmail,
    sendOrderConfirmationEmail,
    sendNotificationEmail
} from "../services/email.js";
```

### Send Welcome Email

```typescript
await sendWelcomeEmail({
    fname: "John",
    email: "john@example.com"
});
```

### Send Verification Code

```typescript
await sendVerificationEmail("john@example.com", {
    fname: "John",
    verificationCode: "123456",
    verificationLink: "https://deedyte.com/verify?code=123456" // optional
});
```

### Send Password Reset

```typescript
await sendPasswordResetEmail("john@example.com", {
    fname: "John",
    resetLink: "https://deedyte.com/reset?token=abc123",
    expiresIn: "1 hour"
});
```

### Send Order Confirmation

```typescript
await sendOrderConfirmationEmail("john@example.com", {
    fname: "John",
    orderId: "ORD-12345",
    orderTotal: 99.99,
    currency: "USD",
    items: [
        { name: "Product A", quantity: 2, price: 29.99 },
        { name: "Product B", quantity: 1, price: 40.01 }
    ],
    shippingAddress: "123 Main St, City, State 12345"
});
```

### Send Generic Notification

```typescript
await sendNotificationEmail("john@example.com", {
    fname: "John",
    title: "Your order has shipped!",
    message: "Great news! Your order #12345 is on its way.",
    actionUrl: "https://deedyte.com/track/12345",  // optional
    actionText: "Track Order"                       // optional
});
```

### Send Custom Email

```typescript
await sendEmail({
    to: "john@example.com",
    subject: "Custom Subject",
    html: "<h1>Hello!</h1><p>Custom content here.</p>",
    text: "Hello! Custom content here.",  // optional fallback
    cc: "manager@example.com",             // optional
    bcc: ["admin@example.com"],            // optional
    attachments: [                         // optional
        {
            filename: "invoice.pdf",
            path: "/path/to/invoice.pdf"
        }
    ]
});
```

---

## Type Definitions

### EmailOptions

```typescript
interface EmailOptions {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: EmailAttachment[];
}
```

### EmailAttachment

```typescript
interface EmailAttachment {
    filename: string;
    path?: string;
    content?: string | Buffer;
    contentType?: string;
}
```

### Template Data Types

```typescript
interface WelcomeEmailData {
    fname: string;
    email: string;
}

interface PasswordResetEmailData {
    fname: string;
    resetLink: string;
    expiresIn: string;
}

interface VerificationEmailData {
    fname: string;
    verificationCode: string;
    verificationLink?: string;
}

interface OrderConfirmationEmailData {
    fname: string;
    orderId: string;
    orderTotal: number;
    currency: string;
    items: OrderItem[];
    shippingAddress: string;
}

interface NotificationEmailData {
    fname: string;
    title: string;
    message: string;
    actionUrl?: string;
    actionText?: string;
}
```

---

## Creating Custom Templates

### 1. Create Template File

```typescript
// src/templates/email/custom-template.ts

import type { CustomEmailData } from "../../types/email.js";
import { baseTemplate } from "./base.js";

export function customTemplate(data: CustomEmailData): string {
    const content = `
        <h2>Hello, ${data.fname}!</h2>
        <p>Your custom message here.</p>
        <p style="text-align: center;">
            <a href="${data.actionUrl}" class="button">Click Here</a>
        </p>
    `;

    return baseTemplate(content, "Preview text for inbox");
}
```

### 2. Add Type Definition

```typescript
// src/types/email.ts

export interface CustomEmailData {
    fname: string;
    actionUrl: string;
}
```

### 3. Export Template

```typescript
// src/templates/email/index.ts

export { customTemplate } from "./custom-template.js";
```

### 4. Create Service Function

```typescript
// src/services/email.ts

export async function sendCustomEmail(
    email: string,
    data: CustomEmailData
): Promise<boolean> {
    return sendEmail({
        to: email,
        subject: "Your Custom Subject",
        html: customTemplate(data)
    });
}
```

---

## Verify Connection

Test email configuration on startup:

```typescript
import { verifyEmailConnection } from "../config/email.js";

// In your app initialization
const emailReady = await verifyEmailConnection();
if (!emailReady) {
    console.warn("Email service unavailable");
}
```

---

## Error Handling

All email functions throw errors on failure. Wrap in try-catch:

```typescript
try {
    await sendWelcomeEmail({ fname: "John", email: "john@example.com" });
    console.log("Email sent successfully");
} catch (error) {
    console.error("Failed to send email:", error);
    // Handle error (retry, queue, notify admin, etc.)
}
```

---

## Best Practices

1. **Always provide text fallback** for important emails
2. **Use queues** for bulk emails to avoid rate limits
3. **Log email events** for debugging and auditing
4. **Test templates** across email clients (Gmail, Outlook, Apple Mail)
5. **Keep sensitive data** out of email content when possible
6. **Implement retry logic** for transient failures

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection refused | Check EMAIL_HOST and EMAIL_PORT |
| Authentication failed | Verify EMAIL_USER and EMAIL_PASS |
| Gmail blocking | Enable "Less secure apps" or use App Password |
| Emails in spam | Configure SPF, DKIM, DMARC records |
| Rate limited | Implement delays between sends |

