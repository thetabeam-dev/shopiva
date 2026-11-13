import React from "react";
import Link from "next/link";
import BlogPageShell from "../../../components/blogs/BlogPageShell";
import BlogPostContent from "../../../components/blogs/BlogPostContent";
import StructuredData from "../../StructuredData";
import { getBlogPost, listBlogPosts } from "../../../lib/blogPosts";
import {
  blogPostJsonLd,
  buildBlogPostMetadata,
} from "../../../lib/blogSeo";

async function readSlug(params) {
  const resolved = params && typeof params.then === "function" ? await params : params;
  return typeof resolved?.slug === "string" ? resolved.slug : String(resolved?.slug ?? "");
}

export function generateStaticParams() {
  return listBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }) {
  const slug = await readSlug(params);
  return buildBlogPostMetadata(getBlogPost(slug));
}

/**
 * @param {{ params: Promise<{ slug?: string }> | { slug?: string } }} props
 */
export default async function BlogPostPage({ params }) {
  const slug = await readSlug(params);
  const post = getBlogPost(slug);

  if (!post) {
    return (
      <BlogPageShell title="Article not found" subtitle="This blog post does not exist.">
        <div className="blog-empty">
          <p>
            We could not find that article. Browse the{" "}
            <Link href="/blogs">DeeDyte blog</Link> for the latest posts.
          </p>
        </div>
      </BlogPageShell>
    );
  }

  return (
    <>
      <StructuredData data={blogPostJsonLd(post)} />
      <BlogPageShell title={post.title} subtitle={post.excerpt}>
        <BlogPostContent post={post} />
      </BlogPageShell>
    </>
  );
}
