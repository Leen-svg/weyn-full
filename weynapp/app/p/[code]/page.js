import PollClient from "@/components/PollClient";

export const metadata = { title: "Vote, Weyn" };

export default async function PollPage({ params }) {
  const { code } = await params;
  return <PollClient code={code} />;
}
