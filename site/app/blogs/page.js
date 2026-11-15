import React from "react";
import BlogPageShell from "../../components/blogs/BlogPageShell";
import BlogsContent from "../../components/blogs/BlogsContent";
import StructuredData from "../StructuredData";
import {
  blogIndexJsonLd,
  buildBlogIndexMetadata,
} from "../../lib/blogSeo";

export const metadata = buildBlogIndexMetadata();

export default function BlogsPage() {
  return (
    <>
      <StructuredData data={blogIndexJsonLd()} />
      <BlogPageShell
        title="DeeDyte Blog — Making Commerce Safe For Everyone"
        subtitle="Buyer safety, escrow education, and vendor growth guides."
      >
        <BlogsContent />
      </BlogPageShell>
    </>
  );
}
