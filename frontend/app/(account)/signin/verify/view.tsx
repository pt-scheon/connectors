"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi, useSession } from "@/components/session";
import { Head, Loading, Notice } from "@/components/account-ui";
import type { VerifyState } from "@/lib/account-types";
import { safeNext } from "@/lib/paths";

/* Step two of signing in: the six-digit code emailed to the person's college address (a new device only). */
export function VerifyView() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const { act, refresh, flash } = useSession();
  const v = useApi<VerifyState>("/api/account/verify");
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(true);
  const [busy, setBusy] = useState<"verify" | "resend" | null>(null);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  // No code is waiting for this browser (it ran out, or this page was opened directly): start again.
  useEffect(() => { if (v.data && !v.data.pending) router.replace(`/signin?next=${encodeURIComponent(next)}`); }, [v.data, next, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("verify"); setMsg(null);
    const r = await act("verify-login", { code: code.replace(/\s+/g, ""), trust });
    if (!r.ok) {
      setBusy(null);
      if (r.to === "/signin") { router.replace(`/signin?err=${encodeURIComponent(r.error)}&next=${encodeURIComponent(next)}`); return; }
      setMsg({ tone: "error", text: r.error });
      return;
    }
    const m = await refresh();
    router.replace(m && !m.onboarded ? "/onboarding" : next);
    flash("You’re signed in.");
  }

  async function resend() {
    setBusy("resend"); setMsg(null);
    const r = await act("resend-login");
    setBusy(null);
    setMsg(r.ok ? { tone: "ok", text: r.message } : { tone: "error", text: r.error });
  }

  const d = v.data && v.data.pending ? v.data : null;
  return (
    <section className="sec dark page-top ac-page">
      <Head title="Check your email" lead={d ? <>This device is new to Connect, so we sent a six-digit code to <b>{d.to}</b>. It expires in {d.minutes} minutes.</> : undefined} />
      {v.loading || !d ? (v.error ? <Notice tone="error">{v.error}</Notice> : <Loading />) : (
        <div className="ac-stack ac-narrow">
          <form className="ac-form" onSubmit={submit}>
            <label className="ac-field"><span>Sign-in code</span>
              <input className="ac-code" type="text" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus placeholder="123456"
                value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <label className="ac-check">
              <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
              <span><b>Trust this device for {d.trustDays} days</b><small>Untick this on a shared or borrowed computer.</small></span>
            </label>
            {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
            <div><button className="ac-btn" disabled={busy !== null || code.replace(/\s+/g, "").length < 6}>{busy === "verify" ? "Checking…" : "Sign in"}</button></div>
          </form>
          <p className="ac-small">No email? Check spam, then <button type="button" className="ac-link" onClick={resend} disabled={busy !== null}>{busy === "resend" ? "sending…" : "send a new code"}</button>.</p>
          <p className="ac-small">Not you, or the wrong account? <Link href="/signin">Start again</Link>. You can turn this step off later in Settings.</p>
        </div>
      )}
    </section>
  );
}
