import { onboarding } from "@/lib/account";
import { options, reply, who } from "@/lib/account-http";

export const dynamic = "force-dynamic";

/* Where the signed-in person is in joining Connect, and what the next step needs. ?edit=1 opens the profile form
   for someone who has already finished it. */
export async function GET(req: Request) {
  const r = await who(req, "signed-in");
  if ("res" in r) return r.res;
  return reply(req, onboarding(r.me, new URL(req.url).searchParams.get("edit") === "1"));
}

export const OPTIONS = options;
