import type { Metadata } from "next";
import { InboxView } from "./view";

export const metadata: Metadata = { title: "Inbox", description: "What happened on your projects, messages and credit." };

export default function InboxPage() {
  return <InboxView />;
}
