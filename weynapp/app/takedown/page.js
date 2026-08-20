import TakedownForm from "@/components/TakedownForm";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata({
  title: "Video Takedown Request",
  description: "Request removal of a creator video displayed on Weyn.",
});

export default function TakedownPage() {
  return (
    <>
      <h1>Take my video down.</h1>
      <p className="sub">
        If your video is on Weyn and you&apos;d rather it wasn&apos;t, tell us here. We remove verified
        requests within 48 hours, no questions asked.
      </p>
      <TakedownForm />
    </>
  );
}

