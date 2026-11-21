import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackView } from "./view";

export const metadata: Metadata = { title: "Feedback", description: "Tell the Connect team what is broken, missing or good." };

export default function FeedbackPage() {
  return <Suspense fallback={<section className="sec dark page-top ac-page" />}><FeedbackView /></Suspense>;
}
