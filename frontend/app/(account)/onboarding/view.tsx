"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi, useGate, useSession } from "@/components/session";
import { Head, Loading, Notice } from "@/components/account-ui";
import type { Onboarding } from "@/lib/account-types";
import { domainOf, isAcademic, isPublicMail, matchCollege } from "@/lib/domains";

/* Joining Connect: your profile first, then proving your community (a college or a workplace) so you only ever see yours.
   The same page edits a finished profile (/me/edit). What each step is allowed to do is decided by Connect (the backend). */
export function OnboardingView({ edit = false }: { edit?: boolean }) {
  const me = useGate("signed-in");
  const router = useRouter();
  const ob = useApi<Onboarding>(me ? `/api/account/onboarding${edit ? "?edit=1" : ""}` : null);
  const d = ob.data;

  // Verified and in: this page has nothing left to do.
  useEffect(() => { if (d?.stage === "done") router.replace("/me"); }, [d?.stage, router]);

  if (!me || (!d && !ob.error)) return <section className="sec dark page-top ac-page"><Loading /></section>;
  if (!d) return <section className="sec dark page-top ac-page"><Notice tone="error">{ob.error}</Notice></section>;
  if (d.stage === "done") return <section className="sec dark page-top ac-page"><Loading label="You’re in. Taking you to your profile…" /></section>;

  if (d.stage === "profile") return <ProfileStep d={d} edit={edit} reload={ob.reload} />;
  if (d.stage === "checking" && d.college) return (
    <section className="sec dark page-top ac-page">
      <Head title="Your community is being checked" lead={<>Your email is confirmed. {d.college.name} is new on Connect, so the team makes sure @{d.college.domains[0]} really belongs to a college or workplace before opening it. You will get an inbox note the moment it opens, and so will everyone else from your community who signs up meanwhile.</>} />
      <Link className="btn-line" href="/">Back to the start <span aria-hidden="true">→</span></Link>
    </section>
  );
  if (d.stage === "alum-waiting") return (
    <section className="sec dark page-top ac-page">
      <Head title="Waiting for approval" lead={<>An admin of {d.college?.name ?? "your community"} checks each alum by hand before they can see projects or fund them. You will get an inbox note when it is done.</>} />
      <Link className="btn-line" href="/">Back to the start <span aria-hidden="true">→</span></Link>
    </section>
  );
  return <ProveStep d={d} reload={ob.reload} />;
}

/* ---------- step 1: the profile ---------- */

function ProfileStep({ d, edit, reload }: { d: Onboarding; edit: boolean; reload: () => Promise<void> }) {
  const router = useRouter();
  const { act, refresh, flash } = useSession();
  const fresh = !d.onboarded;
  const [f, setF] = useState({
    role: "student", college: "", branch: d.me.branch, grad_year: d.me.gradYear ? String(d.me.gradYear) : "", skills: d.me.skills, about: d.me.about,
    github: d.me.github, linkedin: d.me.linkedin, website: d.me.website, terms: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const r = await act("save-profile", { ...f, grad_year: f.grad_year });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    const m = await refresh();
    if (!fresh) { flash("Profile saved."); router.push("/me"); return; }
    // A student who signed in with a college email is verified straight away.
    if (m?.member) { flash(r.to === "/" && r.message ? r.message : "Your profile is saved."); router.push("/me"); return; }
    await reload();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="sec dark page-top ac-page">
      <Head title={fresh ? `Welcome, ${d.me.firstName}` : "Edit your profile"}
        lead={fresh ? "Tell us a little about what you study and build. Next you prove the college or workplace you belong to." : "Your branch, skills and links show on your profile and your public record."} />
      <form className="ac-form" onSubmit={save}>
        {fresh && (
          <label className="ac-field"><span>I am a</span>
            <select value={f.role} onChange={set("role")}><option value="student">Current member</option><option value="alum">Alum</option></select>
            <small>This cannot be changed later.</small>
          </label>
        )}
        {fresh && f.role === "alum" && (
          <label className="ac-field"><span>Community you used to be part of</span>
            <select value={f.college} onChange={set("college")} required><option value="">Pick one</option>{d.colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <small>An admin of the community approves each alum.</small>
          </label>
        )}
        <label className="ac-field"><span>Branch</span><input type="text" value={f.branch} onChange={set("branch")} placeholder="ECE, CSE, Mech…" required maxLength={60} /></label>
        <label className="ac-field"><span>Graduation year</span><input type="number" value={f.grad_year} onChange={set("grad_year")} placeholder="2027" required min={1951} max={2099} /></label>
        <label className="ac-field"><span>Skills</span><input type="text" value={f.skills} onChange={set("skills")} placeholder="React, ESP32, Figma" />
          <small>Comma separated. They show as “self-listed” until a shipped project backs them.</small></label>
        <label className="ac-field"><span>One line about you</span><input type="text" value={f.about} onChange={set("about")} placeholder="What you like building" maxLength={200} /></label>
        <label className="ac-field"><span>GitHub</span><input type="url" value={f.github} onChange={set("github")} placeholder="https://github.com/you" /></label>
        <label className="ac-field"><span>LinkedIn</span><input type="url" value={f.linkedin} onChange={set("linkedin")} placeholder="https://www.linkedin.com/in/you" /></label>
        <label className="ac-field"><span>Portfolio or website</span><input type="url" value={f.website} onChange={set("website")} placeholder="https://" /><small>Optional. Shown on your profile.</small></label>
        {fresh && (
          <label className="ac-check">
            <input type="checkbox" checked={f.terms} onChange={set("terms")} required />
            <span>I agree to the <Link href="/terms" target="_blank">Terms of Service</Link> and the <Link href="/privacy" target="_blank">Privacy policy</Link>.</span>
          </label>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="ac-row">
          <button className="ac-btn" disabled={busy}>{busy ? "Saving…" : fresh ? "Save and continue" : "Save"}</button>
          {edit && <Link className="ac-btn ghost" href="/me">Cancel</Link>}
        </div>
      </form>
    </section>
  );
}

/* ---------- step 2: prove your community ---------- */

function ProveStep({ d, reload }: { d: Onboarding; reload: () => Promise<void> }) {
  const router = useRouter();
  const { act, refresh, flash, signOut, appUrl } = useSession();
  const [email, setEmail] = useState(d.pending?.email ?? "");
  const [collegeName, setCollegeName] = useState("");
  const [signInCollege, setSignInCollege] = useState("");
  const [code, setCode] = useState("");
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const dom = domainOf(email);
  const ready = /\.[a-z]{2,}$/.test(dom);
  const known = ready ? matchCollege(dom, d.colleges) : undefined;
  const personal = ready && isPublicMail(dom);

  /* Runs one action; on success says what happened and either moves on (verified) or refreshes this page's data. */
  async function run(key: string, action: string, fields: Record<string, string>) {
    setBusy(key); setError("");
    const r = await act(action, fields);
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    const m = await refresh();
    flash(r.message || "Done.");
    if (m?.member) { router.push("/me"); return; }
    await reload();
  }

  async function workGoogle() {
    setBusy("google");
    // Leave this account, then let Google ask which account to use; the college or work one proves the community.
    await signOut(null);
    window.location.href = `${appUrl}/api/auth/google?next=${encodeURIComponent(`${window.location.origin}/onboarding`)}`;
  }

  return (
    <section className="sec dark page-top ac-page">
      <p className="mono-label">Step 2 of 2</p>
      <Head title="Prove your community"
        lead={<>Each community on Connect, like the students of a college or the employees of a workplace, is its own space. You get into yours, and only yours, by proving an email address your college or workplace gave you. You get {d.starter} starter credit once it is done.</>} />
      {error && <div className="ac-narrow" style={{ marginBottom: 24 }}><Notice tone="error">{error}</Notice></div>}
      <div className="ac-ways">
        {d.signInProof ? (
          <form className="ac-way" onSubmit={(e) => { e.preventDefault(); void run("proof", "join-with-sign-in-email", { college_name: signInCollege }); }}>
            <span className="mono-label">Quickest</span>
            <h2>You signed in as {d.signInProof.email}</h2>
            <p className="ac-small">{d.signInProof.college ? <>That is a <b>{d.signInProof.college}</b> address, which already proves your community.</> : <>@{d.signInProof.domain} is new on Connect.</>}</p>
            {!d.signInProof.college && (
              <label className="ac-field"><span>Your community’s full name</span>
                <input type="text" value={signInCollege} onChange={(e) => setSignInCollege(e.target.value)} placeholder="e.g. Dhirubhai Ambani University or Acme Labs" minLength={3} maxLength={80} required />
                <small>{d.signInProof.academic ? "Academic domain: your community opens straight away." : "The Connect team checks new non-academic domains before the community opens."}</small>
              </label>
            )}
            <div><button className="ac-btn" disabled={busy !== null}>{busy === "proof" ? "Joining…" : d.signInProof.college ? `Join ${d.signInProof.college}` : "Add my community and join"}</button></div>
          </form>
        ) : (
          d.googleOn && (
            <div className="ac-way">
              <span className="mono-label">Fastest</span>
              <h2>Use your college or work Google account</h2>
              <p className="ac-small">You leave this account, then Google asks which account to use. Pick the one with your college or work email: its verified address proves your community straight away.</p>
              <div><button type="button" className="ac-btn" onClick={workGoogle} disabled={busy !== null}>{busy === "google" ? "Opening Google…" : "Continue with Google"}</button></div>
            </div>
          )
        )}

        {d.mail === "off" ? (
          !d.signInProof && <div className="ac-way"><p className="ac-small">Getting a code by email is not switched on for this site yet.</p></div>
        ) : (
          <div className="ac-way">
            <span className="mono-label">{d.signInProof || d.googleOn ? "Or" : "Fastest"}</span>
            <h2>Get a 6-digit code at your college or work email</h2>
            <form className="ac-stack tight" onSubmit={(e) => { e.preventDefault(); void run("send", "send-code", { email, college_name: collegeName }); }}>
              <div className="ac-inline">
                <label className="ac-field"><span>Email</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.ac.in or you@company.com" required autoComplete="email" />
                </label>
                <button className="ac-btn ghost" disabled={busy !== null}>{busy === "send" ? "Sending…" : d.pending ? "Send a new code" : "Send code"}</button>
              </div>
              {ready && (personal ? <p className="ac-small" style={{ color: "var(--red-3)" }}>That is a personal address. Use the one your college or workplace gave you.</p>
                : known ? <p className="ac-small" style={{ color: "#7ee2a8" }}>✓ {known.name}</p>
                : (
                  <label className="ac-field"><span>Your community’s full name</span>
                    <input type="text" value={collegeName} onChange={(e) => setCollegeName(e.target.value)} placeholder="e.g. Dhirubhai Ambani University or Acme Labs" minLength={3} maxLength={80} required />
                    <small>@{dom} is new on Connect. {isAcademic(dom) ? "It is an academic domain, so your community opens as soon as you confirm the code." : "The Connect team checks new non-academic domains before the community opens."}</small>
                  </label>
                ))}
            </form>
            {d.pending && (
              <form className="ac-inline" onSubmit={(e) => { e.preventDefault(); void run("verify", "verify-code", { code: code.trim() }); }}>
                <label className="ac-field"><span>6-digit code sent to {d.pending.email}</span>
                  <input type="text" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required maxLength={12} />
                </label>
                <button className="ac-btn" disabled={busy !== null || code.trim().length < 6}>{busy === "verify" ? "Checking…" : "Verify"}</button>
              </form>
            )}
            {d.pending?.devCode && <Notice>Development mode: no email service is set up, so the code is shown here: <b className="mono">{d.pending.devCode}</b></Notice>}
          </div>
        )}

        {d.colleges.length > 0 && (
          <form className="ac-way" onSubmit={(e) => { e.preventDefault(); void run("ask", "ask-college-admin", { college: ask }); }}>
            <span className="mono-label">Or</span>
            <h2>Ask your community’s admins</h2>
            <p className="ac-small">{d.college
              ? <>You asked the admins of <b>{d.college.name}</b> to verify you. You will get an inbox note when they do.</>
              : "No college or work email at all? An admin of your community can verify you by hand."}</p>
            {!d.college && (
              <div className="ac-inline">
                <label className="ac-field"><span>Your community</span>
                  <select value={ask} onChange={(e) => setAsk(e.target.value)} required><option value="" disabled>Pick one</option>{d.colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                </label>
                <button className="ac-btn ghost" disabled={busy !== null || !ask}>{busy === "ask" ? "Asking…" : "Ask admins"}</button>
              </div>
            )}
          </form>
        )}
      </div>

      {d.colleges.length > 0 && (
        <details className="ac-help" style={{ marginTop: 28 }}>
          <summary>Communities on Connect ({d.colleges.length})</summary>
          <ul className="ac-colleges">{d.colleges.map((c) => <li key={c.id}><Link href={`/colleges/${c.slug}`}>{c.name}</Link><span>@{c.domains.join(", @")}</span></li>)}</ul>
        </details>
      )}
    </section>
  );
}
