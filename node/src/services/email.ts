/**
 * EMAIL SERVICE
 * 
 * Handles sending emails using nodemailer.
 * Provides methods for different email types.
 */

import { transporter, defaultFrom } from "../config/email.js";
import type {
    EmailOptions,
    WelcomeEmailData,
    PasswordResetEmailData,
    VerificationEmailData,
    OrderConfirmationEmailData,
    NotificationEmailData
} from "../types/email.js";
import {
    welcomeTemplate,
    passwordResetTemplate,
    verificationTemplate,
    orderConfirmationTemplate,
    notificationTemplate
} from "../templates/email/index.js";

/**
 * Send a generic email
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
    try {
        const mailOptions = {
            from: defaultFrom,
            to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            cc: options.cc,
            bcc: options.bcc,
            attachments: options.attachments
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("📧 Email sent:", info.messageId);
        return true;
    } catch (error) {
        console.error("❌ Failed to send email:", error);
        throw error;
    }
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    return sendEmail({
        to: data.email,
        subject: "Welcome to Deedyte! 🎉",
        html: welcomeTemplate(data)
    });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
    email: string,
    data: PasswordResetEmailData
): Promise<boolean> {
    return sendEmail({
        to: email,
        subject: "Reset Your Password - Deedyte",
        html: passwordResetTemplate(data)
    });
}

/**
 * Send email verification code
 */
export async function sendVerificationEmail(
    email: string,
    data: VerificationEmailData
): Promise<boolean> {
    return sendEmail({
        to: email,
        subject: "Verify Your Email - Deedyte",
        html: verificationTemplate(data)
    });
}

/**
 * Send order confirmation email
 */
export async function sendOrderConfirmationEmail(
    email: string,
    data: OrderConfirmationEmailData
): Promise<boolean> {
    return sendEmail({
        to: email,
        subject: `Order Confirmed #${data.orderId} - Deedyte`,
        html: orderConfirmationTemplate(data)
    });
}

/**
 * Send notification email
 */
export async function sendNotificationEmail(
    email: string,
    data: NotificationEmailData
): Promise<boolean> {
    return sendEmail({
        to: email,
        subject: data.title,
        html: notificationTemplate(data)
    });
}

