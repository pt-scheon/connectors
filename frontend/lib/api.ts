/* Typed client for Connect's read-only public API (backend: app/api/public/*, data rules in lib/public.ts).
   Every page calls these on the server, so the browser never talks to the backend directly. */

import type { RulesDoc } from "./account-types";

const API = (process.env.CONNECT_API_URL || "http://localhost:4000").replace(/\/$/, "");
export const APP_URL = (process.env.NEXT_PUBLIC_CONNECT_APP_URL || API).replace(/\/$/, "");
const REVALIDATE = Number(process.env.REVALIDATE_SECONDS || 60);

export type CollegeRef = { slug: string; name: string };
export type Verdict = "live" | "demo";

/* Ranks (backend lib/tiers.ts): from earned credit, and from Gold up shipped projects too. Every tier has five
   divisions, 1 to 5 (Bronze 5 moves up to Silver 1). `id` is the tier (colours, emblem); `name` reads "Bronze 3". */
export type TierId = "rookie" | "bronze" | "silver" | "gold" | "platinum" | "diamond" | "legend";
export type TierRef = { id: TierId; key: string; division: number; tier: string; name: string; note: string };
export type Rank = TierRef & { next: (TierRef & { progress: number; needs: string[] }) | null };
/* A picture path on Connect: an uploaded photo or, for anonymous people, their pattern. null means initials. */
export type Avatar = string | null;

export type Overview = {
  stats: { members: number; shipped: number; building: number; colleges: number; committedInr: number };
  rules: { starter: number; stake: number; live: number; demo: number; reviewsNeeded: number; reviewerMin: number; soloFactor: number; fadeMonths: number; vouch: number };
  tiers: { id: TierId; name: string; note: string; minCredit: number; minShipped: number; divisions: { division: number; name: string; minCredit: number }[] }[];
};
export type Project = {
  id: number; name: string; pitch: string; pot: number; verdict: Verdict; shippedAt: string | null;
  college: CollegeRef; skills: string[]; teamSize: number;
  /* The project's image, a path on Connect (the sample data's are drawn by backend/scripts/sample-art.js). null: none. */
  image: string | null;
};
export type ProjectDetail = Project & {
  proof: string[];
  team: { id: number; name: string; branch: string; classOf: number | null; role: string; did: string; signedBy: number; avatar: Avatar; tier: TierRef }[];
  hiddenTeammates: number;
};
export type CollegeCounts = { members: number; shipped: number; building: number; alumni: number };
export type College = CollegeRef & { since: string | null } & CollegeCounts;
export type CollegeDetail = CollegeRef & { since: string | null; domains: string[]; counts: CollegeCounts; shipped: Project[] };
export type Builder = {
  id: number; name: string; branch: string; classOf: number | null; college: CollegeRef; earned: number; shipped: number; joined: number;
  anonymous: boolean; avatar: Avatar; tier: TierRef;
};
export type Progress = {
  step: number; // days between points
  points: { day: string; credit: number }[];
  reached: { at: string | null; tier: TierRef }[];
  recent: { at: string | null; what: string; why: string; n: number; total: number }[];
};
export type BuilderDetail = Omit<Builder, "tier"> & {
  rank: Rank;
  projects: { id: number; name: string; pitch: string; verdict: Verdict; shippedAt: string | null; image: string | null; role: string; did: string; signedBy: number; proof: string[] }[];
  clubs: { name: string; role: string }[];
  /* null for anonymous builders: Connect hides their record. */
  progress: Progress | null;
};
export type Skill = { skill: string; projects: number };

export class ApiError extends Error {
  constructor(public status: number, path: string) { super(`Connect API ${status} on ${path}`); }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/api/public${path}`, { next: { revalidate: REVALIDATE }, headers: { accept: "application/json" } });
  if (!res.ok) throw new ApiError(res.status, path);
  return res.json() as Promise<T>;
}

/* For detail pages: a 404 from the API becomes null so the page can call notFound(). */
async function maybe<T>(path: string): Promise<T | null> {
  try { return await get<T>(path); } catch (e) { if (e instanceof ApiError && e.status === 404) return null; throw e; }
}

export const api = {
  overview: () => get<Overview>("/overview"),
  projects: (o: { college?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (o.college) q.set("college", o.college);
    if (o.limit) q.set("limit", String(o.limit));
    return get<Project[]>(`/projects${q.size ? `?${q}` : ""}`);
  },
  project: (id: number) => maybe<ProjectDetail>(`/projects/${id}`),
  colleges: () => get<College[]>("/colleges"),
  college: (slug: string) => maybe<CollegeDetail>(`/colleges/${encodeURIComponent(slug)}`),
  builders: (limit = 20) => get<Builder[]>(`/builders?limit=${limit}`),
  builder: (id: number) => maybe<BuilderDetail>(`/builders/${id}`),
  skills: () => get<Skill[]>("/skills"),
  /* How credit, skills and credibility are worked out, as plain text (the numbers come from the backend's own rules). */
  rules: () => get<RulesDoc>("/rules"),
};

/* The signed-in visitor, read in the browser from Connect (GET /api/public/me, with Connect's cookie).
   `member`: verified at an open college (so they can message people). `unread`: what the badges count. */
export type Account =
  | { signedIn: false }
  | { signedIn: true; id: number; name: string; picture: string | null; anonymous: boolean; onboarded: boolean; verified: boolean;
      role: string; college: CollegeRef | null; earned: number; shipped: number; rank: Rank | null;
      member: boolean; admin: boolean; unread: { inbox: number; messages: number } };
export type Me = Extract<Account, { signedIn: true }>;

/* Where things are. Account pages (sign in, profile, inbox, messages, settings, rules and the legal pages) live on this
   site, so these are plain paths. `picture` and `workspace` are the two things that still point at the Connect app
   (APP_URL): pictures are served from it, and project workspaces, clubs, commissions and funding have no page here yet. */
export const app = {
  home: "/",
  signin: "/signin",
  rules: "/rules",
  privacy: "/privacy",
  terms: "/terms",
  cookies: "/cookies",
  settings: "/settings",
  messages: "/messages",
  inbox: "/inbox",
  me: "/me",
  builder: (id: number) => `/builders/${id}`,
  college: (slug: string) => `/colleges/${slug}`,
  /* Pictures are paths on Connect; sign-in provider photos (only ever your own, in the account menu) are full URLs. */
  picture: (src: string) => (/^https?:\/\//.test(src) ? src : `${APP_URL}${src}`),
  /* A page of the Connect app itself, for work that has no page on this site. */
  workspace: (path = "/") => `${APP_URL}${path}`,
};

export const year = (iso: string | null) => (iso ? new Date(iso).getFullYear() : "");
export const monthYear = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "";
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
