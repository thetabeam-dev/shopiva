/**
 * NOTIFICATION EMAIL TEMPLATE
 */

import type { NotificationEmailData } from "../../types/email.js";
import { baseTemplate } from "./base.js";

export function notificationTemplate(data: NotificationEmailData): string {
    const content = `
        <h2>${data.title}</h2>
        <p>Hi ${data.fname},</p>
        <p>${data.message}</p>
        ${data.actionUrl && data.actionText ? `
        <p style="text-align: center;">
            <a href="${data.actionUrl}" class="button">${data.actionText}</a>
        </p>
        ` : ""}
        <hr class="divider">
        <p style="font-size: 14px; color: #6b7280;">
            This is an automated notification from Deedyte.
        </p>
    `;

    return baseTemplate(content, data.message.substring(0, 100));
}

