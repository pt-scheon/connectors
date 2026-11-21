"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApi, useGate, useSession } from "@/components/session";
import { Head, Loading, Notice } from "@/components/account-ui";
import type { FeedbackData } from "@/lib/account-types";
import { ago } from "@/lib/paths";

/* Tell the Connect team what is broken, missing or good, and see what they said back. */
export function FeedbackView() {
  const me = useGate("onboarded");
  const from = useSearchParams().get("from") ?? "";
  const { act, flash } = useSession();
  const fb = useApi<FeedbackData>(me ? "/api/account/feedback" : null);
  const d = fb.data;
  const [kind, setKind] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!d) return;
    setBusy(true); setError("");
    const page = from.startsWith("/") && !from.startsWith("//") ? from : "";
    const r = await act("send-feedback", { kind: kind || d.kinds[1]?.id || d.kinds[0]?.id, text, page });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setText("");
    flash(r.message || "Sent. Thank you.");
    await fb.reload();
  }

  const chosen = kind || d?.kinds[1]?.id || d?.kinds[0]?.id || "";
  return (
    <section className="sec dark page-top ac-page">
      <Head title="Feedback" lead="Tell the Connect team what is broken, what is missing, or what works well. A person reads every one." />
      {!me || fb.loading ? <Loading /> : !d ? <Notice tone="error">{fb.error}</Notice> : (
        <div className="split">
          <form className="ac-form" onSubmit={send}>
            <fieldset className="ac-chips">
              <legend>What is it about?</legend>
              {d.kinds.map((k) => (
                <label key={k.id} className="ac-chip"><input type="radio" name="kind" value={k.id} checked={chosen === k.id} onChange={() => setKind(k.id)} /><span>{k.label}</span></label>
              ))}
            </fieldset>
            <label className="ac-field"><span>Your feedback</span>
              <textarea value={text} onChange={(e) => setText(e.target.value)} required minLength={10} maxLength={1500} rows={6}
                placeholder="What happened, or what would you change? For a problem, say what you did and what you saw." />
              <small>{text.length}/1500</small>
            </label>
            {from.startsWith("/") && !from.startsWith("//") && from !== "/feedback" && <p className="ac-small">Sent with the page you came from: <span className="mono">{from.split("?")[0]}</span></p>}
            {error && <Notice tone="error">{error}</Notice>}
            <div><button className="ac-btn" disabled={busy || text.trim().length < 10}>{busy ? "Sending…" : "Send feedback"}</button></div>
            <p className="ac-small">To report a person or a project, use <b>Report</b> on their page instead: community admins handle those.</p>
          </form>
          <div className="ac-stack tight">
            <h2 className="mono-label">What you have sent</h2>
            {d.mine.length === 0 ? <p className="ac-small">Nothing yet. Answers from the team will show here and in your <Link href="/inbox">inbox</Link>.</p> : (
              <ul className="ac-sent">
                {d.mine.map((f) => (
                  <li key={f.id}>
                    <span className="ac-row between">
                      <span className="ac-row" style={{ gap: 8 }}><span className="ac-status">{f.kindLabel}</span><span className={`ac-status ${f.statusTone}`}>{f.statusLabel}</span></span>
                      <span className="mono muted">{ago(f.at)}</span>
                    </span>
                    <p>{f.text}</p>
                    {f.reply && <div className="ac-reply"><span className="mono-label">Connect team</span><p>{f.reply}</p></div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
