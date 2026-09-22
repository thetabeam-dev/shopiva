/**
 * EMAIL VERIFICATION TEMPLATE
 */

import type { VerificationEmailData } from "../../types/email.js";
import { baseTemplate } from "./base.js";

export function verificationTemplate(data: VerificationEmailData): string {
    const content = `
        <h2>Verify Your Email</h2>
        <p>Hi ${data.fname},</p>
        <p>Please use the verification code below to verify your email address:</p>
        <div class="code">${data.verificationCode}</div>
        ${data.verificationLink ? `
        <p style="text-align: center;">Or click the button below:</p>
        <p style="text-align: center;">
            <a href="${data.verificationLink}" class="button">Verify Email</a>
        </p>
        ` : ""}
        <hr class="divider">
        <p style="font-size: 14px; color: #6b7280;">
            This code will expire in 15 minutes. If you didn't create an account with Deedyte, 
            please ignore this email.
        </p>
    `;

    return baseTemplate(content, `Your verification code is ${data.verificationCode}`);
}

