"use client";

import React, { useEffect } from "react";
import Head from "../../components/entrepreneur/term_of_use/Head";
import Body from "../../components/entrepreneur/term_of_use/Body";
import "../entrepreneur/[id]/terms-of-use/styles/xxl.css";
import "../entrepreneur/[id]/terms-of-use/global.css";

export default function TermsOfUsePage() {
  useEffect(() => {
    document.body.style.background = "#fff";
    const header = document.querySelector("header");
    if (header) {
      header.style.position = "sticky";
      header.style.background = "#000";
      header.style.top = "0px";
      header.style.height = "70px";
    }
  }, []);

  return (
    <div className="tou-cnt">
      <Head />
      <Body />
    </div>
  );
}
