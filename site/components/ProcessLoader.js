"use client";

/**
 * Centered spinner for in-progress fetches / auth / suspense.
 * @param {"fill"|"inline"} [variant="fill"] fill = vertically+horizontally centered in available space
 * @param {string} [minHeight] CSS min-height for fill variant (default 280px)
 * @param {string} [className]
 * @param {object} [style]
 */
export default function ProcessLoader({
  variant = "fill",
  minHeight = "280px",
  className = "",
  style,
  label = "Loading",
}) {
  const fill = variant === "fill";
  return (
    <div
      className={`site-process-loader${fill ? " site-process-loader--fill" : ""}${className ? ` ${className}` : ""}`}
      role="status"
      aria-label={label}
      style={fill ? { minHeight, ...style } : style}
    >
      <span
        className="site-process-loader__spinner site-process-loader__spinner--brand"
        aria-hidden="true"
      />
    </div>
  );
}
