"use client";

// From the loading-ui registry, adapted: the keyframes moved into stitch.css
// so a page rendering several of these does not inject a duplicate <style>
// tag per instance, and so the animation can honour prefers-reduced-motion.
function Swirling({ className, ...props }) {
  return (
    <svg
      viewBox="0 0 800 800"
      xmlns="http://www.w3.org/2000/svg"
      className={className ? `weyn-swirl ${className}` : "weyn-swirl"}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <circle
        className="weyn-swirl__circle"
        cx="400"
        cy="400"
        r="200"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="50"
      />
    </svg>
  );
}

export { Swirling };
