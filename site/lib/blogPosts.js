/**
 * DeeDyte blog posts — focused niche set for acquisition, trust, and brand.
 * @module lib/blogPosts
 */

import warehouseImg from "../images/warehouse-storage-shelves-with-cardboard-boxes.jpg";
import safeImg from "../images/safe.webp";
import shopImg from "../images/Online-Shop_n7.webp";
import shopImgAlt from "../images/Online-Shop_e8.webp";
import paydayImg from "../images/payday.webp";
import fraudImg from "../images/fraud.jpg";
import screenshotImg from "../images/screenshot.png";
import featuresImg from "../images/FEATURES_Integration.webp";

function imageSrc(asset) {
  if (!asset) return "";
  if (typeof asset === "string") return asset;
  return String(asset.src ?? "");
}

/**
 * @typedef {{
 *   slug: string,
 *   title: string,
 *   excerpt: string,
 *   date: string,
 *   author: string,
 *   category: string,
 *   minutes: number,
 *   image: string,
 *   keywords: string[],
 *   body: string[],
 * }} BlogPost
 */

/**
 * @param {string} title
 * @returns {string}
 */
function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * @param {{
 *   title: string,
 *   category: string,
 *   excerpt: string,
 *   body: string[],
 *   date: string,
 *   minutes?: number,
 *   image: string,
 *   keywords?: string[],
 * }} input
 * @returns {BlogPost}
 */
function post({ title, category, excerpt, body, date, minutes = 5, image, keywords = [] }) {
  const baseKeywords = [
    ...keywords,
    "DeeDyte",
    "Nigeria",
    "online shopping Nigeria",
    "e-commerce Nigeria",
    category,
  ];
  return {
    slug: slugify(title),
    title,
    excerpt,
    date,
    author: "DeeDyte Team",
    category,
    minutes,
    image: imageSrc(image),
    keywords: [...new Set(baseKeywords.map((value) => String(value).trim()).filter(Boolean))],
    body,
  };
}

/** @type {BlogPost[]} */
export const BLOG_POSTS = [
  post({
    category: "Buyer acquisition",
    date: "2026-11-10",
    image: fraudImg,
    keywords: [
      "online shopping scams Nigeria",
      "avoid shopping scams",
      "fake online sellers",
      "buyer protection Nigeria",
      "safe online shopping",
    ],
    title: "How to Avoid Online Shopping Scams in Nigeria",
    excerpt:
      "Practical steps to spot fake sellers, protect your payments, and shop online in Nigeria without becoming the next scam victim.",
    body: [
      "Online shopping in Nigeria is growing fast—and so are the scams that target eager buyers. Fake shops, cloned WhatsApp numbers, and “too good to be true” prices still catch people every week.",
      "Start by verifying the seller: look for a real storefront, consistent branding, reviews, and a way to resolve issues if something goes wrong. Avoid paying unknown vendors with unprotected bank transfers.",
      "Prefer marketplaces that hold payments until the order is progressing. Escrow-style protection on DeeDyte is built for exactly this: you agree on the product and shipping in chat, then pay with protection instead of hoping a stranger delivers.",
      "If a deal pressures you to pay immediately, move off-platform, or refuse any form of buyer protection, walk away. A safe purchase is worth more than a rushed bargain.",
    ],
  }),
  post({
    category: "Brand education",
    date: "2026-11-08",
    image: safeImg,
    keywords: [
      "what is escrow payment",
      "how escrow works",
      "escrow Nigeria",
      "protected payment",
      "safe online payment",
    ],
    title: "What Is Escrow Payment and How Does It Work?",
    excerpt:
      "Escrow holds your payment until the order moves as agreed—giving buyers confidence and sellers clearer expectations.",
    body: [
      "Escrow is a protected payment arrangement: your money is held while the purchase is fulfilled according to agreed terms, instead of going straight to the seller with no conditions.",
      "First, buyer and seller agree on the item, price, and delivery expectations. Then the buyer pays into a protected flow rather than an unprotected personal transfer.",
      "While the order is fulfilled, funds remain safeguarded according to the platform rules. If issues arise, a dispute process can pause or redirect outcomes based on evidence.",
      "On DeeDyte, chat helps form the agreement; protected checkout helps complete it safely—so commerce feels safer for everyone.",
    ],
  }),
  post({
    category: "Buyer trust",
    date: "2026-11-05",
    image: safeImg,
    keywords: [
      "verify online seller",
      "check seller before payment",
      "trusted online vendors Nigeria",
      "seller verification",
      "buy from verified sellers",
    ],
    title: "How to Verify an Online Seller Before Making Payment",
    excerpt:
      "A simple checklist for confirming who you are buying from—before your money leaves your account.",
    body: [
      "Verification is not paranoia; it is basic consumer protection. Before you pay, ask: Who is this seller? Where do they operate? How do other buyers rate them?",
      "Check shop identity, product consistency, response quality in chat, and whether delivery fees and policies are clear. Ask for invoice-style confirmation of the exact item, quantity, and shipping.",
      "Be cautious with social-only sellers who cannot point you to a storefront or protected checkout. Screenshots of “testimonials” are easy to fake.",
      "DeeDyte shops are set up for this verification loop: browse, chat, confirm, then pay with protection—so you are not guessing in the dark.",
    ],
  }),
  post({
    category: "Vendor acquisition",
    date: "2026-11-02",
    image: shopImg,
    keywords: [
      "start selling online Nigeria",
      "online business Nigeria",
      "sell products online",
      "open online store Nigeria",
      "become an online vendor",
    ],
    title: "How to Start Selling Online in Nigeria",
    excerpt:
      "A practical starter path: pick a niche, list products, set delivery rules, and get your first paying customers.",
    body: [
      "You do not need a mall unit to start selling. You need a clear offer, reliable supply, and a way for customers to trust you enough to pay.",
      "Begin with a focused product set, honest photos, and pricing that covers product, delivery, and profit. Write simple policies for delivery areas and returns.",
      "Choose tools that help you manage catalog, chat, invoices, and orders—not just a pretty Instagram grid.",
      "DeeDyte helps vendors publish a shop, talk to buyers, and manage protected checkouts so you can start selling with structure from day one.",
    ],
  }),
  post({
    category: "Vendor acquisition",
    date: "2026-10-30",
    image: shopImgAlt,
    keywords: [
      "WhatsApp vs Instagram selling",
      "social commerce Nigeria",
      "online store vs Instagram",
      "where to sell online Nigeria",
      "sell on WhatsApp",
    ],
    title: "WhatsApp vs Instagram vs Online Store",
    excerpt:
      "Each channel has strengths. The winners combine discovery on social with structured selling in a store.",
    body: [
      "WhatsApp is great for conversation, weak for catalog scale. Instagram is great for discovery, weak for order systems. A proper online store ties catalog, chat, payment, and order history together.",
      "Many Nigerian businesses start on social—then drown in unread DMs and lost orders. The fix is not abandoning social; it is connecting social traffic to a real storefront.",
      "Use Instagram and WhatsApp to attract attention. Use an online store to close with clear variants, fees, and protection.",
      "DeeDyte is built for that combination: local storefront plus chat-first checkout.",
    ],
  }),
  post({
    category: "Brand positioning",
    date: "2026-10-27",
    image: safeImg,
    keywords: [
      "why escrow is important",
      "escrow online marketplace",
      "marketplace trust",
      "payment protection marketplace",
      "safe marketplace Nigeria",
    ],
    title: "Why Escrow Is Important in Online Marketplaces",
    excerpt:
      "Marketplaces scale on trust. Escrow is one of the strongest trust engines available.",
    body: [
      "Without escrow-like protection, marketplaces become bulletin boards for risky trades. Serious buyers leave; only gamblers remain.",
      "Escrow reduces fraud incentives, improves completion rates, and gives both sides a reason to behave professionally.",
      "It is especially important in markets where social selling is common and strangers often transact for high-value goods.",
      "DeeDyte treats escrow-minded protection as a core differentiator—not a footnote—because safer commerce is how marketplaces earn lasting demand.",
    ],
  }),
  post({
    category: "Vendor education",
    date: "2026-10-24",
    image: paydayImg,
    keywords: [
      "build customer trust online",
      "online vendor trust",
      "seller reputation Nigeria",
      "customer trust ecommerce",
      "trusted online business",
    ],
    title: "How to Build Customer Trust as an Online Vendor",
    excerpt:
      "Trust is built in small proofs: accurate listings, fast replies, fair policies, and protected payments.",
    body: [
      "Customers rarely trust a brand because of a slogan. They trust patterns: what you promised is what arrived.",
      "Be accurate in photos and descriptions. State delivery timelines honestly. Make it easy to ask questions before purchase.",
      "Offer a checkout path that does not force buyers into unprotected transfers. Protection increases conversion for serious sellers.",
      "DeeDyte helps vendors earn trust with storefront identity, chat clarity, and commerce safety baked into the flow.",
    ],
  }),
  post({
    category: "Organic traffic",
    date: "2026-10-21",
    image: fraudImg,
    keywords: [
      "seller did not deliver",
      "online order not delivered",
      "dispute online purchase Nigeria",
      "what to do if seller refuses delivery",
      "online shopping dispute",
    ],
    title: "What to Do When an Online Seller Doesn't Deliver",
    excerpt:
      "Stay calm, document everything, and use the right dispute path—here is a practical response plan.",
    body: [
      "If a seller stops responding or refuses to deliver after payment, act quickly and keep records: chats, invoices, receipts, and tracking attempts.",
      "Follow the marketplace dispute process if you bought through a protected platform. Avoid endless private arguments that leave no audit trail.",
      "Do not send more money “to unlock delivery.” That is a common second-scam pattern.",
      "DeeDyte’s dispute and return flows exist so buyers and sellers can resolve issues with clear next steps—not endless WhatsApp dead-ends.",
    ],
  }),
  post({
    category: "Brand authority",
    date: "2026-10-18",
    image: featuresImg,
    keywords: [
      "future of e-commerce Nigeria",
      "Nigeria ecommerce trends",
      "digital marketplace Nigeria",
      "online shopping future Africa",
      "local commerce Nigeria",
    ],
    title: "The Future of E-commerce in Nigeria",
    excerpt:
      "Local inventory, mobile-first buying, and trust infrastructure will shape the next wave of Nigerian e-commerce.",
    body: [
      "Nigeria’s e-commerce future is not a copy of Western warehouse models alone. Local availability, social discovery, and safer payments will matter as much as selection.",
      "Buyers want speed and certainty. Sellers want tools that professionalize informal trade without killing flexibility.",
      "Platforms that solve trust will unlock categories that currently stay offline or stuck in DMs.",
      "DeeDyte is building toward that future: safer local commerce for everyday Nigerians.",
    ],
  }),
  post({
    category: "Buyer acquisition",
    date: "2026-10-15",
    image: warehouseImg,
    keywords: [
      "buy products online safely Nigeria",
      "safe online shopping tips",
      "protected online payment",
      "how to shop online safely",
      "Nigeria online buyer guide",
    ],
    title: "How to Buy Products Online Safely in Nigeria",
    excerpt:
      "A clear safety checklist for browsing, verifying sellers, confirming details, and paying with protection.",
    body: [
      "Safe online buying in Nigeria starts before checkout: verify the seller, confirm the exact product, understand delivery fees, and choose protected payment whenever you can.",
      "Avoid pressure tactics and deals that only work if you pay instantly via unprotected transfer to a stranger.",
      "Keep chats and invoices as records. If something goes wrong, evidence makes resolution faster.",
      "On DeeDyte, you can browse local inventory, confirm details with vendors in chat, and complete purchases with buyer protection in mind—making commerce safer for everyone.",
    ],
  }),
];

/**
 * @param {string} slug
 * @returns {BlogPost | undefined}
 */
export function getBlogPost(slug) {
  const key = String(slug ?? "")
    .trim()
    .toLowerCase();
  return BLOG_POSTS.find((post) => post.slug === key);
}

/**
 * @returns {BlogPost[]}
 */
export function listBlogPosts() {
  return [...BLOG_POSTS].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/**
 * @param {string} [category]
 * @returns {BlogPost[]}
 */
export function listBlogPostsByCategory(category) {
  const key = String(category ?? "").trim().toLowerCase();
  if (!key) return listBlogPosts();
  return listBlogPosts().filter((post) => post.category.toLowerCase() === key);
}

/**
 * @returns {string[]}
 */
export function listBlogCategories() {
  const seen = new Set();
  const rows = [];
  for (const post of BLOG_POSTS) {
    if (seen.has(post.category)) continue;
    seen.add(post.category);
    rows.push(post.category);
  }
  return rows;
}

/**
 * @param {string} isoDate
 * @returns {string}
 */
export function formatBlogDate(isoDate) {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(parsed));
}
