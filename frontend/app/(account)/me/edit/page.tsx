import type { Metadata } from "next";
import { OnboardingView } from "../../onboarding/view";

export const metadata: Metadata = { title: "Edit your profile" };

export default function EditProfilePage() {
  return <OnboardingView edit />;
}
