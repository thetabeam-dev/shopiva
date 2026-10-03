"use client";

import React from "react";
import LegalPageShell from "../../components/legal/LegalPageShell";
import PrivacyPolicyContent, {
  PRIVACY_TOC,
} from "../../components/legal/PrivacyPolicyContent";

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      subtitle="How DeeDyte handles your data"
      toc={PRIVACY_TOC}
    >
      <PrivacyPolicyContent />
    </LegalPageShell>
  );
}
