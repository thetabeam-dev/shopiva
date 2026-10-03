/**
 * Legal hub — links to authoritative DeeDyte legal documents.
 * @module components/legal/LegalHubContent
 */

import React from "react";
import Link from "next/link";

const DOCS = [
  {
    title: "Privacy Policy",
    href: "/privacy-policy",
    description:
      "How DeeDyte collects, uses, shares, and protects personal information for customers and vendors.",
  },
  {
    title: "Terms of Use",
    href: "/terms-of-use",
    description:
      "The rules that govern use of DeeDyte’s website, mobile apps, marketplace, and related services.",
  },
  {
    title: "About DeeDyte",
    href: "/about",
    description:
      "Learn who we are and why we built an all-in-one commerce platform for buyers and sellers.",
  },
  {
    title: "Contact Us",
    href: "/contact",
    description:
      "Reach Thetabeam for privacy requests, support questions, and general inquiries.",
  },
  {
    title: "Account Deletion",
    href: "/account/delete",
    description:
      "Request permanent deletion of your DeeDyte account and associated personal data where allowed.",
  },
];

export default function LegalHubContent() {
  return (
    <article className="legal-page__article">
      <p className="legal-page__meta">
        These documents apply to DeeDyte (developed by Thetabeam), including our website and
        mobile applications published under package identifier{" "}
        <code>com.thetabeam.shopiva</code>.
      </p>
      <p>
        Use the links below for the current, authoritative versions of DeeDyte’s legal and
        informational pages. The same pages are shared by entrepreneurs and customers so
        everyone relies on one source of truth.
      </p>

      <div className="legal-page__card-grid" style={{ marginTop: 28 }}>
        {DOCS.map((doc) => (
          <div className="legal-page__card" key={doc.href}>
            <h3>{doc.title}</h3>
            <p>{doc.description}</p>
            <Link href={doc.href}>View {doc.title}</Link>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 40 }}>Questions</h2>
      <p>
        For legal or privacy questions, email{" "}
        <a href="mailto:admin@deedyte.com">admin@deedyte.com</a>.
      </p>
    </article>
  );
}
