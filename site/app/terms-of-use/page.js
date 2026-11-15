"use client";

import React from "react";
import LegalPageShell from "../../components/legal/LegalPageShell";
import TermsOfUseContent, {
  TERMS_TOC,
} from "../../components/legal/TermsOfUseContent";

export default function TermsOfUsePage() {
  return (
    <LegalPageShell
      title="Terms of Use — Making Commerce Safe For Everyone"
      subtitle="Rules for using DeeDyte as a buyer or seller"
      toc={TERMS_TOC}
    >
      <TermsOfUseContent />
    </LegalPageShell>
  );
}
