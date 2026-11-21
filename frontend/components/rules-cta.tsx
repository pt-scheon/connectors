"use client";

import Link from "next/link";
import { useSession } from "./session";

/* The rules are public; only someone who is not signed in is invited to join. */
export function RulesCta() {
  const { state } = useSession();
  if (state.status !== "out") return null;
  return <div className="ac-cta"><Link className="ac-btn" href="/signin">Join your community on Connect</Link></div>;
}
