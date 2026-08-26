import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import { privatePageMetadata } from "@/lib/seo";

export const metadata = privatePageMetadata({
  title: "Log In",
  description: "Log in to your Weyn account.",
});

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}


