import { Swirling } from "@/components/loading-ui/swirling";

// Route-level fallback. role="status" so a screen reader announces the wait
// instead of landing on an empty page.
export default function PageLoader({ label = "Loading…" }) {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <Swirling className="page-loader__spinner" />
      <span className="page-loader__label">{label}</span>
    </div>
  );
}
