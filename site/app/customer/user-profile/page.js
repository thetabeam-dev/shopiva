"use client"
import React, { useCallback, useEffect, useState } from 'react'
import './styles/s.css'
import './styles/xxl.css'
import { useDispatch } from 'react-redux'
import { set_entrepreneur_data_to } from '../../../redux/entrepreneur/entrepreneur_data'

const API_PROXY = "/api/backend"

const GENDER_SELECT_OPTIONS = [
  { value: "", label: "Prefer not to say" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non-binary", label: "Non-binary" },
  { value: "other", label: "Other" },
]

function genderValueFromProfile(raw) {
  if (raw == null || String(raw).trim() === "") return ""
  const s = String(raw).trim()
  const lower = s.toLowerCase()
  if (lower === "female" || lower === "male" || lower === "non-binary" || lower === "other") return lower
  if (lower === "nonbinary" || lower === "non binary") return "non-binary"
  return s
}

function normalizeUserRow(u) {
  if (!u || typeof u !== "object") return null
  return {
    id: u.id,
    fname: u.fname ?? "",
    lname: u.lname ?? "",
    email: u.email ?? "",
    phone: u.phone != null ? String(u.phone) : "",
    gender: u.gender ?? null,
    preferredLanguage: u.preferredLanguage ?? u.preferredlanguage ?? "en",
    timezone: u.timezone ?? "UTC",
    isEmailVerified: Boolean(u.isEmailVerified ?? u.isemailverified),
    isPhoneVerified: Boolean(u.isPhoneVerified ?? u.isphoneverified),
    lastLogin: u.lastLogin ?? u.lastlogin ?? null,
  }
}

async function backendPut(path, body) {
  const res = await fetch(`${API_PROXY}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`)
  }
  return data
}

export default function UserProfile() {
  const dispatch = useDispatch()
  const [active_panel, set_active_panel] = useState(1)
  const [profile, set_profile] = useState(null)
  const [profileLoading, set_profileLoading] = useState(true)
  const [profileError, set_profileError] = useState("")

  const loadProfile = useCallback(async () => {
    set_profileLoading(true)
    set_profileError("")
    try {
      const res = await fetch(`${API_PROXY}/user/authorization`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      })
      const response = await res.json().catch(() => ({}))
      if (response.bool && response.data) {
        const normalized = normalizeUserRow(response.data)
        set_profile(normalized)
        if (normalized) {
          dispatch(
            set_entrepreneur_data_to({
              id: normalized.id,
              email: normalized.email,
              fname: normalized.fname,
              lname: normalized.lname,
              name: [normalized.fname, normalized.lname].filter(Boolean).join(" ").trim() || normalized.email,
            })
          )
        }
      } else {
        set_profile(null)
        set_profileError(
          typeof response.data === "string" ? response.data : response.message || "Could not load profile."
        )
      }
    } catch {
      set_profile(null)
      set_profileError("Could not load profile.")
    } finally {
      set_profileLoading(false)
    }
  }, [dispatch])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const initials =
    profile &&
    [profile.fname?.[0], profile.lname?.[0]].filter(Boolean).join("").toUpperCase()

  return (
    <div className="up-page">
      <header className="up-header shadow-sm">
        <section>
          <span className="up-header__brand">Deedyte</span>
        </section>
        <section>
          <span className="up-avatar" aria-hidden>
            {initials || "—"}
          </span>
          <span className="up-header__user-name">
            {profileLoading ? "Loading…" : `${profile?.fname ?? ""} ${profile?.lname ?? ""}`.trim() || "—"}
          </span>
        </section>
      </header>

      <main className="up-main">
        <div className="up-nav-wrap">
          <nav className="up-nav" aria-label="Profile sections">
            <button
              type="button"
              className={`up-nav__btn${active_panel === 1 ? " up-nav__btn--active" : ""}`}
              aria-pressed={active_panel === 1}
              onClick={() => set_active_panel(1)}
            >
              General
            </button>
            <button
              type="button"
              className={`up-nav__btn${active_panel === 0 ? " up-nav__btn--active" : ""}`}
              aria-pressed={active_panel === 0}
              onClick={() => set_active_panel(0)}
            >
              Security
            </button>
          </nav>
        </div>

        <hr className="up-divider" />

        <div className="up-content">
          <div className="up-content__inner">
            {/* <h1 className="up-content__heading">{active_panel ? "General" : "Security"}</h1> */}
            {profileError ? <p className="up-alert up-alert--error">{profileError}</p> : null}
            {active_panel ? (
              <Genenral
                profile={profile}
                profileLoading={profileLoading}
                onProfileRefresh={loadProfile}
              />
            ) : (
              <Security profile={profile} profileLoading={profileLoading} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}



function Genenral({ profile, profileLoading, onProfileRefresh }) {
  const [lang, set_lang] = useState([])
  const [time_zone, set_time_zone] = useState([])

  const [fname, set_fname] = useState("")
  const [lname, set_lname] = useState("")
  const [email, set_email] = useState("")
  const [phone, set_phone] = useState("")
  const [gender, set_gender] = useState("")
  const [preferredLanguage, set_preferredLanguage] = useState("en")
  const [timezone, set_timezone] = useState("UTC")

  const [detailSaving, set_detailSaving] = useState(false)
  const [detailErr, set_detailErr] = useState("")
  const [detailOk, set_detailOk] = useState(false)
  const [emailSaving, set_emailSaving] = useState(false)
  const [emailErr, set_emailErr] = useState("")
  const [emailOk, set_emailOk] = useState(false)
  const [phoneSaving, set_phoneSaving] = useState(false)
  const [phoneErr, set_phoneErr] = useState("")
  const [phoneOk, set_phoneOk] = useState(false)
  const [prefsSaving, set_prefsSaving] = useState(false)
  const [prefsErr, set_prefsErr] = useState("")
  const [prefsOk, set_prefsOk] = useState(false)

  useEffect(() => {
    if (!profile) return
    set_fname(profile.fname ?? "")
    set_lname(profile.lname ?? "")
    set_email(profile.email ?? "")
    set_phone(profile.phone ?? "")
    set_gender(genderValueFromProfile(profile.gender))
    set_preferredLanguage(profile.preferredLanguage?.trim() || "en")
    set_timezone(profile.timezone?.trim() || "UTC")
    set_detailErr("")
    set_emailErr("")
    set_phoneErr("")
    set_detailOk(false)
    set_emailOk(false)
    set_phoneOk(false)
    set_prefsErr("")
    set_prefsOk(false)
  }, [profile])

  useEffect(() => {
    fetch(`${API_PROXY}/entrepreneur/lang`)
      .then(async (result) => {
        const response = await result.json()
        set_lang(response.data ?? [])
      })
      .catch(() => set_lang([]))
  }, [])

  useEffect(() => {
    fetch(`${API_PROXY}/entrepreneur/timezones`)
      .then(async (result) => {
        const response = await result.json()
        set_time_zone(response.data ?? [])
      })
      .catch(() => set_time_zone([]))
  }, [])

  const userId = profile?.id
  const formDisabled = profileLoading || !userId

  const initials =
    [fname?.[0], lname?.[0]].filter(Boolean).join("").toUpperCase() || "—"

  async function saveDetails() {
    if (!userId) return
    set_detailSaving(true)
    set_detailErr("")
    set_detailOk(false)
    try {
      await backendPut(`/user/profile/update/${userId}`, {
        fname: fname.trim(),
        lname: lname.trim(),
        gender: gender.trim() || null,
      })
      await onProfileRefresh?.()
      set_detailOk(true)
      window.setTimeout(() => set_detailOk(false), 2800)
    } catch (e) {
      set_detailErr(e instanceof Error ? e.message : "Could not save.")
    } finally {
      set_detailSaving(false)
    }
  }

  async function saveEmail() {
    if (!userId) return
    set_emailSaving(true)
    set_emailErr("")
    set_emailOk(false)
    try {
      await backendPut(`/user/email/update/${userId}`, { email: email.trim() })
      await onProfileRefresh?.()
      set_emailOk(true)
      window.setTimeout(() => set_emailOk(false), 2800)
    } catch (e) {
      set_emailErr(e instanceof Error ? e.message : "Could not update email.")
    } finally {
      set_emailSaving(false)
    }
  }

  async function savePhone() {
    if (!userId) return
    set_phoneSaving(true)
    set_phoneErr("")
    set_phoneOk(false)
    try {
      await backendPut(`/user/phone/update/${userId}`, { phone: phone.trim() })
      await onProfileRefresh?.()
      set_phoneOk(true)
      window.setTimeout(() => set_phoneOk(false), 2800)
    } catch (e) {
      set_phoneErr(e instanceof Error ? e.message : "Could not update phone.")
    } finally {
      set_phoneSaving(false)
    }
  }

  async function savePreferences() {
    if (!userId) return
    set_prefsSaving(true)
    set_prefsErr("")
    set_prefsOk(false)
    try {
      await backendPut(`/user/profile/update/${userId}`, {
        preferredLanguage: preferredLanguage.trim() || null,
        timezone: timezone.trim() || null,
      })
      await onProfileRefresh?.()
      set_prefsOk(true)
      window.setTimeout(() => set_prefsOk(false), 2800)
    } catch (e) {
      set_prefsErr(e instanceof Error ? e.message : "Could not save preferences.")
    } finally {
      set_prefsSaving(false)
    }
  }

  return (
    <>
      <div className="up-description">
        <section className="up-section-intro">
          <h2 className="up-section-intro__title">Details</h2>
          <p className="up-section-intro__text">View and update your personal details.</p>
        </section>
        <div className="up-content-cnt">
          <section>
            <div className="up-photo-row">
              <span className="up-avatar up-avatar--lg" aria-hidden>
                {initials}
              </span>
              <button type="button" className="up-btn--ghost" disabled>
                Upload photo
              </button>
            </div>

            <div className="up-names-cnt">
              <div className="up-input-cnt">
                <label htmlFor="up-fname">First name</label>
                <input
                  id="up-fname"
                  type="text"
                  value={fname}
                  onChange={(e) => set_fname(e.target.value)}
                  placeholder="First name"
                  disabled={formDisabled}
                  autoComplete="given-name"
                />
              </div>
              <div className="up-input-cnt">
                <label htmlFor="up-lname">Last name</label>
                <input
                  id="up-lname"
                  type="text"
                  value={lname}
                  onChange={(e) => set_lname(e.target.value)}
                  placeholder="Last name"
                  disabled={formDisabled}
                  autoComplete="family-name"
                />
              </div>
              <div className="up-input-cnt">
                <label htmlFor="up-gender">Gender (optional)</label>
                <select
                  id="up-gender"
                  name="gender"
                  value={gender}
                  onChange={(e) => set_gender(e.target.value)}
                  disabled={formDisabled}
                  autoComplete="sex"
                >
                  {GENDER_SELECT_OPTIONS.map((opt) => (
                    <option key={opt.value || "unset"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                  {gender &&
                  !GENDER_SELECT_OPTIONS.some((opt) => opt.value === gender) ? (
                    <option value={gender}>{gender}</option>
                  ) : null}
                </select>
              </div>
            </div>

            {detailErr ? (
              <p className="up-msg up-msg--error" role="alert">
                {detailErr}
              </p>
            ) : null}
            {detailOk ? (
              <p className="up-msg up-msg--success" role="status">
                Name and details saved.
              </p>
            ) : null}
            <div className="up-form-actions up-form-actions--row">
              <button
                type="button"
                className="up-btn up-btn--update"
                disabled={formDisabled || detailSaving}
                onClick={saveDetails}
              >
                {detailSaving ? "Saving…" : "Save name & details"}
              </button>
            </div>

            <div className="up-email-section">
              <div className="up-field-with-action">
                <div className="up-input-cnt">
                  <label htmlFor="up-email">Email</label>
                  <input
                    id="up-email"
                    value={email}
                    onChange={(e) => set_email(e.target.value)}
                    type="email"
                    placeholder="you@example.com"
                    disabled={formDisabled}
                    autoComplete="email"
                  />
                </div>
                <div className="up-inline-actions">
                  <span
                    className={`up-badge${profile?.isEmailVerified ? "" : " up-badge--muted"}`}
                  >
                    {profile?.isEmailVerified ? "Verified" : "Unverified"}
                  </span>
                  <button
                    type="button"
                    className="up-btn up-btn--update up-btn--small"
                    disabled={formDisabled || emailSaving}
                    onClick={saveEmail}
                  >
                    {emailSaving ? "…" : "Update"}
                  </button>
                </div>
              </div>
              {emailErr ? (
                <p className="up-msg up-msg--error" role="alert">
                  {emailErr}
                </p>
              ) : null}
              {emailOk ? (
                <p className="up-msg up-msg--success" role="status">
                  Email updated.
                </p>
              ) : null}
            </div>

            <div className="up-phone-section">
              <div className="up-field-with-action">
                <div className="up-input-cnt">
                  <label htmlFor="up-phone">Phone number</label>
                  <input
                    id="up-phone"
                    value={phone}
                    onChange={(e) => set_phone(e.target.value)}
                    type="tel"
                    placeholder="+234 …"
                    disabled={formDisabled}
                    autoComplete="tel"
                  />
                </div>
                <div className="up-inline-actions">
                  <span
                    className={`up-badge${profile?.isPhoneVerified ? "" : " up-badge--muted"}`}
                  >
                    {profile?.isPhoneVerified ? "Verified" : "Unverified"}
                  </span>
                  <button
                    type="button"
                    className="up-btn up-btn--update up-btn--small"
                    disabled={formDisabled || phoneSaving}
                    onClick={savePhone}
                  >
                    {phoneSaving ? "…" : "Update"}
                  </button>
                </div>
              </div>
              {phoneErr ? (
                <p className="up-msg up-msg--error" role="alert">
                  {phoneErr}
                </p>
              ) : null}
              {phoneOk ? (
                <p className="up-msg up-msg--success" role="status">
                  Phone number updated.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      {/* <hr className="up-divider" /> */}

      {/* <div className="up-description">
        <section className="up-section-intro">
          <h2 className="up-section-intro__title">Stores</h2>
          <p className="up-section-intro__text">View and access stores connected to your Shopify account.</p>
        </section>
        <div className="up-content-cnt">
          <section>
            <Link className="up-link-card" href="/entrepreneur">
              View all stores
            </Link>
          </section>
        </div>
      </div> */}

      <hr className="up-divider" />

      <div className="up-description">
        <section className="up-section-intro">
          <h2 className="up-section-intro__title">Preferred language</h2>
          <p className="up-section-intro__text">
            This is the language we use for your signed-in experience on Deedyte (account pages and emails where
            applicable).
          </p>
        </section>
        <div className="up-content-cnt">
          <section>
            <div className="up-input-cnt up-field--block">
              <label htmlFor="up-lang">Language</label>
              <select
                id="up-lang"
                name="language"
                value={preferredLanguage}
                onChange={(e) => set_preferredLanguage(e.target.value)}
                disabled={formDisabled}
              >
                <option value="" disabled>
                  Select language
                </option>
                {preferredLanguage &&
                !lang.some((item) => String(item.code || item.name) === String(preferredLanguage)) ? (
                  <option value={preferredLanguage}>{preferredLanguage}</option>
                ) : null}
                {lang.map((item, index) => {
                  const optVal = item.code || item.name || String(index)
                  const label = item.code ? `${item.code} · ${item.name}` : item.name
                  return (
                    <option key={`${optVal}-${index}`} value={optVal}>
                      {label}
                    </option>
                  )
                })}
              </select>
            </div>
            <hr className="up-divider up-divider--in-card" />
            <div className="up-help">
              <p className="up-help__title">Regional format</p>
              <p>
                <small>
                  Number, date, and currency formatting follow your selected language and timezone.
                </small>
              </p>
            </div>
          </section>
        </div>
      </div>
      <hr className="up-divider" />

      <div className="up-description">
        <section className="up-section-intro">
          <h2 className="up-section-intro__title">Timezone</h2>
          <p className="up-section-intro__text">Choose the timezone used for your account activity and notifications.</p>
        </section>
        <div className="up-content-cnt">
          <section>
            <div className="up-input-cnt up-field--block">
              <label htmlFor="up-tz">Timezone</label>
              <select
                id="up-tz"
                name="timezone"
                value={timezone}
                onChange={(e) => set_timezone(e.target.value)}
                disabled={formDisabled}
              >
                <option value="" disabled>
                  Select timezone
                </option>
                {timezone &&
                !time_zone.some((item) => String(item.timezone) === String(timezone)) ? (
                  <option value={timezone}>{timezone}</option>
                ) : null}
                {time_zone.map((item, index) => (
                  <option key={index} value={item.timezone}>
                    {item.utc_offset ? `${item.utc_offset} · ${item.timezone}` : item.timezone}
                  </option>
                ))}
              </select>
            </div>
            {prefsErr ? (
              <p className="up-msg up-msg--error" role="alert">
                {prefsErr}
              </p>
            ) : null}
            {prefsOk ? (
              <p className="up-msg up-msg--success" role="status">
                Language and timezone saved.
              </p>
            ) : null}
            <div className="up-form-actions up-form-actions--row">
              <button
                type="button"
                className="up-btn up-btn--update"
                disabled={formDisabled || prefsSaving}
                onClick={savePreferences}
              >
                {prefsSaving ? "Saving…" : "Save language & timezone"}
              </button>
            </div>
            <div className="up-help">
              <p>
                <small>Used for activity timestamps and notifications tied to your account.</small>
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

function Security({ profile, profileLoading }) {
  const lastSeen =
    profile?.lastLogin != null
      ? (() => {
          try {
            return new Date(profile.lastLogin).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })
          } catch {
            return null
          }
        })()
      : null

  return (
        <>
            {/* <div className="up-description">
                <section style={{padding: '10px 10px ', minHeight: '50px', display: 'flex', alignItem: 'center', flexDirection: 'column', justifyContent: 'center'}}>
                    <p><b>Passkeys</b></p>
                    <p>
                        <small>
                        Log in with your fingerprint, face recognition or a PIN instead of a password. Passkeys can be synced across devices logged into the same platform (like Apple ID or a Google account).
                        </small>
                    </p>
                    <p><small>Learn More About Passkeys</small></p>
                </section>
                <div className="up-content-cnt" style={{height: '100px', padding: '10px'}}>
                    <section style={{height: 'auto', width: '100%', justifyContent: 'flex-start'}}>
                        <div>Creating a passkey takes under a minute.</div>
                        <button type="button" className="up-btn" style={{width: 'auto', borderRadius: '2.5px', marginTop: '10px'}}>Create A Passkey</button>
                    </section>
                </div>
            </div>

            <hr className="up-divider" /> */}

            {/* <div className="up-description">
                <section style={{padding: '10px 10px ', minHeight: '50px', display: 'flex', alignItem: 'center', flexDirection: 'column', justifyContent: 'center'}}>
                    <p><b>Password</b></p>
                    <small>
                    </small>
                </section>
                <div className="up-content-cnt">
                    <section style={{height: 'fit-content', width: '100%', justifyContent: 'flex-start'}}>
                        <div>You have not set a password on your account.</div>
                        <button type="button" className="up-btn" style={{width: 'auto', borderRadius: '2.5px', marginTop: '10px'}}>Create Password</button>
                    </section>
                </div>
            </div>

            <hr className="up-divider" /> */}

            {/* <div className="up-description">
                <section style={{padding: '10px 10px ', minHeight: '50px', display: 'flex', alignItem: 'center', flexDirection: 'column', justifyContent: 'center'}}>
                    <p><b>Secondary email</b></p>
                    <small>
                    A secondary email can be used to restore access to your account. Security notifications are also sent to this email.
                    </small>
                </section>
                <div className="up-content-cnt" style={{height: '50px'}}>
                    <section style={{height: '20px', justifyContent: 'flex-start', width: '100%'}}>
                        <div>You do not have a secondary email.</div>
                    </section>
                </div>
            </div>

            <hr className="up-divider" /> */}

      {/* <div className="up-description">
        <section className="up-section-intro">
          <h2 className="up-section-intro__title">Two-step authentication</h2>
          <p className="up-section-intro__text">Add an extra step after your password to protect your account.</p>
        </section>
        <div className="up-content-cnt">
          <section>
            <div className="up-security-block">
              <h4>Authentication methods</h4>
              <p>After entering your password, verify your identity with an authentication method.</p>
            </div>
            <div className="up-security-block">
              <h5>How it works</h5>
              <p>When you log in, you&apos;ll need to:</p>
              <div className="up-steps">
                <p>
                  <strong>1.</strong> Enter your email and password
                </p>
                <p>
                  <strong>2.</strong> Complete a second step to prove it&apos;s you — verification code, security key, or a
                  trusted device.
                </p>
              </div>
              <button type="button" className="up-btn">
                Turn on two-step
              </button>
            </div>
          </section>
        </div>
      </div> */}

      {/* <hr className="up-divider" /> */}

      <div className="up-description">
        <section className="up-section-intro">
          <h2 className="up-section-intro__title">Devices</h2>
          <p className="up-section-intro__text">
            You&apos;re logged in on these devices. If you don&apos;t recognize one, log out to keep your account secure.
          </p>
        </section>
        <div className="up-content-cnt">
          <section>
            <h4 className="up-device-list__title">Signed in</h4>
            <div className="up-device-list">
              <div className="up-device-card">
                <div className="up-device-card__info">
                  <div className="up-device-card__meta">
                    {profileLoading ? "Loading session…" : "This browser"}
                    <span className="up-device-card__badge">This device</span>
                  </div>
                  <div className="up-device-card__loc">
                    {lastSeen
                      ? `Last sign-in: ${lastSeen}`
                      : profile
                        ? "No recent sign-in time recorded."
                        : "—"}
                  </div>
                </div>
                <div className="up-device-card__actions">
                  <button type="button" className="up-btn up-btn--small" disabled>
                    Log out
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
