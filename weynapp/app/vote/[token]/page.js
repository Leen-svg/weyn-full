import GuestVoteClient from "@/components/GuestVoteClient";

export const metadata = { title: "Vote, Weyn" };

export default async function GuestVotePage({ params }) {
  const { token } = await params;
  return <GuestVoteClient token={token} />;
}
