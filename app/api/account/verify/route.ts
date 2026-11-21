import { cookies } from "next/headers";
import { get } from "@/lib/db";
import { CODE_MINUTES, TRUST_DAYS, codeAddress, maskEmail, readPending } from "@/lib/twostep";
import { options, originOk, problem, reply } from "@/lib/account-http";

export const dynamic = "force-dynamic";

/* The second step of sign-in: is there a code waiting for this browser, and to which (masked) address was it sent?
   Reads the short-lived `pending` cookie Connect sets when it emails the code. */
export async function GET(req: Request) {
  if (!originOk(req)) return problem(req, "bad_origin", 403);
  const id = readPending((await cookies()).get("pending")?.value);
  const u = id ? get("SELECT * FROM users WHERE id=? AND suspended=0", id) : null;
  const to = u ? codeAddress(u) : null;
  if (!u || !to) return reply(req, { pending: false });
  return reply(req, { pending: true, to: maskEmail(to), minutes: CODE_MINUTES, trustDays: TRUST_DAYS });
}

export const OPTIONS = options;
