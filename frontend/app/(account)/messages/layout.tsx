import type { Metadata } from "next";
import { MessagesShell } from "./shell";

export const metadata: Metadata = { title: "Messages", description: "Direct messages with people in your community." };

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <MessagesShell>{children}</MessagesShell>;
}
