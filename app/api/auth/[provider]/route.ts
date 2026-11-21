import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { baseUrl } from "@/lib/auth";
import { PROVIDERS, callbackUrl, ready } from "@/lib/oauth";
import { allow, ipOf } from "@/lib/notify";
import { NEXT_COOKIE, cleanNext, landing } from "@/lib/return-to";

/* Step 1: send the person to Google or LinkedIn.
   ?next=<address> (from the showcase) says where to land afterwards; see lib/return-to.ts. */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const next = cleanNext(new URL(req.url).searchParams.get("next"));
  const back = (msg: string) => NextResponse.redirect(landing(next, "/signin?err=" + encodeURIComponent(msg)));
  const p = PROVIDERS[(await params).provider];
  if (!p || !ready(p)) return back("That sign-in is not set up yet.");
  // A person starts a sign-in a handful of times at most; a script hammering this is turned away.
  if (!allow(`auth:${ipOf(req)}`, 30, 600)) return back("Too many sign-in tries. Wait a few minutes.");
  const state = crypto.randomBytes(16).toString("hex");
  const jar = await cookies();
  const cookie = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 };
  jar.set("oauth_state", `${p.key}:${state}`, cookie);
  // A sign-in begun here must not inherit a return address left over from an earlier one begun elsewhere.
  if (next) jar.set(NEXT_COOKIE, next, cookie); else jar.delete(NEXT_COOKIE);
  const u = new URL(p.authUrl);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", p.clientId!);
  u.searchParams.set("redirect_uri", callbackUrl(baseUrl(), p));
  u.searchParams.set("state", state);
  u.searchParams.set("scope", p.scope);
  if (p.key === "google") u.searchParams.set("prompt", "select_account");
  return NextResponse.redirect(u);
}
