import type { Metadata } from "next";
import { OnboardingView } from "./view";

export const metadata: Metadata = { title: "Your profile", description: "Set up your Connect profile and prove your college or workplace." };

export default function OnboardingPage() {
  return <OnboardingView />;
}
