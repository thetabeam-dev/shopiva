/**
 * WELCOME EMAIL TEMPLATE
 */

import type { WelcomeEmailData } from "../../types/email.js";
import { baseTemplate } from "./base.js";

export function welcomeTemplate(data: WelcomeEmailData): string {
    const content = `
        <h2>Welcome to Deedyte, ${data.fname}! 🎉</h2>
        <p>We're thrilled to have you on board. Your account has been created successfully.</p>
        <p>With Deedyte, you can:</p>
        <ul style="color: #4b5563; padding-left: 20px;">
            <li>Discover amazing products from trusted sellers</li>
            <li>Enjoy secure and fast checkout</li>
            <li>Track your orders in real-time</li>
            <li>Get exclusive deals and discounts</li>
        </ul>
        <p style="text-align: center;">
            <a href="#" class="button">Start Shopping</a>
        </p>
        <hr class="divider">
        <p style="font-size: 14px; color: #6b7280;">
            If you have any questions, feel free to reply to this email or contact our support team.
        </p>
    `;

    return baseTemplate(content, `Welcome to Deedyte, ${data.fname}!`);
}

