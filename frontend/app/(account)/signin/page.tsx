import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInView } from "./view";

export const metadata: Metadata = { title: "Sign in", description: "Sign in to Connect with Google or LinkedIn." };

export default function SignInPage() {
  return <Suspense fallback={<section className="sec dark page-top ac-page" />}><SignInView /></Suspense>;
}
