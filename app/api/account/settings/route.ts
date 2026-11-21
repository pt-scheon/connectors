import { settings } from "@/lib/account";
import { options, reply, who } from "@/lib/account-http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const r = await who(req, "onboarded");
  if ("res" in r) return r.res;
  return reply(req, settings(r.me));
}

export const OPTIONS = options;
