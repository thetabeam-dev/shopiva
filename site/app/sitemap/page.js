'use client'
import React, { useEffect } from 'react'
import './style/xxl.css'
export default function Sitemap() {

    useEffect(() => {
        document.body.style.background='#fff'
        document.querySelector('header').style.height='70px'
        document.querySelector('header').style.position='sticky'
        document.querySelector('header').style.top='0px'
        document.querySelector('header').style.background='#fff'
        document.querySelector('header').classList = 'shadow-sm'
    }, [])
  return (
    <>
      <div className="entrepreneur-sitemap-cnt">


        <section>
            <h1>Deedyte Sitemap</h1>
        </section>
        <section>
            {/* <h1>Sitemap</h1> */}

            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Home</></span>
                
                <div className='sitemap-list'>Hompage</div>
            </div>
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Login</></span>
                
                <div className='sitemap-list'>Store login</div>
            </div>
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Start</></span>
                
                <div className='sitemap-list'>Start your business</div>
                <div className='sitemap-list'>Ecommerce platform</div>
            </div>
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Sell</></span>
                
                {
                    [
                        'Sell everywhere',
                        'Sales channels',
                        'Sell Online',
                        'Features',
                        'Point of sale',
                        'Features',
                        'Hardware store',
                        'Buy Button',
                        'Sell on Facebook and Instagram',
                        'International commerce',
                        'Check out customers',
                        'Pos pricing',
                        'Multi-Store Pos',
                        'Omnichannel',
                        'Retail pos system'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>
        
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Market</></span>
                
                {
                    [
                        'Market your business',
                        'Facebook Ads',
                        'Google Performance Max',
                        'Nurture customers',
                        'Chat with customers'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Manage</></span>
                
                {
                    [
                        'Manage everything',
                        'Manage your stock & orders',
                        'Measure your performance',
                        'Automate your business'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Resources</></span>
                
                {
                
                    [
                        'Blog',
                        'Free stock photos',
                        'Free tools',
                        'Forums',
                        'Theme Store',
                        'App Store',
                        'Guides',
                        'Podcasts',
                        'Legal',
                        'Print on Demand',
                        'Stay Open',
                        'Deedyte store examples'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)

                }
            </div>
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Company</></span>
                
                {
                    [
                        'About',
                        'Careers',
                        'Press and Media',
                        'Press releases',
                        'Brand',
                        'Partner program',
                        'Affiliate program',
                        'App developers',
                        'Investors'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>


            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Pricing</></span>
                
                {
                    [
                        'Overview',
                        'Starter plan',
                        'Enterprise'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>

            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Help Center</></span>
                
                {
                    [
                        'Deedyte Help Center',
                        'Contact Deedyte',
                        'API documentation',
                        'Theme support'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>

            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Payment gateways</></span>
                
                {
                    [
                        'Online payment solution'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>

            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Solutions</></span>
                
                {
                    [
                        'Charge',
                        'Deedyte discounts',
                        'Deedyte forms',
                        'Deedyte forms',
                        'Inbox',
                        'Deedyte Magic',
                        'Automations',
                        'Automations',
                        'Marketing automation tools',
                        'Subscriptions',
                        'Tax-Platform'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>
        </section>

        <section>
            <h1>Deedyte By Topic</h1>
        </section>
        <section>
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Ecommerce Overview</></span>
                
                {
                    [
                        'Home',
                        'Features',
                        'Ecommerce Blog',
                        'Mobile',
                        'FAQ'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>POS Overview</></span>
                
                {
                    [
                        'POS Hardware',
                        'iPad POS'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Features</></span>
                
                {
                
                    [
                        'Running your store',
                        'Secure shopping cart',
                        'Ecommerce hosting',
                        'PCI Compliant',
                        'Online Store'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)

                }
            </div>
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Comparison</></span>
                
                {
                    [
                        'Compare Deedyte',
                        'Deedyte VS Jiji',
                        'Deedyte VS Jumia',
                        'Deedyte VS Konga',
                        'Deedyte VS Prestashop',
                        'Deedyte VS Ti-Mart',
                        'Deedyte VS Udalla',
                        'Deedyte VS Omnibiz Retail',
                        'Deedyte VS Q-Shop'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>


            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Deedyte</></span>
                
                {
                    [
                        'Open Source Projects'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>POS Overview</></span>
                
                {
                    [
                        'POS Hardware',
                        'iPad POS'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Social</></span>
                
                {
                
                    [
                        'Facebook',
                        'Twitter',
                        'YouTube',
                        'LinkedIn'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)

                }
            </div>
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>International</></span>
                
                {
                    [
                        'Nigeria',
                        'Kenya',
                        'Ghana',
                        'Cameroun',
                        'Ethiopia',
                        'Zimbabwe',
                        'Senegal',
                        'South Africa'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>


            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Articles</></span>
                
                {
                    [
                        'Ecommerce Entrepreneurship'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)
                }
            </div>
            <div id='sitemap-list-cnt'>
                <span className='sitemap-list-head'><>Resources</></span>
                
                {
                
                    [
                        'Business Encyclopedia',
                        'Forums',
                        'App Store',
                        'Website Builder',
                        'Start a Business From Home',
                        'Dropshipping Business',
                        'Accept Apple Pay',
                        'Accept Google Pay'
                    ].map((item, index) => <div key={index} className='sitemap-list'>{item}</div>)

                }
            </div>
           
        </section>

      </div>
    </>
  )
}
