"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useApi, useGate, useSession } from "@/components/session";
import { Confirm, Face, Head, Loading, Notice, useHashScroll } from "@/components/account-ui";
import type { Person, Settings } from "@/lib/account-types";
import { shrinkImage } from "@/lib/image";
import { ago } from "@/lib/paths";

export function SettingsView() {
  const me = useGate("onboarded");
  const st = useApi<Settings>(me ? "/api/account/settings" : null);
  const s = st.data;
  useHashScroll(!!s);

  return (
    <section className="sec dark page-top ac-page">
      <Head title="Settings" lead={<>What Connect tells you, who can reach you, and your data. To change your branch, skills or links, <Link href="/me/edit">edit your profile</Link>.</>} />
      {!me || st.loading ? <Loading /> : !s ? <Notice tone="error">{st.error}</Notice> : (
        <div className="ac-blocks">
          <Identity s={s} reload={st.reload} />
          <Preferences s={s} reload={st.reload} />
          {s.member && <Blocked s={s} reload={st.reload} />}
          <Devices s={s} />
          <div className="ac-block">
            <h2>Feedback</h2>
            <div className="ac-block-body">
              <p className="ac-small">Found a problem or have an idea? Tell the Connect team and see what they said back.</p>
              <div><Link className="ac-btn ghost" href="/feedback?from=/settings">Send feedback</Link></div>
            </div>
          </div>
          <Data />
          <Delete />
        </div>
      )}
    </section>
  );
}

type Props = { s: Settings; reload: () => Promise<void> };

/* ---------- photo, name, anonymous mode ---------- */

function Identity({ s, reload }: Props) {
  const { act, call, refresh, flash } = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|gif|heic)$/i.test(f.name)) { setMsg({ ok: false, text: "Pick a photo." }); return; }
    setBusy("photo"); setMsg(null);
    const fd = new FormData();
    fd.append("file", await shrinkImage(f));
    const r = await call<{ error?: string; anon?: boolean }>("/api/me/photo", { method: "POST", body: fd });
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: r.data.error || "Upload failed. Check your connection." }); return; }
    setMsg({ ok: true, text: r.data.anon ? "Saved. You are anonymous, so people still see your pattern until you turn that off." : "Saved. Everyone now sees this photo." });
    await Promise.all([reload(), refresh()]);
  }
  async function dropPhoto() {
    setBusy("photo"); setMsg(null);
    const r = await call<{ error?: string }>("/api/me/photo", { method: "DELETE" });
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: r.data.error || "Could not remove it." }); return; }
    setMsg({ ok: true, text: "Removed. Your sign-in photo comes back the next time you sign in." });
    await Promise.all([reload(), refresh()]);
  }
  async function anon(fields: { on: number; fresh?: number }, key: string) {
    setBusy(key); setMsg(null);
    const r = await act("set-anonymous", fields);
    setBusy(null);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    flash(r.message || "Saved.");
    await Promise.all([reload(), refresh()]);
  }

  const since = s.anonSince ? new Date(s.anonSince).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";
  return (
    <div className="ac-block" id="identity">
      <h2>Photo and name</h2>
      <div className="ac-block-body">
        <div className="ac-id">
          <Face name={s.name} src={s.anonymous ? s.avatar : s.avatar ?? s.picture} />
          <span className="ac-stack tight" style={{ minWidth: 0 }}>
            <b>{s.name}</b>
            <span className="ac-small">{s.anonymous ? `Anonymous since ${since}. Your real name is ${s.realName}.` : s.hasOwnPhoto ? "Your own photo." : "Your photo from Google or LinkedIn."}</span>
          </span>
        </div>
        <div className="ac-row">
          <button type="button" className="ac-btn sm" disabled={busy !== null} onClick={() => input.current?.click()}>{busy === "photo" ? "Uploading…" : s.hasOwnPhoto ? "Change photo" : "Upload a photo"}</button>
          {s.hasOwnPhoto && <button type="button" className="ac-btn ghost sm" disabled={busy !== null} onClick={() => void dropPhoto()}>Use my sign-in photo</button>}
          <input ref={input} className="ac-photo-input" type="file" accept="image/*" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        {msg && <Notice tone={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}

        <h3 id="anonymous" className="mono-label" style={{ marginTop: 12 }}>Anonymous mode</h3>
        <p className="ac-small">
          Appear as <b>Anon</b> and a random number, like <b>Anon 48213097</b>, with a coloured pattern instead of your name and photo, everywhere on Connect.
          Your links and resume are hidden, people never see when you read their messages, and in calls your camera stays off and your voice is disguised on
          your own device. Your projects, skills and credit still count. Your college’s admins can still see who you are, so the rules apply the same.
        </p>
        <div className="ac-row">
          {s.anonymous ? (
            <>
              <button type="button" className="ac-btn sm" disabled={busy !== null} onClick={() => void anon({ on: 0 }, "show")}>{busy === "show" ? "Saving…" : "Show my real name and photo"}</button>
              <Confirm label="New alias" question="Get a new alias? People who knew your old one will not recognise you." yes="Yes, new alias" disabled={busy !== null} onYes={() => void anon({ on: 1, fresh: 1 }, "fresh")} />
            </>
          ) : (
            <Confirm label="Go anonymous" className="ac-btn sm" question="Everyone will see an alias and a pattern instead of your name and photo." yes="Yes, go anonymous" disabled={busy !== null} onYes={() => void anon({ on: 1 }, "go")} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- alerts, who can reach you, sign-in security ---------- */

function Preferences({ s, reload }: Props) {
  const { act, flash, appUrl } = useSession();
  const [f, setF] = useState({ email_notes: s.emailNotes, follow_notes: s.followNotes, open_to_join: s.openToJoin, calls_on: s.callsOn, dm_from: s.dmFrom as string, two_step: s.twoStep });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const tick = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.checked }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await act("save-settings", { ...f, open_to_join: s.role === "student" ? f.open_to_join : false });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    flash(r.message || "Saved.");
    await reload();
  }

  return (
    <form className="ac-block" onSubmit={save}>
      <h2 id="alerts">Alerts and privacy</h2>
      <div className="ac-block-body">
        <label className="ac-check">
          <input type="checkbox" checked={f.email_notes} onChange={tick("email_notes")} />
          <span><b>Email me what lands in my inbox</b>
            <small>{!s.mailReady ? "Email is not switched on for this site yet. Your inbox still works." : s.emailTo ? `Sent to ${s.emailTo}. At most six an hour.` : "We have no email address for you."}</small></span>
        </label>
        <label className="ac-check">
          <input type="checkbox" checked={f.follow_notes} onChange={tick("follow_notes")} />
          <span><b>Tell me about projects I follow</b><small>Their milestones, posts and review results reach your inbox. Turn this off to keep following quietly.</small></span>
        </label>
        <p className="ac-small">Call and message alerts on a phone or computer while Connect is closed are turned on in the Connect app: <a href={`${appUrl}/settings#alerts`}>Alerts on this device ↗</a></p>

        <h3 id="privacy" className="mono-label" style={{ marginTop: 12 }}>Who can reach you</h3>
        {s.role === "student" && (
          <label className="ac-check">
            <input type="checkbox" checked={f.open_to_join} onChange={tick("open_to_join")} />
            <span><b>I am open to joining a project</b><small>Shows an “Open to projects” badge on your profile and puts you in the People filter that project leads use.</small></span>
          </label>
        )}
        <label className="ac-check">
          <input type="checkbox" checked={f.calls_on} onChange={tick("calls_on")} />
          <span><b>Let people call me</b><small>Voice and video calls from people in your community. With this off they can still message you.</small></span>
        </label>
        <label className="ac-field"><span>Who can start a chat with me</span>
          <select value={f.dm_from} onChange={(e) => setF((x) => ({ ...x, dm_from: e.target.value }))}>
            <option value="all">Anyone verified in my community</option>
            <option value="team">Only people I have been on a project with</option>
          </select>
          <small>You can always reply to someone you wrote to first, and a project lead can still send you a role invite.</small>
        </label>

        <h3 id="two-step" className="mono-label" style={{ marginTop: 12 }}>Sign-in security</h3>
        <label className="ac-check">
          <input type="checkbox" checked={f.two_step} onChange={tick("two_step")} />
          <span><b>Ask for an emailed code on a new device</b>
            <small>{!s.twoStepAvailable ? "Starts working once email is switched on for this site. Until then sign-in is Google or LinkedIn only."
              : s.twoStepAddress ? `After Google or LinkedIn, a six-digit code goes to ${s.twoStepAddress}. A device you trust is not asked again for ${s.trustDays} days.`
              : "Needs a verified college or work email first."}</small></span>
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <div><button className="ac-btn" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
      </div>
    </form>
  );
}

/* ---------- blocked people ---------- */

function Blocked({ s, reload }: Props) {
  const { act, flash } = useSession();
  const [busy, setBusy] = useState<number | null>(null);
  async function unblock(p: Person) {
    setBusy(p.id);
    const r = await act("set-blocked", { user: p.id, on: 0 });
    setBusy(null);
    flash(r.ok ? r.message || `${p.name} is unblocked.` : r.error, r.ok ? "ok" : "error");
    if (r.ok) await reload();
  }
  return (
    <div className="ac-block" id="blocked">
      <h2>Blocked people</h2>
      <div className="ac-block-body">
        {s.blocked.length === 0 ? <p className="ac-small">You have not blocked anyone. To block someone, open your chat with them and use Block.</p> : (
          <ul className="ac-list">
            {s.blocked.map((p) => (
              <li key={p.id}>
                <span className="ac-id"><Face name={p.name} src={p.picture} /><b>{p.name}</b></span>
                <button type="button" className="ac-btn ghost sm" disabled={busy !== null} onClick={() => void unblock(p)}>{busy === p.id ? "…" : "Unblock"}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------- devices ---------- */

function Devices({ s }: { s: Settings }) {
  const { act, flash, refresh } = useSession();
  const [busy, setBusy] = useState(false);
  async function out() {
    setBusy(true);
    const r = await act("sign-out-everywhere");
    setBusy(false);
    flash(r.ok ? r.message || "Signed out of your other devices." : r.error, r.ok ? "ok" : "error");
    if (r.ok) await refresh();
  }
  return (
    <div className="ac-block" id="devices">
      <h2>Sign-in and devices</h2>
      <div className="ac-block-body">
        <p className="ac-small">You sign in with {s.signIns.length ? s.signIns.join(" and ") : "your sign-in provider"}{s.email ? ` as ${s.email}` : ""}. Connect has no password of its own and never sees yours.</p>
        {s.lastSignIn && <p className="ac-small">Last sign-in: {ago(s.lastSignIn.at)}{s.lastSignIn.device ? `, from ${s.lastSignIn.device}` : ""}. Each new sign-in also shows in your inbox.</p>}
        <div><Confirm label="Sign out of all other devices" question="Sign out everywhere except this device?" yes="Yes, sign them out" disabled={busy} onYes={() => void out()} /></div>
        <p className="ac-small">Use this if you signed in on a shared or lost phone or computer. It also turns off alerts on those devices and forgets every trusted device, so each one is asked for a code again.</p>
      </div>
    </div>
  );
}

/* ---------- your data ---------- */

function Data() {
  const { appUrl } = useSession();
  return (
    <div className="ac-block">
      <h2>Your data</h2>
      <div className="ac-block-body">
        <p className="ac-small">A copy of everything Connect holds about you: profile, projects, reviews, vouches, clubs, questions, feedback and inbox.</p>
        <div><a className="ac-btn ghost" href={`${appUrl}/api/me/export`}>Download my data</a></div>
        <p className="ac-small">Read the <Link href="/privacy">privacy policy</Link> and <Link href="/terms">terms</Link>.</p>
      </div>
    </div>
  );
}

/* ---------- delete account ---------- */

function Delete() {
  const { act, leave, flash } = useSession();
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function del(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await act("delete-account", { confirm: word });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    leave("/");
    flash(r.message || "Your account is deleted.");
  }
  return (
    <form className="ac-block" onSubmit={del}>
      <h2>Delete account</h2>
      <div className="ac-block-body">
        <p className="ac-small">
          Your name, photo, emails, skills, links, resume, inbox, questions, messages and the files in them are erased, and you are signed out. Projects you were part of
          keep a “Deleted user” in their team, so your teammates’ signed history stays true. This cannot be undone.
        </p>
        <label className="ac-field"><span>Type delete to confirm</span>
          <input type="text" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" required pattern="[Dd][Ee][Ll][Ee][Tt][Ee]" />
        </label>
        {error && <Notice tone="error">{error}</Notice>}
        <div><button className="ac-btn danger" disabled={busy || word.trim().toLowerCase() !== "delete"}>{busy ? "Deleting…" : "Delete my account"}</button></div>
      </div>
    </form>
  );
}
