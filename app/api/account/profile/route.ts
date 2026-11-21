import { profile } from "@/lib/account";
import { options, reply, who } from "@/lib/account-http";

export const dynamic = "force-dynamic";

/* The signed-in person's own profile, rank and progress. Their own record is shown to them even in anonymous mode. */
export async function GET(req: Request) {
  const r = await who(req, "onboarded");
  if ("res" in r) return r.res;
  return reply(req, profile(r.me));
}

export const OPTIONS = options;
