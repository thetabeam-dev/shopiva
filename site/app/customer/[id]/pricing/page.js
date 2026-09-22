"use client"
import React, { useEffect } from 'react'
import './styles/s.css'
import './styles/xxl.css'


import '../styles/s.css'
import '../styles/m.css'
import '../styles/l.css'
import '../styles/xl.css'
import '../styles/xxl.css'


import ui_svg from '../../../../svgs/complete-ok-accept-good-tick-svgrepo-com.svg'
import plus_svg from '../../../../svgs/plus-circle-svgrepo-com.svg'

import summary_1_svg from '../../../../svgs/9d36b48155c935d6912dc78f33dd84cc.svg'
import summary_2_svg from '../../../../svgs/a0160a9073ac18b083d8d3ab2fd63866.svg'
import summary_3_svg from '../../../../svgs/9a0ec4dfb7a774bb3666745a58609900.svg'
import summary_4_svg from '../../../../svgs/6068938a5623e730c29fff2fbac436e4.svg'
import summary_5_svg from '../../../../svgs/3dff791cdf4e8c1a94c8df91a5531c48.svg'

export default function Pricing() { 

    useEffect(() => {
        document.body.style.background='#fff'
        document.querySelector('header').style.height='70px'
    }, [])
  return (
    <>
      <div className="pricing-cnt">


        <section>
            <h5>Plans & pricing</h5>

            <h1>Start for free, then enjoy
            <br />
            your first month for 1500</h1>

            <h5>Choose the best plan for your business. Change plans as you grow.</h5>

            <div className="input-cnt">
                <input placeholder='Enter your email address' type="email" name="" id="" autoComplete="email" />
                <button style={{textAlign: 'center'}}>Start free trial</button>
            </div>

            <br />

            <small>Try Deedyte free, no credit card required. By entering your email, you agree to receive marketing emails from Deedyte.</small>
        </section>

        <section>
            <ul>
                <li>Pay monthly</li>
                <li>Pay yearly (save 25%)</li>
            </ul>

            {/* <br /> */}
         
            <ul>
                <li className='shadow'>
                    <div>
                        1 For your first month
                    </div>

                    <div >
                        <span>
                            <h4>Basic</h4>
                            <p style={{margin: '0'}}>For solo entrepreneurs</p>
                        </span>                        
                        <span></span>
                    </div>

                    {/* <hr /> */}
                    <div >
                        <span style={{width: '100%', textAlign: 'left'}}>
                            <h2>&#x20A6;1500</h2><small>NGN/Month</small>
                        </span>
                       
                        
                    </div>
                    <div >
                        <h6>Standout features</h6>
                        <ul>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>10 inventory locations</span>
                            </li>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>24/7 chat support</span>
                            </li>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>Localized global selling (3 markets)</span>
                            </li>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>POS Lite</span>
                            </li>
                        </ul>
                    </div>

                    <button style={{width: '70%', textAlign: 'center', justifyContent: 'center', borderRadius: '25px', marginBottom: '20px'}}>
                        <b>Try for free</b>
                    </button>

                </li>



                <li className='shadow'>
                    <div>
                        1 For your first month
                    </div>

                    <div >
                        <span>
                            <h4>Standard</h4>
                            <p style={{margin: '0'}}>For solo entrepreneurs</p>
                        </span>                        
                        <span></span>
                    </div>

                    {/* <hr /> */}
                    <div >
                        <span style={{width: '100%', textAlign: 'left'}}>
                            <h2>&#x20A6;25000</h2><small>NGN/Month</small>
                        </span>
                       
                        
                    </div>
                    <div >
                        <h6>Standout features</h6>
                        <ul>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>10 inventory locations</span>
                            </li>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>24/7 chat support</span>
                            </li>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>Localized global selling (3 markets)</span>
                            </li>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>POS Lite</span>
                            </li>
                        </ul>
                    </div>

                    <button style={{width: '70%', textAlign: 'center', justifyContent: 'center', borderRadius: '25px', marginBottom: '20px'}}>
                        <b>Try for free</b>
                    </button>

                </li>



                <li className='shadow'>
                    <div>
                        1 For your first month
                    </div>

                    <div >
                        <span>
                            <h4>Advanced</h4>
                            <p style={{margin: '0'}}>For solo entrepreneurs</p>
                        </span>                        
                        <span></span>
                    </div>

                    {/* <hr /> */}
                    <div >
                        <span style={{width: '100%', textAlign: 'left'}}>
                            <h2>&#x20A6;4500</h2><small>NGN/Month</small>
                        </span>
                       
                        
                    </div>
                    <div >
                        <h6>Standout features</h6>
                        <ul>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>10 inventory locations</span>
                            </li>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>24/7 chat support</span>
                            </li>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>Localized global selling (3 markets)</span>
                            </li>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>POS Lite</span>
                            </li>
                        </ul>
                    </div>

                    <button style={{width: '70%', textAlign: 'center', justifyContent: 'center', borderRadius: '25px', marginBottom: '20px'}}>
                        <b>Try for free</b>
                    </button>

                </li>



                <li className='shadow'>
                    <div>
                        1 For your first month
                    </div>

                    <div >
                        <span>
                            <h4>Premium</h4>
                            <p style={{margin: '0'}}>For solo entrepreneurs</p>
                        </span>                        
                        <span></span>
                    </div>

                    {/* <hr /> */}
                    <div >
                        <span style={{width: '100%', textAlign: 'left'}}>
                            <h2>&#x20A6;6000</h2><small>NGN/Month</small>
                        </span>
                       
                        
                    </div>
                    <div >
                        <h6>Standout features</h6>
                        <ul>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>10 inventory locations</span>
                            </li>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>24/7 chat support</span>
                            </li>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>Localized global selling (3 markets)</span>
                            </li>
                            <li>
                                <span>
                                    <img src={ui_svg.src} style={{height: '20px', width: '20px', borderRadius: '10px'}} alt="" />

                                </span>
                                &nbsp;                                &nbsp;
                                <span>POS Lite</span>
                            </li>
                        </ul>
                    </div>

                    <button style={{width: '70%', textAlign: 'center', justifyContent: 'center', borderRadius: '25px', marginBottom: '20px'}}>
                        <b>Try for free</b>
                    </button>

                </li>
              
            </ul>
        </section>

        <section>
            <h2>What every plan gets you</h2>

            <ul>
                <li className='shadow' style={{justifyContent: 'flex-start'}}>
                    <div>
                        <img src={summary_1_svg.src} alt="" />
                    </div>

                    <h5 style={{textAlign: 'left', paddingLeft: '5px', width: '100%'}}>World&apos;s best checkout</h5>
                    <div style={{marginBottom: '10px'}}>Deedyte checkout converts 15% better on average than other commerce platforms.</div>
                    
                </li>


                <li className='shadow' style={{justifyContent: 'flex-start'}}>
                    <div>
                        <img src={summary_2_svg.src} alt="" />
                    </div>

                    <h5 style={{textAlign: 'left', paddingLeft: '5px', width: '100%'}}>In-person selling</h5>
                    <div style={{marginBottom: '10px'}}>Sell in person and keep inventory in sync with online sales—all with Deedyte POS.</div>
                    
                </li>


                <li className='shadow' style={{justifyContent: 'flex-start'}}>
                    <div>
                        <img src={summary_3_svg.src} alt="" />
                    </div>

                    <h5 style={{textAlign: 'left', paddingLeft: '5px', width: '100%'}}>Multiple sales channels</h5>
                    <div style={{marginBottom: '10px'}}>Promote and sell products on Instagram, TikTok, Google, and other channels.</div>
                    
                </li>


                <li className='shadow' style={{justifyContent: 'flex-start'}}>
                    <div>
                        <img src={summary_4_svg.src} alt="" />
                    </div>

                    <h5 style={{textAlign: 'left', paddingLeft: '5px', width: '100%'}}>In-depth analytics</h5>
                    <div style={{marginBottom: '10px'}}>Access reports to track store performance and identify optimisation opportunities.</div>
                    
                </li>

                
                <li className='shadow' style={{justifyContent: 'flex-start'}}>
                    <div>
                        <img src={summary_5_svg.src} alt="" />
                    </div>

                    <h5 style={{textAlign: 'left', paddingLeft: '5px', width: '100%'}}>Commerce apps</h5>
                    <div style={{marginBottom: '10px'}}>Use apps for everything from product sourcing to customizing your store.</div>
                    
                </li>




            </ul>
        </section>

        <section>
            <h2>Alternative solutions for your business</h2>

            <ul>
                <li className='shadow'>
                    <div>
                        1 For your first month
                    </div>

                    <div >
                        <span>
                            <h4>Starter</h4>
                        </span>                        
                        <span></span>
                    </div>

                    {/* <hr /> */}
                    <div >
                        <span style={{width: '100%', textAlign: 'left'}}>
                            <h2>&#x20A6;1500</h2><small>NGN/Month</small>
                        </span>
                       
                    </div>

                    <p style={{fontSize: 'large', color: '#363636'}}>
                    Sell instantly through social media and messaging apps or a simple online store
                    </p>
                  

                    <button style={{width: 'auto', textAlign: 'center', justifyContent: 'center', borderRadius: '25px', marginBottom: '20px'}}>
                        <b>Learn more.</b>
                    </button>

                </li>

                <li className='shadow'>
                    <div>
                        1 For your first month
                    </div>

                    <div >
                        <span>
                            <h4>Retail</h4>
                        </span>                        
                        <span></span>
                    </div>

                    {/* <hr /> */}
                    <div >
                        <span style={{width: '100%', textAlign: 'left'}}>
                            <h2>&#x20A6;25000</h2><small>NGN/Month</small>
                        </span>
                       
                    </div>

                    <p style={{fontSize: 'large', color: '#363636'}}>
                    In-person selling tools with advanced staff, inventory, and loyalty features
                    </p>
                  

                    <button style={{width: 'auto', textAlign: 'center', justifyContent: 'center', borderRadius: '25px', marginBottom: '20px'}}>
                        <b>Learn more.</b>
                    </button>

                </li>

                <li className='shadow'>
                    <div>
                        1 For your first month
                    </div>

                    <div >
                        <span>
                            <h4>Enterprse Commerce</h4>
                        </span>                        
                        <span></span>
                    </div>

                    {/* <hr /> */}
                    <div >
                        <span style={{width: '100%', textAlign: 'left'}}>
                            <h2>&#x20A6;65000</h2><small>NGN/Month</small>
                        </span>
                       
                    </div>

                    <p style={{fontSize: 'large', color: '#363636'}}>
                    Build agility, speed to deployment, and performance for enterprise organizations
                    </p>
                  

                    <button style={{width: 'auto', textAlign: 'center', justifyContent: 'center', borderRadius: '25px', marginBottom: '20px'}}>
                        <b>Learn more.</b>
                    </button>

                </li>
               
            </ul>

            {/* <small>All payments will be billed in your selected currency.</small> */}
        </section>

        <section style={{background: '#000'}}>
            <br />
            <br />
            <h2>Frequently Asked Questions</h2>

            <br />
            <br />


            <ul>
                <li>
                    <h3 style={{color: '#fff'}}>General Questions</h3>
                    <br />
                    <ul className='faq-sub-list'>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>What is Deedyte and how does it work?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <div style={{color: '#fff', textAlign: 'left'}}>
                                Deedyte is an E-commerce platform created to improve the E-commerce eco-system 
                            </div>
                            <hr/>
                            
                        
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>How much does Deedyte cost?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>How long are your contracts?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>Can I cancel my account at any time?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>Can I change my plan later on?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                            
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>Do you offer any discounts?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>In what countries can I use Deedyte?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>Is Deedyte PCI Compliant or PCI Certified?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                            
                        </li>
                    </ul>
                </li>

                <li>
                    <h3 style={{color: '#fff'}}>Payment questions</h3>
                    <br />
                    <ul className='faq-sub-list'>

                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>Are there third-party transaction fees?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>What is a third-party payment provider?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>Are there any credit card fees?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                      
                    </ul>
                </li>

                <li>
                    <h3 style={{color: '#fff'}}>Store setup Questions</h3>
                    <br />
                    <ul className='faq-sub-list'>
                    
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>Is there a setup fee?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>I&apos;m looking to switch to Deedyte. How do I get my data over?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>Can I use my own domain name with Deedyte?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>Do I get free web hosting when I open an online store?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                            
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>What are your bandwidth fees?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                    </ul>
                </li>

                <li>

                    <h3 style={{color: '#fff'}}>POS</h3>
                    <br />
                    <ul className='faq-sub-list'>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>What is Deedyte POS?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>What kinds of businesses use Deedyte POS?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                        <li id='faq-sub-list-title'>
                        
                            <div style={{height: 'auto', width: '100%', fontSize: 'large', fontWeight: '500', textAlign: 'left'}}>
                                <span style={{color: '#fff', width: '90%'}}>Does my online store integrate with Deedyte POS?</span>
                                <span>
                                    <img src={plus_svg.src} className='faq-svg' alt="" />
                                </span>
                            </div>
                            <hr/>
                            <div>

                            </div>
                        
                        </li>
                    </ul>
                </li>
            </ul>

        </section>


        <section>
            <h2 style={{textAlign: 'center'}}>Everything you need to sell online,
            <br /> all in one place</h2>

            <br />

            <h4>Whether you&apos;re building a website, managing inventory, or responding to customers,
            <br />you can do it all with Deedyte.</h4>

            <br />
            <div className="input-cnt">
                <input placeholder='Enter your email address' type="email" name="" id="" autoComplete="email" />
                <button>Start free trial</button>
            </div>

            <br />

            <small style={{textAlign: 'center'}}>Try Deedyte free, no credit card required. By entering your email, you agree to receive marketing emails from Deedyte.</small>
            
        </section>
        
      </div>
    </>
  )
}
