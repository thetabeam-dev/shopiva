"use client";

import React from "react";
import LegalPageShell from "../../components/legal/LegalPageShell";
import PrivacyPolicyContent, {
  PRIVACY_TOC,
} from "../../components/legal/PrivacyPolicyContent";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy — Making Commerce Safe For Everyone"
      subtitle="How DeeDyte protects your data while you buy and sell"
      toc={PRIVACY_TOC}
    >
      <PrivacyPolicyContent />
    </LegalPageShell>
  );
}
