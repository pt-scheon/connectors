import { inbox, openInbox } from "@/lib/account";
import { options, reply, who } from "@/lib/account-http";

export const dynamic = "force-dynamic";

/* The inbox, newest first, with what is new since the last visit. Reading it changes nothing: the page then POSTs
   once to say it has been opened, which marks everything read (as opening Connect's own inbox does). */
export async function GET(req: Request) {
  const r = await who(req, "onboarded");
  if ("res" in r) return r.res;
  return reply(req, inbox(r.me));
}

export async function POST(req: Request) {
  const r = await who(req, "onboarded", true);
  if ("res" in r) return r.res;
  openInbox(r.me);
  return reply(req, { ok: true });
}

export const OPTIONS = options;
