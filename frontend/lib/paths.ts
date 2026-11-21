/* Turns a path on the Connect app (what an action or an inbox line points at) into the page of the same purpose on this
   site. Anything this site has no page for yet (project workspaces, clubs, commissions, funding, admin) stays a link to
   the Connect app, and says so: `external` is true. */

const HERE = new Set(["/", "/signin", "/signin/verify", "/onboarding", "/inbox", "/settings", "/feedback", "/rules", "/privacy", "/terms", "/cookies", "/messages", "/colleges"]);

export type Target = { href: string; external: boolean };

export function frontPath(to: string, appUrl: string, myId?: number): Target {
  let u: URL;
  try { u = new URL(to, "http://connect.invalid"); } catch { return { href: "/", external: false }; }
  const p = u.pathname.replace(/\/+$/, "") || "/";
  const rest = u.search + u.hash;
  if (HERE.has(p) || /^\/messages\/\d+$/.test(p)) return { href: p + rest, external: false };
  const person = p.match(/^\/u\/(\d+)$/);
  if (person && Number(person[1]) === myId) return { href: "/me" + (u.searchParams.get("tab") === "progress" ? "#progress" : ""), external: false };
  if (p === "/credit") return { href: "/me#progress", external: false };
  const college = p.match(/^\/c\/([\w-]+)$/);
  if (college) return { href: `/colleges/${college[1]}`, external: false };
  return { href: `${appUrl}${to.startsWith("/") ? to : `/${to}`}`, external: true };
}

/* A page on this site to come back to after signing in: a path only, never another site. */
export function safeNext(v: string | null | undefined): string {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return "/";
  return v.slice(0, 300);
}

/* "5 min ago", "yesterday", "12 Mar": short and calm, for lists. */
export function ago(iso: string | number | null | undefined, now = Date.now()): string {
  if (iso === null || iso === undefined || iso === "") return "";
  const t = typeof iso === "number" ? iso * 1000 : Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 2) return "yesterday";
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} days ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(s > 86400 * 300 ? { year: "numeric" } : {}) });
}
