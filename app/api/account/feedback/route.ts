import { feedback } from "@/lib/account";
import { options, reply, who } from "@/lib/account-http";

export const dynamic = "force-dynamic";

/* The feedback kinds, and what this person has sent with the team's answers. Sending goes through /api/account/act. */
export async function GET(req: Request) {
  const r = await who(req, "onboarded");
  if ("res" in r) return r.res;
  return reply(req, feedback(r.me));
}

export const OPTIONS = options;
