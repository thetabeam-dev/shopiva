/**
 * Terms of Use Page Body Component
 * 
 * Main content section for the Terms of Use page.
 * Displays table of contents and detailed terms sections.
 * 
 * @module components/entrepreneur/term_of_use/Body
 */

import React, { useRef } from "react";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Table of contents navigation items
 */
const TABLE_OF_CONTENTS = [
  { id: "introduction", label: "Introduction" },
  { id: "account-activation", label: "Account Activation" },
  { id: "deedyte-rights", label: "Deedyte Rights" },
  { id: "your-responsibility", label: "Your Responsibilities" },
  { id: "payment-of-fees-and-taxes", label: "Payment Of Fees And Taxes" },
  { id: "confidentiality", label: "Confidentiality" },
  { id: "limitation-of-liability", label: "Limitation Of Liability and Indemnification" },
  { id: "intellectual-property", label: "Intellectual Property And Your Materials" },
  { id: "privacy-and-data", label: "Privacy and Data Protection" },
  { id: "refunds-and-return", label: "Refund & Returns" },
  { id: "term-and-termination", label: "Terms and Termination" },
];

/**
 * Terms of Use content sections
 */
const TERMS_SECTIONS = [
  {
    id: "introduction",
    text: "Deedyte is the trading name for U-Commerce subsidiary company. Deedyte operates an E-commerce platform consisting of a website and mobile app (marketplace) together payment infrastructure for sale and purchase of consumer products and services in its allocated territory.",
    highlights: [
      {
        text: "These general terms and conditions shall apply to buyers and sellers on the marketplace and shall govern your use of the marketplace and related services.",
        list: [],
      },
      {
        text: "By using our marketplace you accept these general terms and conditions in full. If you disagree with these general terms and conditions or any part of these general terms and conditions you must not use our marketplace.",
        list: [],
      },
      {
        text: "If you use our marketplace in the course of a business or other organizational project then by so doing you",
        list: [
          "Confirm that you have obtained the necessary authority to agree to these general terms and conditions",
          "bind both yourself and the person company or other legal entity that operates that business or organizational project to these general terms and conditions; and",
          "agree that you in these general terms and conditions shall reference both the individual user and the relevant person company or legal entity unless the context requires otherwise.",
        ],
      },
    ],
  },
  {
    id: "account-activation",
    text: "Use of the Deedyte Website is available only to persons who can form legally binding contracts under Nigerian governing laws. If you are a minor i.e. under the age of 18 years, you shall not register as a member of Deedyte and shall not transact or use Deedyte website. As a minor if you wish to use or transact on Deedyte, such use or transaction may be made by your legal guardian or parents who have registered as users of Deedyte. Deedyte reserves the right to terminate your membership and refuse to provide you with access to Deedyte if it is brought to Deedyte Online Shopping Limited's notice or if it is discovered that you are under the age of 18 years.",
    highlights: [
      {
        text: "If you use Deedyte, you shall be responsible for",
        list: [
          "Maintaining the confidentiality of your User ID and Password and",
          "You shall be responsible for all activities that occur under your User ID and Password.",
          "You agree that if you provide any information that is untrue, inaccurate, not current or incomplete that Deedyte has reasonable grounds to suspect that such information is untrue, inaccurate, not current or incomplete, or not in accordance with this Terms of Use, Deedyte has the right to indefinitely suspend or terminate or block access of your membership with Deedyte and refuse to provide you with access to the Website.",
        ],
      },
    ],
  },
  {
    id: "deedyte-rights",
    text: "",
    highlights: [
      {
        text: "The Services have a range of features and functionalities. Not all Services or features will be available to all Merchants at all times and we are under no obligation to make any Services or features available in any jurisdiction. Except where prohibited in these Terms of Service or by applicable law, we reserve the right to modify the Services or any part thereof for any reason, without notice and at any time.",
        list: [],
      },
      {
        text: "Deedyte does not pre-screen Materials and it is in our sole discretion to refuse or remove any Materials from any part of the Services, including if we determine in our sole discretion that the goods or services that you offer through the Services, or the Materials uploaded or posted to the Services, violate our AUP or these Terms of Service.",
        list: [],
      },
      {
        text: "Verbal or written abuse of any kind (including threats of abuse or retribution) of any Deedyte employee, member, or officer will result in immediate Account termination.",
        list: [],
      },
      {
        text: "We reserve the right to provide our Services to your competitors and make no promise of exclusivity. You further acknowledge and agree that Deedyte employees and contractors may also be Deedyte customers or merchants and that they may compete with you, although they may not use your Confidential Information in doing so.",
        list: [],
      },
      {
        text: "In the event of a dispute regarding Account ownership, we reserve the right to request documentation to determine or confirm Account ownership. Documentation may include, but is not limited to, a scanned copy of your business license, government issued photo ID, the last four digits of the credit card on file, or confirmation of your status as an employee of an entity.",
        list: [],
      },
      {
        text: "Deedyte reserves the right to determine, in our sole discretion, rightful Account ownership and transfer an Account to the rightful Store Owner. If we are unable to reasonably determine the rightful Store Owner, without prejudice to our other rights and remedies, Deedyte reserves the right to temporarily suspend or disable an Account until resolution has been determined between the disputing parties.",
        list: [],
      },
    ],
  },
  {
    id: "your-responsibility",
    text: "",
    highlights: [
      {
        text: "You acknowledge and agree to provide public-facing contact information, a refund policy and order fulfilment timelines on your Deedyte Store.",
        list: [],
      },
      {
        text: "You acknowledge and agree that the Services are not a marketplace, and any contract of sale made through the Services is directly between you and the customer. You are the seller of record for all items you sell through the Services.",
        list: [],
      },
      {
        text: "You are solely responsible for the goods or services that you may sell through the Services (including description, price, fees, tax that you calculate, defects, required legal disclosures, regulatory compliance, offers or promotional content), including compliance with any applicable laws or regulations.",
        list: [],
      },
      {
        text: "You may not use the Deedyte Services for any illegal or unauthorized purpose nor may you, in the use of the Service, violate any laws in your jurisdiction.",
        list: [],
      },
      {
        text: "The API Terms govern your access to and use of the Deedyte API. You are solely responsible for the activity that occurs using your API Credentials and for keeping your API Credentials secure.",
        list: [],
      },
      {
        text: "You agree to use Deedyte Checkout for any sales associated with your online store.",
        list: [],
      },
    ],
  },
  {
    id: "payment-of-fees-and-taxes",
    text: "",
    highlights: [
      {
        text: "You will pay the Fees applicable to your subscription to Online Service and/or POS Services and any other applicable fees.",
        list: [],
      },
      {
        text: "You must keep a valid payment method on file with us to pay for all incurred and recurring Fees.",
        list: [],
      },
      {
        text: "Subscription Fees are paid in advance and will be billed in 30 day intervals.",
        list: [],
      },
      {
        text: "If we are not able to process payment of Fees using an Authorized Payment Method, we may make subsequent attempts to process payment using any Authorized Payment Method.",
        list: [],
      },
      {
        text: "All Fees are exclusive of applicable federal, provincial, state, local or other governmental sales, goods and services taxes, fees or charges now in force or enacted in the future.",
        list: [],
      },
      {
        text: "You are responsible for all applicable Taxes that arise from or as a result of your subscription to or purchase of Deedyte's products and services.",
        list: [],
      },
    ],
  },
  {
    id: "confidentiality",
    text: "",
    highlights: [
      {
        text: "\"Confidential Information\" will include, but will not be limited to, any and all information associated with a party's business and not publicly known, including specific business information, technical processes and formulas, software, customer lists, prospective customer lists, names, addresses and other information regarding customers and prospective customers, product designs, sales, costs, price lists, and other unpublished financial information, business plans and marketing data.",
        list: [],
      },
      {
        text: "Each party agrees to use the other party's Confidential Information solely as necessary for performing its obligations under these Terms of Service.",
        list: [],
      },
    ],
  },
  {
    id: "limitation-of-liability",
    text: "",
    highlights: [
      {
        text: "You expressly understand and agree that, to the extent permitted by applicable laws, Deedyte and its suppliers will not be liable for any direct, indirect, incidental, special, consequential or exemplary damages.",
        list: [],
      },
      {
        text: "You agree to indemnify and hold us and our parent, subsidiaries, affiliates, partners, officers, directors, agents, employees, and suppliers harmless from any claim or demand.",
        list: [],
      },
      {
        text: "Your use of the Services is at your sole risk. The Services are provided on an \"as is\" and \"as available\" basis without any warranty or condition.",
        list: [],
      },
      {
        text: "Deedyte does not warrant that the Services will be uninterrupted, timely, secure, or error-free.",
        list: [],
      },
    ],
  },
  {
    id: "intellectual-property",
    text: "",
    highlights: [
      {
        text: "Your Materials",
        list: [
          "We do not claim ownership of the Materials you provide to Deedyte; however, we do require a license to those Materials.",
          "If you owned the Materials before providing them to Deedyte then they remain yours, subject to any rights or licenses granted in the Terms of Service.",
          "You agree that Deedyte can, at any time, review and delete any or all of the Materials submitted to the Services.",
        ],
      },
      {
        text: "Deedyte Intellectual Property",
        list: [
          "You agree that you may not use any trademarks, logos, or service marks of Deedyte unless authorized in writing.",
          "You agree not to purchase, register, or use search engine keywords, trademarks, email addresses, social media names, or domain names that use or include Deedyte or Deedyte Trademarks.",
        ],
      },
    ],
  },
  {
    id: "privacy-and-data",
    text: "",
    highlights: [
      {
        text: "Deedyte is firmly committed to protecting the privacy of your personal information and the personal information of your customers. By using the Service, you acknowledge and agree that Deedyte's collection, usage and disclosure of this personal information is governed by our Privacy Policy.",
        list: [],
      },
    ],
  },
  {
    id: "refunds-and-return",
    text: "",
    highlights: [
      {
        text: "Returns of products by buyers and acceptance of returned products by sellers shall be managed by us in accordance with the returns page on the marketplace.",
        list: [],
      },
      {
        text: "Refunds in respect of returned products shall be managed in accordance with the refunds page on the marketplace.",
        list: [
          "in respect of the product price;",
          "local and/or international shipping fees; and",
          "by way of store credits, vouchers, mobile money transfer, bank transfers, or such other methods as we may determine.",
        ],
      },
    ],
  },
  {
    id: "term-and-termination",
    text: "",
    highlights: [
      {
        text: "The term of these Terms of Service will begin on the date of your completed registration for use of a Service and continue until terminated by us or by you.",
        list: [],
      },
      {
        text: "You may cancel your Account and terminate the Terms of Service at any time by contacting Deedyte Support.",
        list: [],
      },
      {
        text: "Without limiting any other remedies, we may suspend or terminate your Account or the Terms of Service for any reason, without notice and at any time.",
        list: [],
      },
      {
        text: "Upon termination of the Services by either party for any reason:",
        list: [
          "Deedyte will cease providing you with the Services and you will no longer be able to access your Account;",
          "unless otherwise provided, you will not be entitled to any refunds of any Fees;",
          "any outstanding balance owed to Deedyte will immediately become due and payable in full; and",
          "your Deedyte Store will be taken offline.",
        ],
      },
    ],
  },
];

// ============================================================================
// BODY COMPONENT
// ============================================================================

/**
 * Terms of Use page body section component
 * 
 * @returns {JSX.Element} The body section
 */
export default function Body() {
  // Create refs for each section for smooth scrolling
  const sectionRefs = useRef({});

  /**
   * Handles smooth scrolling to a section
   * @param {string} sectionId - The section ID to scroll to
   */
  const handleScrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  /**
   * Renders a single terms section
   * @param {Object} section - Section data
   * @param {number} index - Section index
   * @returns {JSX.Element} Section element
   */
  const renderSection = (section, index) => (
    <div key={index} id={section.id}>
      <h4
        style={{
          textTransform: "capitalize",
          textAlign: "left",
          color: "#000",
        }}
      >
        {section.id.replace(/-/g, " ")}
      </h4>

      {section.text && (
        <div style={{ fontSize: "medium", fontWeight: "400" }}>
          {section.text}
        </div>
      )}

      <ol>
        {section.highlights?.map((highlight, highlightIndex) => (
          <li
            key={highlightIndex}
            style={{
              fontSize: "medium",
              fontWeight: "400",
              margin: "20px 0px",
            }}
          >
            {highlight.text}
            
            {highlight.list.length > 0 && (
              <ol style={{ display: "block", listStyleType: "circle" }}>
                {highlight.list.map((item, itemIndex) => (
                  <li
                    key={itemIndex}
                    style={{
                      width: "100%",
                      alignItems: "flex-start",
                      fontWeight: "400",
                      margin: "10px 0px",
                    }}
                  >
                    {item}
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ol>
    </div>
  );

  return (
    <section style={{ borderRadius: "0" }}>
      {/* Table of Contents */}
      <div id="toc-nav-cnt">
        <h6>Table Of Contents</h6>
        <nav>
          <ol id="tou-list-cnt">
            {TABLE_OF_CONTENTS.map((item, index) => (
              <li
                key={index}
                id="tou-list"
                style={{ cursor: "pointer" }}
                onClick={() => handleScrollToSection(item.id)}
              >
                {item.label}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Article Content */}
      <article>
        {TERMS_SECTIONS.map(renderSection)}
      </article>
    </section>
  );
}
