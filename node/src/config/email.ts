/**
 * EMAIL CONFIGURATION
 * 
 * Nodemailer transporter configuration for sending emails.
 * Supports multiple providers: SMTP, Gmail, SendGrid, etc.
 */

import nodemailer from "nodemailer";
// If using TypeScript and @types/nodemailer is not installed, consider running:
// npm i --save-dev @types/nodemailer

const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_PASS,
    EMAIL_FROM,
    EMAIL_FROM_NAME
} = process.env;

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(EMAIL_PORT || "587"),
    secure: EMAIL_PORT === "465", // true for 465, false for other ports
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

// Default sender
export const defaultFrom = `"${EMAIL_FROM_NAME || "Deedyte"}" <${EMAIL_FROM || EMAIL_USER}>`;

// Verify connection on startup
export async function verifyEmailConnection(): Promise<boolean> {
    try {
        await transporter.verify();
        console.log("✅ Email server connection established");
        return true;
    } catch (error) {
        console.error("❌ Email server connection failed:", error);
        return false;
    }
}

export { transporter };

