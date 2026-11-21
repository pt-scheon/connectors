import { bridge, type Fields, type Outcome } from "@/lib/bridge";
import { bodyOf, options, originOk, problem, reply, who, type Need } from "@/lib/account-http";
import {
  askCollegeAdmin, deleteAccount, devSignIn, joinWithSignInEmail, resendLogin, saveProfile, saveSettings, sendCode, sendFeedback,
  signOutEverywhere, verifyCode, verifyLogin,
} from "@/app/actions";
import { setAnonymousMode } from "@/app/identity-actions";
import { setBlocked } from "@/app/chat-actions";
import { devLogin } from "@/lib/auth";
import { get } from "@/lib/db";

export const dynamic = "force-dynamic";

/* The things the showcase's pages can do, each one of Connect's own server actions (app/actions.ts and friends), so the
   rules are the ones Connect already enforces: who may join a college, how a code is checked, what deleting an account
   erases. Only the actions named here can be run, with only the fields named here, after the route has checked that the
   request comes from a trusted origin and the person has got far enough (signed in, finished their profile, verified).

   POST /api/account/act  { "action": "send-feedback", "kind": "bug", "text": "..." }
   -> { ok: true, message, to }  or  { ok: false, error, to }   (`to` is a path on Connect, mapped by the showcase) */

type Action = { fn: (fd: FormData) => Promise<unknown>; need: Need | "none"; back: string; fields: string[] };

const ACTIONS: Record<string, Action> = {
  // Signing in. These run before there is a session; the second step reads the `pending` cookie.
  "dev-sign-in": { fn: devSignIn, need: "none", back: "/signin", fields: ["id"] },
  "verify-login": { fn: verifyLogin, need: "none", back: "/signin/verify", fields: ["code", "trust"] },
  "resend-login": { fn: resendLogin, need: "none", back: "/signin/verify", fields: [] },
  // Joining: profile first, then proving a community.
  "save-profile": { fn: saveProfile, need: "signed-in", back: "/onboarding", fields: ["role", "college", "branch", "grad_year", "skills", "about", "github", "linkedin", "website", "terms"] },
  "send-code": { fn: sendCode, need: "onboarded", back: "/onboarding", fields: ["email", "college_name"] },
  "verify-code": { fn: verifyCode, need: "onboarded", back: "/onboarding", fields: ["code"] },
  "join-with-sign-in-email": { fn: joinWithSignInEmail, need: "onboarded", back: "/onboarding", fields: ["college_name"] },
  "ask-college-admin": { fn: askCollegeAdmin, need: "onboarded", back: "/onboarding", fields: ["college"] },
  // Settings, feedback, anonymous mode, blocking.
  "save-settings": { fn: saveSettings, need: "onboarded", back: "/settings", fields: ["email_notes", "open_to_join", "follow_notes", "calls_on", "dm_from", "two_step"] },
  "sign-out-everywhere": { fn: signOutEverywhere, need: "onboarded", back: "/settings", fields: [] },
  "delete-account": { fn: deleteAccount, need: "onboarded", back: "/settings", fields: ["confirm"] },
  "send-feedback": { fn: sendFeedback, need: "onboarded", back: "/feedback", fields: ["kind", "text", "page"] },
  "set-anonymous": { fn: setAnonymousMode, need: "onboarded", back: "/settings", fields: ["on", "fresh"] },
  "set-blocked": { fn: setBlocked, need: "member", back: "/messages", fields: ["user", "on"] },
};

export async function POST(req: Request) {
  const b = await bodyOf(req);
  const a = typeof b?.action === "string" && Object.hasOwn(ACTIONS, b.action) ? ACTIONS[b.action] : null;
  if (!b || !a) return problem(req, "unknown_action", 400);

  // Every action is a write, so the origin must be trusted whether or not anyone is signed in yet. The sign-in steps work
  // without a session; everything else also needs the person to have got far enough.
  if (a.need === "none") {
    if (!originOk(req, true)) return problem(req, "bad_origin", 403);
  } else {
    const r = await who(req, a.need, true);
    if ("res" in r) return r.res;
  }

  // The sample sign-in must name a real person: the action itself would "succeed" and sign nobody in.
  if (b.action === "dev-sign-in" && (!devLogin || !get("SELECT 1 FROM users WHERE id=? AND suspended=0", Number(b.id)))) {
    return problem(req, devLogin ? "No such sample person." : "Sample sign-in is switched off.", devLogin ? 404 : 403);
  }

  const fields: Fields = { back: a.back };
  for (const k of a.fields) {
    const v = b[k];
    if (typeof v === "string") fields[k] = v.slice(0, 2000);
    else if (typeof v === "number" || typeof v === "boolean") fields[k] = v;
  }

  let out: Outcome;
  try {
    out = await bridge(a.fn, fields);
  } catch (e) {
    console.error("[connect] account action failed:", b.action, e);
    return problem(req, "Something went wrong. Try again in a moment.", 500);
  }
  // An action that sends someone to Connect's sign-in has found no session: report it as such rather than as success.
  if (out.ok && out.to === "/signin" && a.need !== "none") return problem(req, "signed_out", 401);
  return reply(req, out, out.ok ? 200 : 400);
}

export const OPTIONS = options;
