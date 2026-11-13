/**
 * DeeDyte blog index — card grid matching blog UI sample.
 * @module components/blogs/BlogsContent
 */

"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  formatBlogDate,
  listBlogCategories,
  listBlogPosts,
} from "../../lib/blogPosts";

export default function BlogsContent() {
  const [category, setCategory] = useState("all");
  const categories = useMemo(() => listBlogCategories(), []);
  const posts = useMemo(() => {
    const all = listBlogPosts();
    if (category === "all") return all;
    return all.filter((post) => post.category === category);
  }, [category]);

  return (
    <>
      <div className="blog-filters" role="tablist" aria-label="Blog categories">
        <button
          type="button"
          role="tab"
          aria-selected={category === "all"}
          className={`blog-filters__chip${category === "all" ? " is-active" : ""}`}
          onClick={() => setCategory("all")}
        >
          All
        </button>
        {categories.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={category === name}
            className={`blog-filters__chip${category === name ? " is-active" : ""}`}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="blog-grid">
        {posts.map((post) => (
          <Link className="blog-card" href={`/blogs/${post.slug}`} key={post.slug}>
            <div className="blog-card__media">
              {post.image ? (
                <img src={post.image} alt={post.imageAlt || post.title} loading="lazy" />
              ) : null}
            </div>
            <div className="blog-card__body">
              <p className="blog-card__category">{post.category}</p>
              <h2 className="blog-card__title">{post.title}</h2>
              <p className="blog-card__excerpt">{post.excerpt}</p>
              <p className="blog-card__meta">
                {post.author} · {formatBlogDate(post.date)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
