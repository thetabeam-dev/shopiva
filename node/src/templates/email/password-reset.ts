/**
 * PASSWORD RESET EMAIL TEMPLATE
 */

import type { PasswordResetEmailData } from "../../types/email.js";
import { baseTemplate } from "./base.js";

export function passwordResetTemplate(data: PasswordResetEmailData): string {
    const content = `
        <h2>Reset Your Password</h2>
        <p>Hi ${data.fname},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <p style="text-align: center;">
            <a href="${data.resetLink}" class="button">Reset Password</a>
        </p>
        <p style="font-size: 14px; color: #6b7280;">
            This link will expire in <strong>${data.expiresIn}</strong>.
        </p>
        <hr class="divider">
        <p style="font-size: 14px; color: #6b7280;">
            If you didn't request a password reset, you can safely ignore this email. 
            Your password will remain unchanged.
        </p>
        <p style="font-size: 12px; color: #9ca3af;">
            For security, this request was received from a device. If this wasn't you, 
            please secure your account immediately.
        </p>
    `;

    return baseTemplate(content, "Reset your Deedyte password");
}

