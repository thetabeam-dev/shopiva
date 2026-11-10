"use client";

import { useMemo, useState } from "react";
import { IoCheckmarkCircle, IoStar, IoStarHalf, IoStarOutline } from "react-icons/io5";

function reviewCount(metrics, reviews) {
  const fromMetrics = Number(metrics?.review_count);
  if (Number.isFinite(fromMetrics) && fromMetrics > 0) return fromMetrics;
  return reviews.length;
}

function averageRating(metrics, reviews) {
  const fromMetrics = Number(metrics?.average_rating);
  if (Number.isFinite(fromMetrics) && fromMetrics > 0) return fromMetrics;
  if (!reviews.length) return 0;
  const total = reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0);
  return total / reviews.length;
}

function formatReviewDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function maskName(value) {
  const name = String(value || "Customer").trim() || "Customer";
  if (name.length <= 3) return `${name.slice(0, 1)}***`;
  if (name.length <= 5) return `${name.slice(0, 2)}***`;
  return `${name.slice(0, 2)}***${name.slice(-2)}`;
}

function Stars({ rating, size = 14 }) {
  const value = Number(rating) || 0;
  return (
    <span className="pdp-reviews-feed__stars" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const Icon = value >= star ? IoStar : value >= star - 0.5 ? IoStarHalf : IoStarOutline;
        return <Icon key={star} size={size} color={value > 0 ? "#00926E" : "#D0D0D0"} />;
      })}
    </span>
  );
}

export default function Reviews({ reviews = [], metrics = null }) {
  const list = Array.isArray(reviews) ? reviews : [];
  const count = reviewCount(metrics, list);
  const average = averageRating(metrics, list);
  const [tag, setTag] = useState("");

  const tags = useMemo(() => {
    const map = new Map();
    list.forEach((review) => {
      const title = String(review.title || "").trim();
      if (!title) return;
      map.set(title, (map.get(title) || 0) + 1);
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, uses]) => ({ label, uses }));
  }, [list]);

  const visible = tag
    ? list.filter((review) => String(review.title || "").trim() === tag)
    : list;

  return (
    <div className="pdp-reviews pdp-reviews-feed">
      <div className="pdp-reviews-feed__top">
        <strong className="pdp-reviews-feed__count">
          {count.toLocaleString("en-NG")} review{count === 1 ? "" : "s"}
        </strong>
        {count > 0 ? (
          <>
            <span className="pdp-reviews-feed__score">{average.toFixed(1)}</span>
            <Stars rating={average} size={16} />
          </>
        ) : null}
        <span className="pdp-reviews-feed__verified">
          <IoCheckmarkCircle size={16} color="#00926E" />
          All reviews are from verified purchases
        </span>
      </div>

      {tags.length > 0 ? (
        <div className="pdp-reviews-feed__tags">
          {tags.map((item) => (
            <button
              type="button"
              key={item.label}
              className={tag === item.label ? "is-active" : ""}
              onClick={() => setTag((current) => (current === item.label ? "" : item.label))}
            >
              {item.label}({item.uses})
            </button>
          ))}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="pdp-reviews-feed__empty">No reviews yet</p>
      ) : (
        visible.map((review) => {
          const name = maskName(review.reviewer_name);
          const when = formatReviewDate(review.created_at);
          const comment = String(review.comment || "").trim();
          const initial = name.slice(0, 1).toUpperCase();
          return (
            <article className="pdp-reviews-feed__item" key={review.id}>
              <div className="pdp-reviews-feed__who">
                <span className="pdp-reviews-feed__avatar" aria-hidden>
                  {initial}
                </span>
                <span className="pdp-reviews-feed__name">{name}</span>
                <span className="pdp-reviews-feed__flag" aria-hidden>
                  🇳🇬
                </span>
                {when ? <span className="pdp-reviews-feed__date">on {when}</span> : null}
              </div>
              <Stars rating={Number(review.rating) || 0} />
              {comment ? <p className="pdp-reviews-feed__text">{comment}</p> : null}
            </article>
          );
        })
      )}
    </div>
  );
}
