import { messageList } from "@/lib/account";
import { options, reply, who } from "@/lib/account-http";

export const dynamic = "force-dynamic";

/* Your conversations, and the people in your community you can start one with. Verified members only. */
export async function GET(req: Request) {
  const r = await who(req, "member");
  if ("res" in r) return r.res;
  return reply(req, messageList(r.me));
}

export const OPTIONS = options;
