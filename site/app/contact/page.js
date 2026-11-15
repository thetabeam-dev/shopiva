"use client";

import React from "react";
import LegalPageShell from "../../components/legal/LegalPageShell";
import ContactContent from "../../components/legal/ContactContent";

export default function ContactPage() {
  return (
    <LegalPageShell
      title="Contact Us — Making Commerce Safe For Everyone"
      subtitle="Get in touch with Thetabeam about DeeDyte"
    >
      <ContactContent />
    </LegalPageShell>
  );
}
