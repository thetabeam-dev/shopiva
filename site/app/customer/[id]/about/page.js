"use client"
import React, { useEffect } from 'react'
import './styles/xxl.css'
import './styles/s.css'
import './global.css'


import '../styles/s.css'
import '../styles/m.css'
import '../styles/l.css'
import '../styles/xl.css'
import '../styles/xxl.css'


import Head from '../../../../components/entrepreneur/about/Head'
import Story from '../../../../components/entrepreneur/about/Story'
import Mission from '../../../../components/entrepreneur/about/Mission'
import Commitment from '../../../../components/entrepreneur/about/Commitment'
export default function About() {

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
      <div className="pricing-cnt">

        <Head />

        <Story />

        <Mission />

        <Commitment />

      </div>
    </>
  )
}
