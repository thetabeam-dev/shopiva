"use client";

import { useEffect, useState } from "react";
import {
  IoCarOutline,
  IoChevronForward,
  IoClose,
  IoPhonePortraitOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import { APP_STORE_URL, PLAY_STORE_URL } from "../../lib/siteNavigation";

function storeOpenUrl() {
  if (typeof navigator === "undefined") return PLAY_STORE_URL;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return APP_STORE_URL;
  return PLAY_STORE_URL;
}

export default function CustomerHeaderHead() {
  const [dismissed, setDismissed] = useState(false);
  const [openHref, setOpenHref] = useState(PLAY_STORE_URL);

  useEffect(() => {
    setOpenHref(storeOpenUrl());
  }, []);

  const ups = [
    {
      Icon: IoCarOutline,
      iconColor: "#00926e",
      title: "Free shipping on all orders",
      chevron: true,
      summary: "Limited-time offer",
    },
    {
      Icon: IoShieldCheckmarkOutline,
      iconColor: "#00926e",
      title: "Delivery guarantee",
      summary: "Refund for any issues",
    },
    {
      Icon: IoPhonePortraitOutline,
      iconColor: "#00926e",
      title: "Get the DeeDyte App",
      summary: "",
    },
  ];

  return (
    <>
      {!dismissed ? (
        <div className="deedyte-app-banner" role="region" aria-label="Get the DeeDyte app">
          <button
            type="button"
            className="deedyte-app-banner__close"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
          >
            <IoClose size={18} color="#8A8A8A" />
          </button>
          <img
            className="deedyte-app-banner__icon"
            src="/Deedyte.png"
            alt=""
            width={40}
            height={40}
          />
          <div className="deedyte-app-banner__copy">
            <strong>DeeDyte: Shop nearby deals</strong>
            <span>Shop incredible deals on DeeDyte!</span>
          </div>
          <a
            className="deedyte-app-banner__open"
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            OPEN
          </a>
        </div>
      ) : null}

      <div className="deedyte-ups">
        {ups.map((data, i) => {
          const Icon = data.Icon;
          return (
            <div className="deedyte-ups-item" key={i}>
              <Icon size={22} color={data.iconColor} />
              <div>
                <h3>
                  {data.title}
                  {data.chevron ? <IoChevronForward size={12} /> : null}
                </h3>
                {data.summary ? <p>{data.summary}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
