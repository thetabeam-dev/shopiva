"use client";

import React from "react";
import LegalPageShell from "../../components/legal/LegalPageShell";
import LegalHubContent from "../../components/legal/LegalHubContent";

export default function LegalPage() {
  return (
    <LegalPageShell
      title="Legal"
      subtitle="Important information about using DeeDyte"
    >
      <LegalHubContent />
    </LegalPageShell>
  );
}
