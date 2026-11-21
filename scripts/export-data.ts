/* Writes the local sample data (colleges, people, projects, and who worked on what) to a folder, as JSON and CSV,
   with every person's and project's picture alongside. For looking at the test data outside the app, or loading it
   somewhere else.

     npm run export-data                  writes ../sample-data (next to backend/ and frontend/)
     npm run export-data -- <folder>      writes there instead

   Reads the database in DATABASE_PATH (default ./data/connect.db). It only reads. */
import fs from "node:fs";
import path from "node:path";
import { all } from "../lib/db";
import { compute, EMPTY } from "../lib/credit";
import { tierFor } from "../lib/tiers";
import { uploadDir } from "../lib/files";

const out = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("-")) || path.join(process.cwd(), "..", "sample-data"));
const iso = (t: unknown) => (typeof t === "number" && t > 0 ? new Date(t * 1000).toISOString() : null);
const list = (s: unknown) => String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const ext = (mime: unknown) => ({ "image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" } as Record<string, string>)[String(mime)] ?? "bin";

fs.rmSync(out, { recursive: true, force: true });
for (const d of ["", "images/people", "images/projects"]) fs.mkdirSync(path.join(out, d), { recursive: true });

/* Copies a stored picture out, and returns its path inside the export (or null). */
function picture(key: unknown, mime: unknown, folder: string, id: number) {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{24}$/.test(key)) return null;
  const src = path.join(uploadDir(), key);
  if (!fs.existsSync(src)) return null;
  const rel = `images/${folder}/${id}.${ext(mime)}`;
  fs.copyFileSync(src, path.join(out, rel));
  return rel;
}

const S = compute();
const sourceOf = (sub: string) => (sub.startsWith("seed:") ? "seed" : sub.startsWith("demo:") ? "demo" : "other");

const colleges = all(`SELECT c.*,
    (SELECT COUNT(*) FROM users u WHERE u.college_id=c.id AND COALESCE(u.deleted,0)=0) people,
    (SELECT COUNT(*) FROM projects p WHERE p.college_id=c.id) projects,
    (SELECT COUNT(*) FROM projects p WHERE p.college_id=c.id AND p.status='shipped') shipped
  FROM colleges c ORDER BY c.name`).map((c) => ({
  id: c.id as number, slug: String(c.slug), name: String(c.name), emailDomains: list(c.domains), status: String(c.status),
  openedAt: iso(c.created_at), people: c.people as number, projects: c.projects as number, shippedProjects: c.shipped as number,
}));

const people = all(`SELECT u.*, c.slug cslug, c.name cname FROM users u LEFT JOIN colleges c ON c.id=u.college_id
  WHERE COALESCE(u.deleted,0)=0 ORDER BY u.id`).map((u) => {
  const st = S.get(u.id) ?? EMPTY;
  const r = tierFor(Math.round(st.earned), st.shipped).tier;
  return {
    id: u.id as number, name: String(u.name), source: sourceOf(String(u.sub)),
    collegeSlug: (u.cslug ?? null) as string | null, college: (u.cname ?? null) as string | null,
    role: String(u.role), branch: String(u.branch ?? ""), classOf: (u.grad_year ?? null) as number | null, about: String(u.about ?? ""),
    skills: list(u.skills), verified: !!u.verified, admin: !!u.admin, openToJoin: !!u.open_to_join, anonymous: !!u.anon,
    email: (u.email ?? null) as string | null, joinedAt: iso(u.created_at),
    earnedCredit: Math.round(st.earned), shippedProjects: st.shipped, joinedProjects: st.joined,
    rank: r.name, tier: r.tierName, division: r.division,
    picture: picture(u.photo_key, u.photo_mime, "people", u.id as number),
  };
});

const team = all(`SELECT m.project_id, m.user_id, u.name, m.role, m.did, m.status FROM members m JOIN users u ON u.id=m.user_id ORDER BY m.project_id, m.rowid`);
const projects = all(`SELECT p.*, c.slug cslug, c.name cname, u.name lead FROM projects p
  LEFT JOIN colleges c ON c.id=p.college_id LEFT JOIN users u ON u.id=p.lead_id ORDER BY p.id`).map((p) => ({
  id: p.id as number, name: String(p.name), pitch: String(p.pitch ?? ""), status: String(p.status), hidden: !!p.hidden,
  collegeSlug: (p.cslug ?? null) as string | null, college: (p.cname ?? null) as string | null,
  leadId: p.lead_id as number, lead: (p.lead ?? null) as string | null, pot: p.pot as number,
  startedAt: iso(p.created_at), shippedAt: iso(p.shipped_at),
  skills: all("SELECT skill FROM project_skills WHERE project_id=? ORDER BY skill", p.id).map((s) => String(s.skill)),
  milestones: all("SELECT title, done FROM milestones WHERE project_id=? ORDER BY rowid", p.id).map((m) => ({ title: String(m.title), done: !!m.done })),
  team: team.filter((m) => m.project_id === p.id).map((m) => ({ userId: m.user_id as number, name: String(m.name), role: String(m.role ?? ""), did: String(m.did ?? ""), status: String(m.status) })),
  picture: picture(p.image_key, p.image_mime, "projects", p.id as number),
}));
const members = team.map((m) => ({ projectId: m.project_id as number, userId: m.user_id as number, name: String(m.name), role: String(m.role ?? ""), did: String(m.did ?? ""), status: String(m.status) }));

/* ---------- write ---------- */
const json = (name: string, data: unknown) => fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(data, null, 2) + "\n");
const cell = (v: unknown) => {
  const s = v == null ? "" : Array.isArray(v) ? v.map((x) => (typeof x === "object" ? (x as { name?: string; title?: string }).name ?? (x as { title?: string }).title : x)).join("; ") : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (name: string, rows: Record<string, unknown>[]) => {
  if (!rows.length) return fs.writeFileSync(path.join(out, `${name}.csv`), "");
  const cols = Object.keys(rows[0]);
  fs.writeFileSync(path.join(out, `${name}.csv`), "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n");
};
json("colleges", colleges); csv("colleges", colleges);
json("users", people); csv("users", people);
json("projects", projects); csv("projects", projects.map(({ milestones, ...p }) => ({ ...p, milestones: milestones.map((m) => `${m.done ? "[x]" : "[ ]"} ${m.title}`) })));
csv("project_members", members);

fs.writeFileSync(path.join(out, "README.md"), `# Connect sample data

Invented test data from the local database. The colleges are real names; every person and project is made up, and no
real person or account is involved. Exported ${new Date().toISOString().slice(0, 10)}.

| File | Rows | What |
|---|---|---|
| colleges.json / .csv | ${colleges.length} | Every college: slug, name, student email domains, counts |
| users.json / .csv | ${people.length} | Every person: college, role, branch, class, skills, earned credit, shipped projects, rank (e.g. "Silver 2"), picture |
| projects.json / .csv | ${projects.length} | Every project: college, status, lead, pot, dates, skills, milestones, team, picture |
| project_members.csv | ${members.length} | Who is on which project, with role and what they did |
| images/people/*.svg | ${people.filter((p) => p.picture).length} | Profile pictures (drawn, not photos), named by user id |
| images/projects/*.svg | ${projects.filter((p) => p.picture).length} | Project images (drawn), named by project id |

\`source\` on a person: \`seed\` is the small Demo College set (scripts/seed.ts), \`demo\` the large multi-college set
(scripts/demo-data.js). Credit and rank are worked out the same way the app does (lib/credit.ts, lib/tiers.ts).
CSV lists are joined with "; ". CSV files start with a byte-order mark so Excel reads the Indian names correctly.
`);

console.log(`Wrote ${colleges.length} colleges, ${people.length} people and ${projects.length} projects to ${out}`);
