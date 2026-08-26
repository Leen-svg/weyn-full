/* The Weyn mark: a pink Arabic "؟" (question mark), rotated 12deg.
   Used inline in body copy, the nav/footer wordmark uses the exact
   .logo/.logo .q markup from design-system.css directly instead. */
export default function Q({ size = "1em", color = "var(--pink)" }) {
  return (
    <span
      className="ar"
      style={{ fontSize: size, color, display: "inline-block", transform: "rotate(12deg)" }}
      aria-hidden="true"
    >
      ؟
    </span>
  );
}

