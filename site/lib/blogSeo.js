/**
 * SEO helpers for DeeDyte blog index and post pages.
 * @module lib/blogSeo
 */

import { ORGANIZATION_LOGO, SITE_ORIGIN, absoluteUrl } from "./siteNavigation";
import { listBlogPosts } from "./blogPosts";

const SITE_NAME = "DeeDyte Nigeria";
const DEFAULT_OG_IMAGE = ORGANIZATION_LOGO;

/**
 * @param {string} pathOrUrl
 * @returns {string}
 */
function absoluteImageUrl(pathOrUrl) {
  const value = String(pathOrUrl ?? "").trim();
  if (!value) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${SITE_ORIGIN}${value}`;
  return absoluteUrl(value);
}

/**
 * @param {import("./blogPosts").BlogPost} post
 * @returns {string}
 */
export function blogPostSeoTitle(post) {
  return `${post.title} | DeeDyte Blog`;
}

/**
 * @param {import("./blogPosts").BlogPost} post
 * @returns {string}
 */
export function blogPostSeoDescription(post) {
  const text = String(post.excerpt ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= 160) return text;
  return `${text.slice(0, 157).trim()}...`;
}

/**
 * @param {import("./blogPosts").BlogPost} post
 * @returns {string[]}
 */
export function blogPostKeywords(post) {
  if (Array.isArray(post.keywords) && post.keywords.length) {
    return post.keywords.map((value) => String(value).trim()).filter(Boolean);
  }
  return [
    post.title,
    post.category,
    "DeeDyte",
    "Nigeria",
    "online shopping",
    "e-commerce",
    "buyer protection",
    "escrow",
  ];
}

/**
 * Next.js metadata for `/blogs`.
 */
export function buildBlogIndexMetadata() {
  const title = "DeeDyte Blog | Online Shopping Safety, Escrow & Selling in Nigeria";
  const description =
    "Guides on avoiding online shopping scams in Nigeria, escrow payments, verifying sellers, starting an online store, and building customer trust with DeeDyte.";
  const pageUrl = absoluteUrl("/blogs");
  const keywords = [
    "DeeDyte blog",
    "online shopping safety Nigeria",
    "escrow payment Nigeria",
    "verify online seller",
    "sell online Nigeria",
    "buyer protection",
    "e-commerce Nigeria",
    "WhatsApp vs Instagram vs online store",
  ];

  return {
    title,
    description,
    keywords,
    authors: [{ name: "DeeDyte Team" }],
    creator: "DeeDyte",
    publisher: SITE_NAME,
    category: "Blog",
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: SITE_NAME,
      locale: "en_NG",
      type: "website",
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: "DeeDyte Blog" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

/**
 * Next.js metadata for `/blogs/[slug]`.
 * @param {import("./blogPosts").BlogPost | null | undefined} post
 */
export function buildBlogPostMetadata(post) {
  if (!post) {
    return {
      title: "Article not found | DeeDyte Blog",
      description: "This DeeDyte blog article could not be found.",
      robots: { index: false, follow: true },
    };
  }

  const title = blogPostSeoTitle(post);
  const description = blogPostSeoDescription(post);
  const pageUrl = absoluteUrl(`/blogs/${post.slug}`);
  const image = absoluteImageUrl(post.image);
  const keywords = blogPostKeywords(post);

  return {
    title,
    description,
    keywords,
    authors: [{ name: post.author || "DeeDyte Team" }],
    creator: "DeeDyte",
    publisher: SITE_NAME,
    category: post.category,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: SITE_NAME,
      locale: "en_NG",
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.date,
      section: post.category,
      tags: keywords,
      authors: [post.author || "DeeDyte Team"],
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

/**
 * JSON-LD for the blog index.
 */
export function blogIndexJsonLd() {
  const posts = listBlogPosts();
  const pageUrl = absoluteUrl("/blogs");

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${pageUrl}#blog`,
        name: "DeeDyte Blog",
        description:
          "Buyer safety, escrow education, and vendor growth guides from DeeDyte — making commerce safe for everyone.",
        url: pageUrl,
        inLanguage: "en-NG",
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          url: SITE_ORIGIN,
          logo: {
            "@type": "ImageObject",
            url: DEFAULT_OG_IMAGE,
          },
        },
        blogPost: posts.map((post) => ({
          "@type": "BlogPosting",
          "@id": absoluteUrl(`/blogs/${post.slug}`),
          headline: post.title,
          url: absoluteUrl(`/blogs/${post.slug}`),
          datePublished: post.date,
          description: post.excerpt,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Blog",
            item: pageUrl,
          },
        ],
      },
      {
        "@type": "ItemList",
        name: "DeeDyte blog articles",
        itemListElement: posts.map((post, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: absoluteUrl(`/blogs/${post.slug}`),
          name: post.title,
        })),
      },
    ],
  };
}

/**
 * JSON-LD for a single blog post.
 * @param {import("./blogPosts").BlogPost} post
 */
export function blogPostJsonLd(post) {
  const pageUrl = absoluteUrl(`/blogs/${post.slug}`);
  const image = absoluteImageUrl(post.image);
  const articleBody = Array.isArray(post.body) ? post.body.join("\n\n") : "";
  const keywords = blogPostKeywords(post);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${pageUrl}#article`,
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": pageUrl,
        },
        headline: post.title,
        name: post.title,
        description: post.excerpt,
        image: [image],
        datePublished: post.date,
        dateModified: post.date,
        author: {
          "@type": "Organization",
          name: post.author || "DeeDyte Team",
          url: SITE_ORIGIN,
        },
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          url: SITE_ORIGIN,
          logo: {
            "@type": "ImageObject",
            url: DEFAULT_OG_IMAGE,
          },
        },
        articleSection: post.category,
        keywords: keywords.join(", "),
        inLanguage: "en-NG",
        isAccessibleForFree: true,
        timeRequired: `PT${Math.max(1, Number(post.minutes) || 5)}M`,
        wordCount: articleBody.split(/\s+/).filter(Boolean).length,
        articleBody,
        url: pageUrl,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Blog",
            item: absoluteUrl("/blogs"),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: post.title,
            item: pageUrl,
          },
        ],
      },
    ],
  };
}
