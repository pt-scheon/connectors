import type { Metadata } from "next";
import { SettingsView } from "./view";

export const metadata: Metadata = { title: "Settings", description: "Your photo, alerts, who can reach you, sign-in security and your data." };

export default function SettingsPage() {
  return <SettingsView />;
}
