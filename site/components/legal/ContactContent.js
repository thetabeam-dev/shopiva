/**
 * Contact page content for DeeDyte.
 * @module components/legal/ContactContent
 */

"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function ContactContent() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("general");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent(`[DeeDyte ${topic}] Message from ${name || "user"}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`
    );
    window.location.href = `mailto:admin@deedyte.com?subject=${subject}&body=${body}`;
    setStatus(
      "Your email app should open with your message. If it does not, email admin@deedyte.com directly."
    );
  };

  return (
    <article className="legal-page__article">
      <p className="legal-page__meta">
        Developer: Thetabeam · App: DeeDyte · Email:{" "}
        <a href="mailto:admin@deedyte.com">admin@deedyte.com</a>
      </p>
      <p>
        We are here to help with account questions, privacy requests, vendor onboarding,
        and general platform inquiries. For privacy-specific requests, please mention
        &quot;Privacy Request&quot; in your subject line.
      </p>

      <h2>Contact details</h2>
      <ul>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:admin@deedyte.com">admin@deedyte.com</a>
        </li>
        <li>
          <strong>Privacy Policy:</strong>{" "}
          <Link href="/privacy-policy">/privacy-policy</Link>
        </li>
        <li>
          <strong>Terms of Use:</strong>{" "}
          <Link href="/terms-of-use">/terms-of-use</Link>
        </li>
        <li>
          <strong>Legal hub:</strong> <Link href="/legal">/legal</Link>
        </li>
      </ul>

      <h2>Send a message</h2>
      <form className="legal-page__contact-form" onSubmit={onSubmit}>
        <label>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your name"
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
          />
        </label>
        <label>
          Topic
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="general">General inquiry</option>
            <option value="privacy">Privacy request</option>
            <option value="account">Account support</option>
            <option value="vendor">Vendor / shop support</option>
            <option value="legal">Legal</option>
          </select>
        </label>
        <label>
          Message
          <textarea
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            placeholder="How can we help?"
          />
        </label>
        <button type="submit">Continue to email</button>
      </form>
      {status ? <p style={{ marginTop: 16, color: "#444" }}>{status}</p> : null}
    </article>
  );
}
