import { baseUrl } from "./auth";
import { trusted } from "./public-http";

/* Signing in with Google or LinkedIn leaves the site and comes back to Connect's own address (the provider only knows
   that one). When the sign-in was started from the showcase, the person should land back on the showcase, not on
   Connect's own home page. The showcase says where with ?next=<its URL>; it is kept in a short-lived cookie while the
   person is away, and only an address on a trusted origin (lib/public-http.ts) is ever accepted, so this cannot be
   used to send someone to another site. */
export const NEXT_COOKIE = "oauth_next";

export function cleanNext(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 300) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password || !trusted(u.origin)) return null;
  // Only a path on that site: never a protocol-relative "//other.site" path.
  const path = u.pathname.startsWith("//") ? "/" : u.pathname;
  return u.origin + path + u.search;
}

/* A page on the site the sign-in started from, or on Connect itself when it started here. */
export function landing(next: string | null, path: string): URL {
  try { if (next) return new URL(path, new URL(next).origin); } catch { /* fall through */ }
  return new URL(path, baseUrl());
}

/* Where a finished sign-in goes: the page asked for, or the person's profile setup first if they have not done it. */
export function arrival(next: string | null, onboarded: boolean): URL {
  if (!next) return new URL("/", baseUrl());
  return onboarded ? new URL(next) : landing(next, "/onboarding");
}
