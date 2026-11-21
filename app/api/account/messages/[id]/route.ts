import { get } from "@/lib/db";
import { person } from "@/lib/account";
import { loadChat, sendMessage } from "@/app/chat-actions";
import { bodyOf, options, problem, reply, who } from "@/lib/account-http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/* One conversation. GET returns the messages after ?after=<id> (0 for all) and marks what you have seen as read, like
   the chat's own polling does; POST {text} sends one. Same rules as Connect's chat: same community, both verified,
   nobody blocked, and a newcomer waits for a reply after five messages. */
export async function GET(req: Request, { params }: Ctx) {
  const r = await who(req, "member");
  if ("res" in r) return r.res;
  const me = r.me, id = Number((await params).id);
  // Only people at your own college, and never yourself.
  const other = get("SELECT id, name, picture, branch, verified, suspended, deleted FROM users WHERE id=? AND college_id=? AND id<>?", id, me.college_id, me.id);
  if (!other) return problem(req, "not_found", 404);
  const iBlocked = !!get("SELECT 1 FROM blocks WHERE user_id=? AND blocked_id=?", me.id, id);
  const theyBlocked = !!get("SELECT 1 FROM blocks WHERE user_id=? AND blocked_id=?", id, me.id);
  const reason = iBlocked ? "You blocked this person." : theyBlocked || other.suspended || other.deleted ? "You cannot message this person."
    : !other.verified ? "They have not verified their college or work email yet." : "";
  const after = Math.max(0, Math.trunc(Number(new URL(req.url).searchParams.get("after"))) || 0);
  const c = reason ? { messages: [], seenUpTo: 0 } : await loadChat(id, after);
  if ("error" in c) return problem(req, c.error, 403);
  return reply(req, { other: person(other), messages: iBlocked ? [] : c.messages, seenUpTo: c.seenUpTo, canSend: !reason, reason, iBlocked });
}

export async function POST(req: Request, { params }: Ctx) {
  const r = await who(req, "member", true);
  if ("res" in r) return r.res;
  const b = await bodyOf(req);
  if (!b) return problem(req, "Send the message as JSON.");
  const out = await sendMessage(Number((await params).id), String(b.text ?? ""));
  return "error" in out ? problem(req, out.error, 400) : reply(req, out);
}

export const OPTIONS = options;
