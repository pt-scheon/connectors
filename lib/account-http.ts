import { currentUser } from "./auth";
import { isMember } from "./college";
import type { Row } from "./db";
import { credentialed, trusted } from "./public-http";

/* Plumbing shared by the signed-in JSON API in app/api/account/*. It is what the showcase (../frontend) calls from the
   browser for sign-in, the profile, inbox, messages and settings, so that nobody has to be sent to Connect's own pages.

   Every route answers only a trusted origin (lib/public-http.ts: SHOWCASE_URL, PUBLIC_API_ORIGIN, and any localhost
   port outside production), with the sign-in cookie. Anything that changes something needs a trusted Origin header,
   so another site cannot make a signed-in browser do it. */

const METHODS = "GET, POST, DELETE, OPTIONS";
const cors = (req: Request) => credentialed(req, METHODS);

export const reply = (req: Request, data: unknown, status = 200) => Response.json(data, { status, headers: cors(req) });
export const problem = (req: Request, error: string, status = 400) => reply(req, { error }, status);
export const options = (req: Request) => new Response(null, { status: 204, headers: cors(req) });

/* A read may come with no Origin (Connect's own pages, command-line tools) or a trusted one; a write needs a trusted one. */
export function originOk(req: Request, write = false): boolean {
  const o = req.headers.get("origin");
  return write ? !!trusted(o) : !o || !!trusted(o);
}

/* How far along someone must be: signed in at all, finished their profile, or a verified member of an open college. */
export type Need = "signed-in" | "onboarded" | "member";

export async function who(req: Request, need: Need = "onboarded", write = false): Promise<{ me: Row } | { res: Response }> {
  if (!originOk(req, write)) return { res: problem(req, "bad_origin", 403) };
  const me = await currentUser();
  if (!me || me.deleted) return { res: problem(req, "signed_out", 401) };
  if (need !== "signed-in" && !me.onboarded) return { res: problem(req, "not_onboarded", 403) };
  if (need === "member" && !isMember(me)) return { res: problem(req, "not_member", 403) };
  return { me };
}

/* A JSON body, or null when it is missing, not JSON, or larger than `max` characters. */
export async function bodyOf(req: Request, max = 20_000): Promise<Record<string, unknown> | null> {
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) return null;
  const text = await req.text().catch(() => "");
  if (!text || text.length > max) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch { return null; }
}
