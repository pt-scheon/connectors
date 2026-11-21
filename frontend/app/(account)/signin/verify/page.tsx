import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyView } from "./view";

export const metadata: Metadata = { title: "Enter your code" };

export default function VerifyPage() {
  return <Suspense fallback={<section className="sec dark page-top ac-page" />}><VerifyView /></Suspense>;
}
