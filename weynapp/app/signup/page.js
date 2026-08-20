import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata({
  title: "Create Your Weyn Account",
  description: "Create a Weyn account to save Abu Dhabi places, join group votes, write ratings, and earn points.",
});

export default function SignupPage() {
  return (
    <Suspense>
      <AuthForm mode="signup" />
    </Suspense>
  );
}

