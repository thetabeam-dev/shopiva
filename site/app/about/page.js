"use client";

import React, { useEffect } from "react";
import Head from "../../components/entrepreneur/about/Head";
import Story from "../../components/entrepreneur/about/Story";
import Mission from "../../components/entrepreneur/about/Mission";
import Commitment from "../../components/entrepreneur/about/Commitment";
import "../entrepreneur/[id]/about/styles/xxl.css";
import "../entrepreneur/[id]/about/styles/s.css";
import "../entrepreneur/[id]/about/global.css";
import "../entrepreneur/[id]/styles/s.css";
import "../entrepreneur/[id]/styles/m.css";
import "../entrepreneur/[id]/styles/l.css";
import "../entrepreneur/[id]/styles/xl.css";
import "../entrepreneur/[id]/styles/xxl.css";

export default function AboutPage() {
  useEffect(() => {
    document.body.style.background = "#00b688";
    const main = document.body.querySelector("main");
    if (main) main.style.background = "#00b688";
    const header = document.querySelector("header");
    if (header) header.style.height = "70px";
  }, []);

  return (
    <div className="pricing-cnt">
      <Head />
      <Story />
      <Mission />
      <Commitment />
    </div>
  );
}
