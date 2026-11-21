"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi, useSession } from "@/components/session";
import { Face, Head, Loading, Notice } from "@/components/account-ui";
import type { SignInOptions } from "@/lib/account-types";
import { safeNext } from "@/lib/paths";

const GoogleMark = () => (
  <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.300 5.500-4.800 7.200l7.700 6c4.500-4.200 6.900-10.300 6.900-17.700z" />
    <path fill="#FBBC05" d="M10.500 28.600A14.500 14.500 0 0 1 9.500 24c0-1.600.3-3.100.8-4.600l-7.900-6.200A24 24 0 0 0 0 24c0 3.900.9 7.500 2.600 10.800l7.900-6.200z" />
    <path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.700-6c-2.200 1.400-4.900 2.300-8.200 2.300-6.300 0-11.600-4.200-13.500-9.900l-7.900 6.200C6.500 42.600 14.600 48 24 48z" />
  </svg>
);
const LinkedInMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="#fff">
    <path d="M20.400 20.400h-3.500v-5.500c0-1.300 0-3-1.800-3s-2.100 1.400-2.100 2.900v5.600H9.400V9h3.400v1.600c.5-.9 1.600-1.800 3.400-1.800 3.600 0 4.300 2.400 4.300 5.500v6.100zM5.300 7.400a2.100 2.100 0 1 1 0-4.100 2.100 2.100 0 0 1 0 4.100zM7.100 20.400H3.600V9h3.500v11.400z" />
  </svg>
);

export function SignInView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const fromProvider = params.get("err");
  const { me, state, act, refresh, appUrl } = useSession();
  const opts = useApi<SignInOptions>("/api/account/signin");
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  // Someone who is already signed in has nothing to do here.
  useEffect(() => { if (me) router.replace(me.onboarded ? next : "/onboarding"); }, [me, next, router]);

  async function samplePerson(id: number) {
    setBusy(id); setError("");
    const r = await act("dev-sign-in", { id });
    if (!r.ok) { setBusy(null); setError(r.error); return; }
    // With TWO_STEP_DEV=1 even a sample person is asked for the emailed code on a new device.
    if (r.to.startsWith("/signin/verify")) { router.push(`/signin/verify?next=${encodeURIComponent(next)}`); return; }
    const m = await refresh();
    router.replace(m && !m.onboarded ? "/onboarding" : next);
  }

  const o = opts.data;
  // After Google or LinkedIn, Connect sends the person back to this site, to the page they were going to.
  const provider = (key: string) => `${appUrl}/api/auth/${key}?next=${encodeURIComponent(origin + next)}`;
  const unready = !!o?.providers.some((p) => !p.ready);

  return (
    <section className="sec dark page-top ac-page">
      <Head title="Sign in" lead="For members and alumni of one community, like the students of a college or the employees of a workplace. Build things with each other, and let the record speak." />
      <div className="split">
        <div className="ac-stack">
          {(fromProvider || error) && <Notice tone="error">{fromProvider || error}</Notice>}
          {me ? <Loading label="You’re signed in. Taking you there…" />
            : state.status === "loading" || opts.loading ? <Loading />
            : opts.error ? <Notice tone="error">{opts.error}</Notice> : (
            <>
              <div className="ac-oauths">
                {o?.providers.map((p) => (
                  <a key={p.key} className={`ac-oauth${p.key === "linkedin" ? " alt" : ""}`} href={origin ? provider(p.key) : `${appUrl}/api/auth/${p.key}`}>
                    {p.key === "google" ? <GoogleMark /> : <LinkedInMark />}Continue with {p.label}
                  </a>
                ))}
                {o && o.providers.length === 0 && !o.dev && <Notice>Sign-in is not set up yet. Add Google or LinkedIn keys to the server.</Notice>}
              </div>
              <p className="ac-small">We get your name, photo and email. Members then confirm a college or work email, unless they signed in with it. Alumni are approved by an admin. By continuing you agree to the <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>.</p>
              <details className="ac-help">
                <summary>Trouble signing in?</summary>
                <div>
                  <p><b>Forgot your password?</b> Connect has no password of its own. You sign in with your Google or LinkedIn account, so reset it there: <a href="https://accounts.google.com/signin/recovery" target="_blank" rel="noopener noreferrer">recover a Google account</a> or <a href="https://www.linkedin.com/uas/request-password-reset" target="_blank" rel="noopener noreferrer">reset a LinkedIn password</a>. Then come back and sign in.</p>
                  <p><b>No sign-in code in your email?</b> Check spam, wait a minute, then press “send a new code”. The code goes to your college or work address.</p>
                  <p><b>Landed on an empty new account?</b> You probably picked a different account from the one you joined with. Sign out, then choose the Google or LinkedIn account you used the first time.</p>
                  <p><b>Lost a phone or used a shared computer?</b> Sign in on a device you trust, open Settings and press <b>Sign out of all other devices</b>.</p>
                  <p><b>Told your account is suspended?</b> Only an admin of your community can restore it.</p>
                </div>
              </details>
              {o?.dev && !o.demo && unready && <Notice>Development note: a button without keys in <code>backend/.env.local</code> sends you back here with a message. See the README for the two-minute setup.</Notice>}
            </>
          )}
        </div>
        {o?.dev && !me && (
          <div className="ac-stack tight">
            <h2 className="mono-label">{o.demo ? "Test site" : "Development only"}</h2>
            <p className="ac-small">{o.demo ? "Sign in as any of these invented people to try Connect. Nothing here is real, and this test site is wiped from time to time."
              : "Sign in as a sample person. This list never appears in production."}</p>
            {o.people.length === 0 && <p className="ac-small">No sample people yet. Run <code>npm run seed</code> in the backend.</p>}
            <div className="ac-people">
              {o.people.map((u) => (
                <button key={u.id} type="button" className="ac-person" disabled={busy !== null} onClick={() => samplePerson(u.id)}>
                  <Face name={u.name} src={u.picture} />
                  <span><b>{u.name}</b><span className="sub">{u.college ?? "no community yet"} · {u.role === "alum" ? "alum" : u.branch}{u.admin ? " · admin" : ""}</span></span>
                  <span className="mono muted">{busy === u.id ? "Signing in…" : "Sign in →"}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
