/**
 * DeeDyte Privacy Policy content (authoritative shared copy).
 * @module components/legal/PrivacyPolicyContent
 */

import React from "react";
import Link from "next/link";

export const PRIVACY_LAST_UPDATED = "April 24, 2026";

export const PRIVACY_TOC = [
  { id: "introduction", label: "Introduction" },
  { id: "information-we-collect", label: "Information We Collect" },
  { id: "how-we-use", label: "How We Use Information" },
  { id: "how-we-share", label: "How We Share Information" },
  { id: "payments", label: "Payments & Service Providers" },
  { id: "cookies", label: "Cookies & Similar Technologies" },
  { id: "security", label: "Data Security" },
  { id: "retention", label: "Data Retention" },
  { id: "rights", label: "Your Rights & Choices" },
  { id: "account-deletion", label: "Account Deletion" },
  { id: "children", label: "Children's Privacy" },
  { id: "third-parties", label: "Third-Party Services & Links" },
  { id: "international", label: "International Data Transfers" },
  { id: "changes", label: "Changes to This Policy" },
  { id: "contact", label: "Contact Us" },
];

export default function PrivacyPolicyContent() {
  return (
    <article className="legal-page__article">
      <p className="legal-page__meta">Last updated: {PRIVACY_LAST_UPDATED}</p>

      <h2 id="introduction">1. Introduction</h2>
      <p>
        This Privacy Policy explains how Thetabeam (&quot;Thetabeam,&quot; &quot;we,&quot;
        &quot;us,&quot; or &quot;our&quot;) collects, uses, stores, and shares personal
        information when you use DeeDyte—our website, vendor tools, customer storefronts,
        and mobile applications (together, the &quot;Services&quot;). The DeeDyte mobile
        applications may be published under the technical package identifier{" "}
        <code>com.thetabeam.shopiva</code>.
      </p>
      <p>
        By using DeeDyte, you acknowledge this Policy. If you do not agree, please do not
        use the Services. This Policy should be read together with our{" "}
        <Link href="/terms-of-use">Terms of Use</Link>.
      </p>

      <h2 id="information-we-collect">2. Information We Collect</h2>
      <p>
        We collect information you provide directly, information generated through your use
        of the Services, and information from service providers that help us operate DeeDyte.
      </p>

      <h3>2.1 Account and profile information</h3>
      <p>When you create or manage an account, we may collect:</p>
      <ul>
        <li>Name, email address, phone number, and password (or OAuth credentials)</li>
        <li>Profile photo, gender, date of birth, and location details you choose to provide</li>
        <li>Role information (for example, customer or entrepreneur/vendor)</li>
        <li>Authentication and verification-related data (such as verification codes)</li>
      </ul>

      <h3>2.2 Vendor and business information</h3>
      <p>If you sell on DeeDyte, we may collect:</p>
      <ul>
        <li>Shop name, slug, description, logo, banner, and category</li>
        <li>Business contact email and phone number</li>
        <li>Shop policies (for example, delivery or refund policies you publish)</li>
        <li>Payout and settlement-related account information needed to pay vendors</li>
        <li>Product listings, inventory, variants, pricing, tags, and media you upload</li>
      </ul>

      <h3>2.3 Customer information</h3>
      <p>If you buy through DeeDyte, we may collect:</p>
      <ul>
        <li>Delivery and billing address details</li>
        <li>Order preferences and communication with vendors through in-app messaging</li>
        <li>Dispute or support information you submit</li>
      </ul>

      <h3>2.4 Product, order, and transaction information</h3>
      <p>To operate marketplace transactions, we process:</p>
      <ul>
        <li>Cart contents, orders, quantities, prices, and fulfillment status</li>
        <li>Payment references and transaction outcomes from our payment processor</li>
        <li>Shipping or pickup details associated with an order</li>
        <li>Reviews, ratings, and related shop metrics where enabled</li>
      </ul>

      <h3>2.5 Device and technical information</h3>
      <p>When you access DeeDyte, we may automatically collect:</p>
      <ul>
        <li>Device identifiers, device tokens used for push notifications, and app version</li>
        <li>IP address, browser type, operating system, and approximate location derived from network data</li>
        <li>Log data, cookies, and similar technologies that help the Services function securely</li>
        <li>Usage events needed to operate features such as realtime updates and notifications</li>
      </ul>

      <h2 id="how-we-use">3. How We Use Information</h2>
      <p>We use personal information to:</p>
      <ul>
        <li>Create and manage accounts, authenticate users, and secure access</li>
        <li>Enable vendors to create shops, list products, manage inventory, and fulfill orders</li>
        <li>Enable customers to browse, purchase, track orders, and communicate with vendors</li>
        <li>Process payments, payouts, refunds, and related transaction workflows</li>
        <li>Provide customer support, dispute handling, and service communications</li>
        <li>Send transactional messages (and, where permitted, product or marketing updates)</li>
        <li>Maintain, improve, and protect the security and reliability of the Services</li>
        <li>Detect, prevent, and investigate fraud, abuse, or violations of our terms</li>
        <li>Comply with legal obligations and enforce our agreements</li>
      </ul>

      <h2 id="how-we-share">4. How We Share Information</h2>
      <p>
        We do not sell your personal information. We share information only as needed to
        operate DeeDyte, including:
      </p>
      <ul>
        <li>
          <strong>With other users as part of a transaction.</strong> For example, a vendor
          may receive customer order and delivery details needed to fulfill a purchase, and a
          customer may see public shop and product information.
        </li>
        <li>
          <strong>With service providers.</strong> We use third-party processors to support
          payments, hosting, messaging, authentication, and similar infrastructure. These
          providers may process data only to perform services on our behalf.
        </li>
        <li>
          <strong>For legal and safety reasons.</strong> We may disclose information if we
          believe it is reasonably necessary to comply with law, protect rights and safety,
          or respond to lawful requests.
        </li>
        <li>
          <strong>Business transfers.</strong> If Thetabeam is involved in a merger,
          acquisition, financing, or sale of assets, information may be transferred as part
          of that transaction, subject to appropriate safeguards.
        </li>
      </ul>

      <h2 id="payments">5. Payments and Third-Party Service Providers</h2>
      <p>
        DeeDyte uses payment infrastructure to process customer checkout and related
        settlement workflows. In particular, checkout and payment verification may be handled
        through Paystack. Payment card details are typically processed by the payment
        provider and are not stored by DeeDyte as full card numbers on our servers.
      </p>
      <p>
        Depending on how you use DeeDyte, other providers may process limited data to enable
        core features, such as:
      </p>
      <ul>
        <li>Authentication providers (for example, Google sign-in where enabled)</li>
        <li>Push notification services for mobile devices</li>
        <li>Realtime messaging or notification infrastructure used by the Services</li>
        <li>Email delivery for account and transaction notices</li>
      </ul>
      <p>
        Those providers process information under their own terms and privacy policies. We
        encourage you to review them when you use those features.
      </p>

      <h2 id="cookies">6. Cookies and Similar Technologies</h2>
      <p>
        We use cookies, local storage, and similar technologies to keep you signed in,
        remember preferences, maintain session security, and operate website and app
        features. You can control cookies through your browser settings. Disabling certain
        cookies may affect sign-in or other core functionality.
      </p>

      <h2 id="security">7. Data Security</h2>
      <p>
        We implement reasonable technical and organizational measures designed to protect
        personal information, including access controls and encrypted transport where
        appropriate. No method of transmission or storage is completely secure, and we
        cannot guarantee absolute security. Please use a strong password and protect your
        account credentials.
      </p>

      <h2 id="retention">8. Data Retention</h2>
      <p>
        We retain personal information for as long as needed to provide the Services,
        maintain business and transaction records, resolve disputes, enforce agreements, and
        meet legal or regulatory requirements. When information is no longer required, we
        take steps to delete or de-identify it, subject to lawful retention needs (for
        example, payment or tax-related records).
      </p>

      <h2 id="rights">9. Your Rights and Choices</h2>
      <p>
        Depending on applicable law and your location, you may have rights to access,
        correct, update, or delete certain personal information, or to object to or restrict
        certain processing. You may also be able to withdraw consent where processing is
        based on consent.
      </p>
      <p>
        You can often update profile information directly in your account settings. For
        other requests, contact us at{" "}
        <a href="mailto:admin@deedyte.com">admin@deedyte.com</a>. We may need to verify your
        identity before fulfilling a request.
      </p>

      <h2 id="account-deletion">10. Account Deletion</h2>
      <p>
        You may request deletion of your DeeDyte account. Where available in the product,
        you can use the in-app or web account deletion flow (including{" "}
        <Link href="/account/delete">Account deletion</Link>
        ). Deleting your account removes or deactivates personal profile data associated
        with your account, subject to information we must retain for legal, security,
        dispute, or transaction integrity purposes.
      </p>

      <h2 id="children">11. Children&apos;s Privacy</h2>
      <p>
        DeeDyte is not directed to children under 18, and we do not knowingly collect
        personal information from children. If you believe a child has provided personal
        information to us, contact{" "}
        <a href="mailto:admin@deedyte.com">admin@deedyte.com</a> and we will take appropriate
        steps to review and delete the information where required.
      </p>

      <h2 id="third-parties">12. Third-Party Services and Links</h2>
      <p>
        DeeDyte may contain links to third-party websites, apps, or services (including
        vendor policies or external payment pages). We are not responsible for the privacy
        practices of those third parties. Their collection and use of information is governed
        by their own policies.
      </p>

      <h2 id="international">13. International Data Transfers</h2>
      <p>
        DeeDyte may be accessed from different locations, and information may be processed
        in countries other than where you live—including by infrastructure or service
        providers that support the Services. Where we transfer personal information across
        borders, we take steps designed to protect it in accordance with this Policy and
        applicable law.
      </p>

      <h2 id="changes">14. Changes to This Privacy Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. When we do, we will revise the
        &quot;Last updated&quot; date above and, where appropriate, provide additional notice
        in the Services. Continued use of DeeDyte after an update means you acknowledge the
        revised Policy.
      </p>

      <h2 id="contact">15. Contact Information</h2>
      <p>
        If you have questions about this Privacy Policy or DeeDyte privacy practices, contact:
      </p>
      <ul>
        <li>
          <strong>Developer:</strong> Thetabeam
        </li>
        <li>
          <strong>App:</strong> DeeDyte
        </li>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:admin@deedyte.com">admin@deedyte.com</a>
        </li>
        <li>
          <strong>Related pages:</strong>{" "}
          <Link href="/terms-of-use">Terms of Use</Link>,{" "}
          <Link href="/legal">Legal</Link>,{" "}
          <Link href="/contact">Contact</Link>
        </li>
      </ul>
    </article>
  );
}
