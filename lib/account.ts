import { all, get, now, run, type Row } from "./db";
import { compute, EMPTY, RULES } from "./credit";
import { canon, competency } from "./skills";
import { activeColleges, collegeById, collegeForEmail, domainsOf, isMember } from "./college";
import { conversations } from "./chat";
import { KINDS, STATUSES, kindLabel } from "./feedback";
import { domainOf, isAcademic, isPublicMail } from "./domains";
import { mailReady } from "./mail";
import { readyProviders } from "./oauth";
import { TRUST_DAYS, codeAddress, twoStepOn } from "./twostep";
import { avatar, history, rank } from "./public";

/* What the showcase's signed-in pages (sign-in, onboarding, profile, inbox, messages, settings, feedback) read, as JSON.
   Everything here is about the person who is signed in, or a person in their own community they may already see on
   Connect's own pages. It is sent only to them (lib/account-http.ts). Rules live in the same places as for Connect's own
   pages (lib/credit.ts, lib/college.ts, lib/chat.ts); this file only shapes the answers. */

const iso = (t: number | null | undefined) => (t ? new Date(t * 1000).toISOString() : null);
const csv = (s: unknown) => String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const PROVIDER_NAMES: Record<string, string> = { google: "Google", linkedin: "LinkedIn", dev: "Sample sign-in" };

/* How a person is drawn in a list: a name and a picture path. */
export const person = (u: Row) => ({ id: u.id as number, name: u.name as string, picture: (u.picture || null) as string | null, branch: (u.branch || "") as string });

/* ---------- onboarding ---------- */

export type Stage = "profile" | "prove" | "checking" | "alum-waiting" | "done";

/* Where someone is in joining: their profile, then proving their community (or waiting on a person to approve it). */
export function onboarding(u: Row, edit: boolean) {
  const colleges = activeColleges();
  const mine = collegeById(u.college_id);
  const email = String(u.email ?? "").toLowerCase(), domain = domainOf(email);
  const signInProof = u.role === "student" && !!u.email_verified && !!domain && !isPublicMail(domain);
  const known = signInProof ? collegeForEmail(email) : undefined;
  const pending = get("SELECT email, code FROM codes WHERE user_id=? AND expires>?", u.id, now());
  const prod = process.env.NODE_ENV === "production";
  const mail = mailReady() ? "ready" : prod ? "off" : "dev-code";
  let stage: Stage;
  if (!u.onboarded || edit) stage = "profile";
  else if (isMember(u)) stage = "done";
  else if (u.verified && mine && mine.status !== "active") stage = "checking";
  else if (u.role === "alum") stage = "alum-waiting";
  else stage = "prove";
  return {
    stage, onboarded: !!u.onboarded, role: (u.role || "student") as string, starter: RULES.starter,
    me: {
      name: u.name as string, firstName: String(u.name).split(" ")[0],
      branch: (u.branch || "") as string, gradYear: (u.grad_year ?? null) as number | null, skills: (u.skills || "") as string, about: (u.about || "") as string,
      github: (u.github || "") as string, linkedin: (u.linkedin || "") as string, website: (u.website || "") as string,
    },
    colleges: colleges.map((c) => ({ id: c.id as number, slug: c.slug as string, name: c.name as string, domains: domainsOf(c) })),
    college: mine ? { name: mine.name as string, slug: mine.slug as string, status: mine.status as string, domains: domainsOf(mine) } : null,
    signInProof: signInProof ? { email, domain, college: known ? (known.name as string) : null, academic: isAcademic(domain) } : null,
    googleOn: readyProviders().some((p) => p.key === "google"),
    mail,
    pending: pending ? { email: pending.email as string, devCode: mail === "dev-code" ? (pending.code as string) : null } : null,
  };
}

/* ---------- profile and rank ---------- */

export function profile(u: Row) {
  const S = compute();
  const st = S.get(u.id) ?? EMPTY;
  const alum = u.role === "alum";
  const college = u.college_id ? get("SELECT slug, name, status FROM colleges WHERE id=?", u.college_id) : null;
  const proven = [...(competency(S).get(u.id)?.values() ?? [])].sort((a, b) => b.score * (0.5 + b.conf) - a.score * (0.5 + a.conf));
  const listed = csv(u.skills);
  const projects = all(
    `SELECT p.id, p.name, p.pitch, p.status, p.hidden, p.shipped_at, m.role, m.did, m.status mstatus FROM members m JOIN projects p ON p.id=m.project_id
     WHERE m.user_id=? AND m.status='active' AND p.status<>'dropped' ORDER BY p.created_at DESC`, u.id);
  return {
    id: u.id as number, name: u.name as string, picture: (u.picture || null) as string | null, avatar: avatar(u),
    anonymous: !!u.anon, realName: u.anon ? ((u.real_name || null) as string | null) : null,
    role: (u.role || "student") as string, verified: !!u.verified, onboarded: !!u.onboarded,
    branch: (u.branch || "") as string, classOf: (u.grad_year ?? null) as number | null, about: (u.about || "") as string,
    github: (u.github || "") as string, linkedin: (u.linkedin || "") as string, website: (u.website || "") as string,
    openToJoin: !!u.open_to_join,
    college: college ? { slug: college.slug as string, name: college.name as string } : null,
    collegeDomain: u.college_email ? domainOf(String(u.college_email)) : null,
    signIns: [...new Set(all("SELECT sub FROM identities WHERE user_id=?", u.id).map((r) => String(r.sub).split(":")[0]))].map((p) => PROVIDER_NAMES[p] ?? p),
    // A rank is for verified students, as everywhere else on Connect.
    rank: !alum && u.verified ? rank(st) : null,
    credit: { earned: Math.round(st.earned), spendable: Math.round(st.credit), shipped: st.shipped, joined: st.joined, building: st.building, left: st.left },
    credibility: alum ? null : st.cred.score,
    alerts: { left: st.left, joined: st.joined, circle: st.circle, circleWith: st.mates.size, ring: st.ring },
    skills: {
      confirmed: proven.map((k) => ({ skill: k.label, score: k.score, band: k.band, why: k.why })),
      listedOnly: listed.filter((k) => !proven.some((x) => x.skill === canon(k))),
    },
    projects: projects.map((p) => ({
      id: p.id as number, name: p.name as string, pitch: (p.pitch || "") as string, status: p.status as string, private: p.hidden !== 0,
      shippedAt: iso(p.shipped_at), role: (p.role || "") as string, did: (p.did || "") as string,
    })),
    clubs: all("SELECT c.name, cm.role FROM club_members cm JOIN clubs c ON c.id=cm.club_id WHERE cm.user_id=? AND cm.confirmed=1 AND c.status='active'", u.id)
      .map((c) => ({ name: c.name as string, role: c.role as string })),
    // Always the person's own record, whether or not anonymous mode hides it from everyone else.
    progress: alum ? null : history(u.id, st, false),
  };
}

/* ---------- settings ---------- */

export function settings(u: Row) {
  const to = u.college_email || u.email;
  return {
    name: u.name as string, picture: (u.picture || null) as string | null, avatar: avatar(u),
    hasOwnPhoto: !!u.photo_key, anonymous: !!u.anon, realName: u.anon ? ((u.real_name || null) as string | null) : null,
    anonSince: u.anon ? iso(u.anon_since) : null,
    role: (u.role || "student") as string, member: isMember(u), email: (u.email || null) as string | null,
    emailNotes: !!u.email_notes, followNotes: u.follow_notes !== 0, openToJoin: !!u.open_to_join, callsOn: u.calls_on !== 0,
    dmFrom: u.dm_from === "team" ? "team" : "all",
    twoStep: u.two_step !== 0, twoStepAvailable: twoStepOn(), twoStepAddress: codeAddress(u), trustDays: TRUST_DAYS,
    mailReady: mailReady(), emailTo: (to || null) as string | null,
    signIns: [...new Set(all("SELECT sub FROM identities WHERE user_id=?", u.id).map((r) => String(r.sub).split(":")[0]))].map((p) => PROVIDER_NAMES[p] ?? p),
    lastSignIn: u.last_login_at ? { at: iso(u.last_login_at), device: (u.last_login_ua || null) as string | null } : null,
    blocked: all("SELECT u.id, u.name, u.picture, u.branch FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.user_id=? AND u.deleted=0 ORDER BY u.name", u.id).map(person),
  };
}

/* ---------- inbox ---------- */

/* Which heading an entry sits under, counted in Indian time so "Today" means the reader's today. */
const DAY = 86400;
const dayNo = (t: number) => Math.floor((t + 19800) / DAY); // +5:30
export function groupOf(t: number, today: number): string {
  const d = today - dayNo(t);
  return d <= 0 ? "Today" : d === 1 ? "Yesterday" : d < 7 ? "Earlier this week" : d < 31 ? "Earlier this month" : "Older";
}
/* "New" means since the visit before this one. A visit within the last minute counts as this one, so opening the inbox
   and then reloading it does not wipe the "new" marks. */
const sinceOf = (u: Row) => (now() - (u.inbox_read_at ?? 0) > 60 ? (u.inbox_read_at ?? 0) : (u.inbox_prev ?? 0));

export function inbox(u: Row) {
  const since = sinceOf(u);
  const today = dayNo(now());
  const items = all("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 60", u.id).map((n) => ({
    id: n.id as number, text: String(n.text ?? ""), href: String(n.href ?? "/"), at: iso(n.created_at), unseen: !n.seen,
    isNew: (n.created_at ?? 0) > since, group: groupOf(n.created_at ?? 0, today),
  }));
  return { items, newCount: items.filter((i) => i.isNew).length };
}

/* Opening the inbox marks everything read and notes the visit. Called by the page after it has shown what was new. */
export function openInbox(u: Row) {
  run("UPDATE notifications SET seen=1 WHERE user_id=?", u.id);
  if (now() - (u.inbox_read_at ?? 0) > 60) run("UPDATE users SET inbox_prev=?, inbox_read_at=? WHERE id=?", u.inbox_read_at ?? 0, now(), u.id);
}

/* ---------- messages ---------- */

const PREVIEW: Record<string, (m: Row) => string> = {
  invite: () => "Project invite", project: () => "Shared a project", image: (m) => `Photo${m.text ? `: ${m.text}` : ""}`,
  video: (m) => `Video${m.text ? `: ${m.text}` : ""}`, voice: () => "Voice note", file: (m) => `File: ${m.file_name}`, call: (m) => String(m.text ?? "Call"),
};
export const previewOf = (m: Row) => (PREVIEW[m.kind]?.(m) ?? String(m.text ?? "")).slice(0, 140);

export function messageList(me: Row) {
  const people = all(
    `SELECT id, name, picture, branch FROM users WHERE college_id=? AND verified=1 AND suspended=0 AND deleted=0 AND onboarded=1 AND id<>?
       AND id NOT IN (SELECT blocked_id FROM blocks WHERE user_id=?) ORDER BY name`, me.college_id, me.id, me.id);
  return {
    conversations: conversations(me).map(({ u, last, unread }) => ({
      user: person(u), unread, last: { mine: last.from_id === me.id, preview: previewOf(last), at: iso(last.created_at) },
    })),
    people: people.map(person),
  };
}

/* ---------- feedback ---------- */

export function feedback(u: Row) {
  return {
    kinds: KINDS.map(([id, label]) => ({ id, label })),
    mine: all("SELECT * FROM feedback WHERE user_id=? ORDER BY id DESC LIMIT 50", u.id).map((f) => ({
      id: f.id as number, kind: f.kind as string, kindLabel: kindLabel(f.kind), status: f.status as string,
      statusLabel: STATUSES[f.status]?.[1] ?? String(f.status), statusTone: STATUSES[f.status]?.[0] ?? "plain",
      text: f.text as string, reply: (f.reply || null) as string | null, at: iso(f.created_at),
    })),
  };
}
