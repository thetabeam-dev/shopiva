"use client"
import React, { useEffect } from 'react'
import './styles/xxl.css'
import './global.css'


import Head from '../../../../components/entrepreneur/privacy_policy/Head'
import Body from '../../../../components/entrepreneur/privacy_policy/Body'
export default function PrivacyPolicy() {

  useEffect(() => {
    document.body.classList.add('about-bg')
    const main = document.body.querySelector('main')
    if (main) main.classList.add('about-main-bg')
    const header = document.querySelector('header')
    if (header) header.classList.add('about-header')
    return () => {
      document.body.classList.remove('about-bg')
      const main = document.body.querySelector('main')
      if (main) main.classList.remove('about-main-bg')
      const header = document.querySelector('header')
      if (header) header.classList.remove('about-header')
    }
  }, [])
  return (
    <>
      <div className="privacy-policy-cnt">
        <Head />

        <Body />

      </div>
    </>
  )
}
