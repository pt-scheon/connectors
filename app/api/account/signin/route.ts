import { all } from "@/lib/db";
import { demoMode, devLogin } from "@/lib/auth";
import { PROVIDERS, ready } from "@/lib/oauth";
import { options, originOk, problem, reply } from "@/lib/account-http";

export const dynamic = "force-dynamic";

/* What the showcase's sign-in page offers: the providers that work, and (development and test copies only) the invented
   sample people. Same rule as Connect's own sign-in page. Nothing here needs a session. */
export async function GET(req: Request) {
  if (!originOk(req)) return problem(req, "bad_origin", 403);
  const dev = process.env.NODE_ENV !== "production";
  const providers = Object.values(PROVIDERS)
    // In development every button shows, and one without keys explains itself when pressed; in production only working ones.
    .filter((p) => dev || ready(p))
    .map((p) => ({ key: p.key, label: p.label, ready: ready(p) }));
  const people = devLogin
    ? all(`SELECT u.id, u.name, u.picture, u.branch, u.role, u.admin, c.name college FROM users u LEFT JOIN colleges c ON c.id=u.college_id
           WHERE u.suspended=0 AND COALESCE(u.deleted,0)=0 ORDER BY c.name, u.role DESC, u.name LIMIT 40`)
      .map((u) => ({ id: u.id as number, name: u.name as string, picture: (u.picture || null) as string | null, college: (u.college || null) as string | null,
        role: u.role as string, branch: (u.branch || "") as string, admin: !!u.admin }))
    : [];
  return reply(req, { providers, dev: devLogin, demo: demoMode, people });
}

export const OPTIONS = options;
