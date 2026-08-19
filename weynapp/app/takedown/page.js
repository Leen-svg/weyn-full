import TakedownForm from "@/components/TakedownForm";

export const metadata = { title: "Video takedown, Weyn" };

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
