/* Tests the pieces behind the showcase's signed-in pages (lib/return-to.ts, lib/bridge.ts, lib/public-http.ts, lib/account.ts):
   where a finished sign-in may send someone, how an action's redirect becomes JSON, and what the inbox and message list show.
   Uses a throwaway database, never the real one. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DATABASE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "connect-account-")), "test.db");
delete process.env.SHOWCASE_URL;
delete process.env.PUBLIC_API_ORIGIN;

test("sign-in return address: only trusted sites, only a path, never another site", async () => {
  const R = await import("../lib/return-to");
  // Development: any localhost port is trusted.
  assert.equal(R.cleanNext("http://localhost:3000/me"), "http://localhost:3000/me");
  assert.equal(R.cleanNext("http://localhost:3000/messages/4?x=1"), "http://localhost:3000/messages/4?x=1");
  for (const bad of ["http://evil.example.com/steal", "https://localhost.evil.com/", "javascript:alert(1)", "//evil.example.com", "not a url", "", null, undefined,
    "http://user:pw@localhost:3000/", "ftp://localhost/x", "http://localhost:3000/" + "a".repeat(400)]) {
    assert.equal(R.cleanNext(bad as string), null, String(bad));
  }
  // A protocol-relative path on a trusted site is flattened to the site's own home.
  assert.equal(R.cleanNext("http://localhost:3000//evil.example.com"), "http://localhost:3000/");

  // Where a sign-in ends: the page asked for, or profile setup first.
  assert.equal(R.arrival("http://localhost:3000/inbox", true).href, "http://localhost:3000/inbox");
  assert.equal(R.arrival("http://localhost:3000/inbox", false).href, "http://localhost:3000/onboarding");
  assert.equal(R.landing("http://localhost:3000/inbox", "/signin").href, "http://localhost:3000/signin");
  // Started on Connect itself: stays on Connect.
  assert.notEqual(new URL(R.landing(null, "/signin").href).port, "3000");
  assert.equal(new URL(R.arrival(null, true).href).pathname, "/");
});

test("trusted origins: named ones, and localhost only outside production", async () => {
  const H = await import("../lib/public-http");
  process.env.SHOWCASE_URL = "https://showcase.example.com/";
  process.env.PUBLIC_API_ORIGIN = "https://a.example.com, https://b.example.com";
  assert.equal(H.trusted("https://showcase.example.com"), "https://showcase.example.com");
  assert.equal(H.trusted("https://b.example.com"), "https://b.example.com");
  assert.equal(H.trusted("https://c.example.com"), null);
  assert.equal(H.trusted(null), null);
  process.env.PUBLIC_API_ORIGIN = "*"; // a wildcard is never an origin you can send a cookie to
  assert.equal(H.trusted("https://anything.example.com"), null);
  const req = (origin?: string) => new Request("http://x.test/", { headers: origin ? { origin } : {} });
  const ok = H.credentialed(req("https://showcase.example.com"));
  assert.equal(ok["Access-Control-Allow-Origin"], "https://showcase.example.com");
  assert.equal(ok["Access-Control-Allow-Credentials"], "true");
  const no = H.credentialed(req("https://evil.example.com"));
  assert.equal(no["Access-Control-Allow-Origin"], undefined);
  assert.equal(no["Access-Control-Allow-Credentials"], undefined);
  const prod = process.env.NODE_ENV;
  (process.env as Record<string, string>).NODE_ENV = "production";
  assert.equal(H.trusted("http://localhost:3000"), null);
  (process.env as Record<string, string>).NODE_ENV = prod ?? "test";
  delete process.env.SHOWCASE_URL;
  delete process.env.PUBLIC_API_ORIGIN;
});

test("action bridge: a thrown redirect becomes JSON, anything else is a real error", async () => {
  const B = await import("../lib/bridge");
  const redirect = (to: string) => Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${to};307;` });

  assert.equal(B.redirectedTo(redirect("/x?ok=Hi")), "/x?ok=Hi");
  assert.equal(B.redirectedTo(redirect("/a;b?ok=1")), "/a;b?ok=1"); // a ";" inside the destination survives
  assert.equal(B.redirectedTo(new Error("boom")), null);
  assert.equal(B.redirectedTo(null), null);

  assert.deepEqual(await B.bridge(async () => { throw redirect("/onboarding?err=Wrong%20code."); }, {}), { ok: false, error: "Wrong code.", to: "/onboarding" });
  assert.deepEqual(await B.bridge(async () => { throw redirect("/me?tab=a&ok=Saved."); }, {}), { ok: true, message: "Saved.", to: "/me?tab=a" });
  assert.deepEqual(await B.bridge(async () => { throw redirect("/"); }, {}), { ok: true, message: "", to: "/" });
  assert.deepEqual(await B.bridge(async () => {}, {}), { ok: true, message: "", to: "/" });
  await assert.rejects(B.bridge(async () => { throw new Error("disk full"); }, {}), /disk full/);

  // JSON fields become form fields the way a browser would send them.
  let got: FormData | null = null;
  await B.bridge(async (fd) => { got = fd; }, { a: "x", n: 5, on: true, off: false, none: null, gone: undefined, zero: 0 });
  const fd = got as unknown as FormData;
  assert.equal(fd.get("a"), "x");
  assert.equal(fd.get("n"), "5");
  assert.equal(fd.get("on"), "on");
  assert.equal(fd.get("zero"), "0");
  for (const k of ["off", "none", "gone"]) assert.equal(fd.has(k), false, k);
});

test("inbox and message list show only what belongs to the person", async () => {
  const { run, now, TABLES, get } = await import("../lib/db");
  const A = await import("../lib/account");
  for (const t of TABLES) run(`DELETE FROM ${t}`);
  const t = now();
  const college = (slug: string) => Number(run("INSERT INTO colleges (slug, name, domains, status, created_at) VALUES (?,?,?,'active',?)", slug, slug, `${slug}.example`, t).lastInsertRowid);
  const here = college("here"), other = college("other");
  const user = (name: string, c: number, o: { verified?: number } = {}) =>
    Number(run("INSERT INTO users (sub, name, email, verified, onboarded, college_id, role, created_at) VALUES (?,?,?,?,1,?, 'student', ?)",
      `t:${name}`, name, `${name}@here.example`, o.verified ?? 1, c, t).lastInsertRowid);
  const ana = user("ana", here), ben = user("ben", here), cy = user("cy", here), dee = user("dee", other), eve = user("eve", here, { verified: 0 });
  const me = () => get("SELECT * FROM users WHERE id=?", ana)!;

  // Day headings count in Indian time.
  const noon = Math.floor(Date.UTC(2026, 10, 20, 6, 30) / 1000); // 12:00 IST on 20 Nov
  const today = Math.floor((noon + 19800) / 86400);
  assert.equal(A.groupOf(noon, today), "Today");
  assert.equal(A.groupOf(noon - 86400, today), "Yesterday");
  assert.equal(A.groupOf(noon - 3 * 86400, today), "Earlier this week");
  assert.equal(A.groupOf(noon - 20 * 86400, today), "Earlier this month");
  assert.equal(A.groupOf(noon - 90 * 86400, today), "Older");
  // 23:00 UTC is already tomorrow in India.
  const lateUtc = Math.floor(Date.UTC(2026, 10, 19, 20, 0) / 1000);
  assert.equal(A.groupOf(lateUtc, today), "Today");

  // Inbox: only my own notifications, new until opened, read after.
  run("INSERT INTO notifications (user_id, text, href, seen, created_at) VALUES (?,?,?,0,?)", ana, "For ana", "/projects/1", t);
  run("INSERT INTO notifications (user_id, text, href, seen, created_at) VALUES (?,?,?,0,?)", ben, "For ben", "/", t);
  let box = A.inbox(me());
  assert.deepEqual(box.items.map((i) => i.text), ["For ana"]);
  assert.equal(box.newCount, 1);
  assert.equal(box.items[0].href, "/projects/1");
  A.openInbox(me());
  box = A.inbox(me());
  assert.equal(box.items[0].unseen, false);
  assert.equal(box.newCount, 1, "reloading right after opening does not wipe the new marks");
  assert.equal(get("SELECT seen FROM notifications WHERE user_id=?", ben)!.seen, 0, "someone else's stays unread");

  // Messages: people are my own verified, unblocked classmates; unread counts only what was sent to me.
  const say = (from: number, to: number, text: string, seen = 0) => run("INSERT INTO messages (from_id, to_id, text, kind, seen, created_at) VALUES (?,?,?, 'text', ?, ?)", from, to, text, seen, t);
  say(ben, ana, "hi ana"); say(ben, ana, "you there?"); say(ana, cy, "hello cy", 1); say(dee, ana, "from another college");
  let list = A.messageList(me());
  assert.deepEqual(list.people.map((p) => p.name), ["ben", "cy"]); // not dee (other college), not eve (unverified), not me
  const byName = Object.fromEntries(list.conversations.map((c) => [c.user.name, c]));
  assert.equal(byName.ben.unread, 2);
  assert.equal(byName.ben.last.preview, "you there?");
  assert.equal(byName.ben.last.mine, false);
  assert.equal(byName.cy.unread, 0);
  assert.equal(byName.cy.last.mine, true);

  run("INSERT INTO blocks (user_id, blocked_id) VALUES (?,?)", ana, ben);
  list = A.messageList(me());
  assert.deepEqual(list.people.map((p) => p.name), ["cy"], "a blocked person is not offered to message");
  void eve;
});
