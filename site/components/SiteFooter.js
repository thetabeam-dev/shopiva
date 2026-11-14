"use client";

import logo_img from "../images/Deedyte.png";
import {
  APP_STORE_URL,
  LEGAL_AND_DOC_LINKS,
  PLAY_STORE_URL,
} from "../lib/siteNavigation";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <section className="footer-banner" aria-hidden="true" />

      <section className="footer-main">
        <div className="footer-brand">
          <div className="footer-logo-row">
            <img
              className="footer-logo"
              src={logo_img.src}
              alt="Deedyte logo"
              width={48}
              height={48}
              style={{ width: 48, height: 48, objectFit: "contain" }}
            />
          </div>
          <span className="footer-contact-spacer" aria-hidden="true" />
          <div>
            <h6 className="footer-contact">admin@deedyte.com</h6>
          </div>
        </div>

        <div className="footer-column">
          <h6 className="footer-heading">Get the app</h6>
          <ul className="footer-links">
            <li className="footer-link">
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" style={{ color: "#fff" }}>
                App Store
              </a>
            </li>
            <li className="footer-link">
              <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" style={{ color: "#fff" }}>
                Google Play
              </a>
            </li>
          </ul>
        </div>

        <div className="footer-column">
          <h6 className="footer-heading">Legal & docs</h6>
          <ul className="footer-links">
            {LEGAL_AND_DOC_LINKS.map((link) => (
              <li
                className="footer-link"
                key={link.path}
                onClick={() => {
                  window.location.href = link.path;
                }}
              >
                {link.title}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <hr className="footer-divider" />

      <section className="footer-bottom copywright">
        <div className="footer-copyright">
          <small>&#169; Copyright {new Date().getFullYear()}</small>
        </div>

        <div className="footer-social">
          <ul className="footer-social-list">
            <li
              className="footer-social-item"
              onClick={() =>
                window.open("https://www.facebook.com/profile.php?id=61566898641430")
              }
            >
              <i className="fa-brands fa-facebook fa-lg footer-social-icon" />
            </li>
            <li
              className="footer-social-item"
              onClick={() =>
                window.open("https://x.com/Deedyte_shop?t=NgevY7O7ygFe_AW0C-OgSg&s=09")
              }
            >
              <i className="fa-brands fa-twitter fa-lg footer-social-icon" />
            </li>
            <li
              className="footer-social-item"
              onClick={() =>
                window.open("https://whatsapp.com/channel/0029VacobY6LY6d7M19cx90O")
              }
            >
              <i className="fa-brands fa-whatsapp fa-lg footer-social-icon" />
            </li>
            <li
              className="footer-social-item"
              onClick={() => window.open("https://youtube.com/@deedyte?si=Euobslo-XoWD0Kqc")}
            >
              <i className="fa-brands fa-youtube fa-lg footer-social-icon" />
            </li>
          </ul>
        </div>
      </section>
    </footer>
  );
}
