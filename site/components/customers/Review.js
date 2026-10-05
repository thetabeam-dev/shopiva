import React from "react";
import StarRating from "../../reusables/star";

function reviewCount(metrics, reviews) {
  const fromMetrics = Number(metrics?.review_count);
  if (Number.isFinite(fromMetrics)) return fromMetrics;
  return reviews.length;
}

function averageRating(metrics, reviews) {
  const fromMetrics = Number(metrics?.average_rating);
  if (Number.isFinite(fromMetrics) && reviewCount(metrics, reviews) > 0) {
    return fromMetrics;
  }
  if (!reviews.length) return 0;
  const total = reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0);
  return total / reviews.length;
}

function formatReviewDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toUTCString();
}

export default function Reviews({ reviews = [], metrics = null }) {
  const list = Array.isArray(reviews) ? reviews : [];
  const count = reviewCount(metrics, list);
  const average = averageRating(metrics, list);
  const score = count > 0 ? average.toFixed(1) : "0.0";

  return (
    <div className="pdp-reviews">
      <h2 className="pdp-reviews__heading">Reviews</h2>
      <div className="pdp-reviews__row">
        <div className="pdp-reviews__ratings">
          <h3 className="pdp-reviews__subheading">
            Verified rating ({count})
          </h3>
          <div className="pdp-reviews__summary-panel">
            <p className="pdp-reviews__score">{score}/5.0</p>
            <div className="pdp-reviews__stars">
              <StarRating rating={average} starRatedColor="#00926E" />
            </div>
            <p className="pdp-reviews__count">
              {count} verified review{count === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="pdp-reviews__comments">
          <h3 className="pdp-reviews__subheading">
            Comments from verified purchases ({count})
          </h3>
          {list.length === 0 ? (
            <p className="pdp-reviews__comment-body">No reviews yet</p>
          ) : (
            list.map((review) => {
              const name = String(review.reviewer_name || "").trim() || "Customer";
              const when = formatReviewDate(review.created_at);
              const title = String(review.title || "").trim();
              const comment = String(review.comment || "").trim();
              return (
                <div className="pdp-reviews__comment-card" key={review.id}>
                  <div className="pdp-reviews__comment-stars">
                    <StarRating
                      rating={Number(review.rating) || 0}
                      starRatedColor="#00926E"
                    />
                  </div>
                  {title ? (
                    <p className="pdp-reviews__comment-title">{title}</p>
                  ) : null}
                  {comment ? (
                    <p className="pdp-reviews__comment-body">{comment}</p>
                  ) : null}
                  <div className="pdp-reviews__comment-meta">
                    <small>
                      {when ? `${when} · ` : ""}
                      {name}
                    </small>
                    {review.is_verified_purchase ? (
                      <small className="pdp-reviews__verified">Verified purchase</small>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
