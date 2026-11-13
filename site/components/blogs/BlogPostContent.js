/**
 * Single DeeDyte blog post body.
 * @module components/blogs/BlogPostContent
 */

import React from "react";
import Link from "next/link";
import { formatBlogDate } from "../../lib/blogPosts";

/**
 * @param {{ post: import("../../lib/blogPosts").BlogPost }} props
 */
export default function BlogPostContent({ post }) {
  return (
    <article className="blog-post">
      <div className="blog-post__media">
        {post.image ? <img src={post.image} alt="" /> : null}
      </div>
      <div className="blog-post__content">
        <Link className="blog-post__back" href="/blogs">
          ← All blogs
        </Link>
        <p className="blog-post__meta">
          {post.author} · {formatBlogDate(post.date)} · {post.category} · {post.minutes}{" "}
          min read
        </p>
        {post.body.map((paragraph, index) => (
          <p key={`${post.slug}-${index}`}>{paragraph}</p>
        ))}
        <ul className="blog-post__links">
          <li>
            <Link href="/blogs">More DeeDyte blogs</Link>
          </li>
          <li>
            <Link href="/about">About DeeDyte</Link>
          </li>
          <li>
            <Link href="/contact">Contact us</Link>
          </li>
        </ul>
      </div>
    </article>
  );
}
