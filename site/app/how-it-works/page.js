"use client";

import React from "react";
import Link from "next/link";
import LegalPageShell from "../../components/legal/LegalPageShell";
import BasketSvg from "../../svgs/basket.svg";
import PhoneSvg from "../../svgs/phone.svg";
import BikeSvg from "../../svgs/bike.svg";
import { APP_STORE_URL, PLAY_STORE_URL } from "../../lib/siteNavigation";

const STEPS = [
  {
    icon: PhoneSvg,
    title: "Explore DeeDyte",
    summary:
      "Discover products from different vendors, explore their shops, compare options, and find what you need in one convenient marketplace.",
  },
  {
    icon: BasketSvg,
    title: "Connect and Make a Purchase",
    summary:
      "Start a conversation with vendors, ask questions, discuss product details, and place your order with confidence through DeeDyte.",
  },
  {
    icon: BikeSvg,
    title: "Receive Your Order with Confidence",
    summary:
      "Complete your payment through DeeDyte's secure transaction process. Your purchase is supported by escrow protection and dispute resolution to help make every transaction safer.",
  },
];

export default function HowItWorksPage() {
  return (
    <LegalPageShell
      title="How DeeDyte Works"
      subtitle="From discovery to protected checkout — a safer way to buy and sell locally."
    >
      <article className="legal-page__article">
        <p className="legal-page__meta">
          DeeDyte helps buyers and vendors complete transactions with clearer communication and
          stronger payment protection.
        </p>

        <div className="legal-page__card-grid" style={{ marginTop: 8 }}>
          {STEPS.map((step) => (
            <div className="legal-page__card" key={step.title}>
              <img
                src={step.icon.src}
                alt=""
                width={48}
                height={48}
                style={{ width: 48, height: 48, objectFit: "contain", marginBottom: 12 }}
              />
              <h3>{step.title}</h3>
              <p>{step.summary}</p>
            </div>
          ))}
        </div>

        <h2 style={{ marginTop: 40 }}>Ready to get started?</h2>
        <p>
          Browse products on the{" "}
          <Link href="/">DeeDyte marketplace</Link>, learn more{" "}
          <Link href="/about">about DeeDyte</Link>, or download the app to chat with vendors and
          complete protected purchases.
        </p>
        <ul>
          <li>
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
              Download on the App Store
            </a>
          </li>
          <li>
            <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
              Get it on Google Play
            </a>
          </li>
        </ul>
      </article>
    </LegalPageShell>
  );
}
