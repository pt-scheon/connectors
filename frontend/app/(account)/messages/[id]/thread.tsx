"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session";
import { Confirm, Face, Loading } from "@/components/account-ui";
import type { Msg, Thread as ThreadData } from "@/lib/account-types";
import { useMessages } from "../shell";

const time = (t: number) => new Date(t * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dayOf = (t: number) => {
  const d = new Date(t * 1000), n = new Date();
  const key = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  if (key(d) === key(n)) return "Today";
  const y = new Date(n); y.setDate(n.getDate() - 1);
  if (key(d) === key(y)) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", ...(d.getFullYear() !== n.getFullYear() ? { year: "numeric" } : {}) });
};
const size = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

/* One conversation. New messages arrive every few seconds while the tab is open; reading them marks them read. */
export function Thread({ id }: { id: number }) {
  const router = useRouter();
  const { call, act, flash, appUrl, target } = useSession();
  const { reload } = useMessages();
  const [t, setT] = useState<ThreadData | null>(null);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const last = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const load = useCallback(async (first: boolean) => {
    const r = await call<ThreadData & { error?: string }>(`/api/account/messages/${id}?after=${first ? 0 : last.current}`);
    if (!r.ok) {
      if (first) setError(r.status === 404 ? "That person is not in your community." : String((r.data as { error?: string }).error || "Could not open this conversation."));
      return;
    }
    const d = r.data;
    const top = d.messages.reduce((m, x) => Math.max(m, x.id), last.current);
    const fresh = !first && d.messages.length > 0;
    last.current = top;
    setT((prev) => (first || !prev ? d : { ...d, messages: [...prev.messages, ...d.messages.filter((m) => !prev.messages.some((p) => p.id === m.id))] }));
    if (first || fresh) void reload();
  }, [id, call, reload]);

  useEffect(() => { void load(true); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(false); }, 4000);
    return () => clearInterval(timer);
  }, [load]);

  // Stay at the bottom while new messages arrive, unless the person scrolled up to read.
  useLayoutEffect(() => { const el = box.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [t?.messages.length]);
  const onScroll = () => { const el = box.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setSendError("");
    const r = await call<{ message?: Msg; error?: string }>(`/api/account/messages/${id}`, { method: "POST", json: { text: body } });
    setSending(false);
    if (!r.ok || !r.data.message) { setSendError(r.data.error || "Could not send that. Try again."); return; }
    const m = r.data.message;
    setText("");
    stick.current = true;
    last.current = Math.max(last.current, m.id);
    setT((prev) => (prev ? { ...prev, messages: prev.messages.some((x) => x.id === m.id) ? prev.messages : [...prev.messages, m] } : prev));
    void reload();
  }

  async function block(on: boolean) {
    const r = await act("set-blocked", { user: id, on: on ? 1 : 0 });
    if (!r.ok) { flash(r.error, "error"); return; }
    flash(on ? "Blocked. They cannot message or invite you, and you will not see their messages." : "Unblocked.");
    void reload();
    if (on) router.push("/messages"); else await load(true);
  }

  if (error) return <div className="ac-empty"><h2>Can’t open this chat</h2><p>{error}</p><Link className="ac-btn ghost sm" href="/messages">Back to your messages</Link></div>;
  if (!t) return <div className="ac-empty"><Loading /></div>;

  const file = (m: Msg) => `${appUrl}/api/files/${m.file!.key}`;
  const open = `${appUrl}/messages/${id}`;
  let prevDay = "";
  return (
    <>
      <div className="ac-thread-head">
        <div className="ac-id">
          <Link href="/messages" className="ac-btn ghost sm ac-back-list" aria-label="Back to all chats">←</Link>
          <Face name={t.other.name} src={t.other.picture} />
          <span><b>{t.other.name}</b><span className="sub">{t.other.branch}</span></span>
        </div>
        <div className="ac-row">
          <a className="ac-link ac-small" href={open}>Calls and files in Connect ↗</a>
          {!t.iBlocked && <Confirm label="Block" question={`Block ${t.other.name.split(" ")[0]}? They cannot message or invite you, and you will not see their messages.`} yes="Yes, block" onYes={() => void block(true)} />}
        </div>
      </div>
      <div className="ac-msgs" ref={box} onScroll={onScroll} role="log" aria-live="polite" aria-label={`Conversation with ${t.other.name}`}>
        {t.messages.length === 0 && <p className="ac-small" style={{ margin: "auto", textAlign: "center" }}>No messages yet. Say hello.</p>}
        {t.messages.map((m) => {
          const day = dayOf(m.created_at);
          const sep = day !== prevDay;
          prevDay = day;
          return (
            <div key={m.id} style={{ display: "contents" }}>
              {sep && <span className="ac-day">{day}</span>}
              {m.kind === "invite" || m.kind === "project" ? (
                <div className={`ac-msg${m.mine ? " is-mine" : ""}`}>
                  <span className="ac-kind">{m.kind === "invite" ? "Project invite" : "Shared a project"}</span>
                  <b>{m.project_name ?? "A project"}</b>
                  {m.text && <div>{m.text}</div>}
                  {m.project_id && <a href={target(`/projects/${m.project_id}`).href}>{m.mine || m.kind === "project" ? "Open project ↗" : "See the project and ask to join ↗"}</a>}
                  <time>{time(m.created_at)}</time>
                </div>
              ) : m.kind === "call" ? (
                <span className="ac-day">{/video/i.test(m.text) ? "🎥" : "📞"} {m.text} · {time(m.created_at)}</span>
              ) : m.file ? (
                <div className={`ac-msg${m.mine ? " is-mine" : ""}`}>
                  {m.kind === "image" ? <a href={file(m)} target="_blank" rel="noopener noreferrer"><img src={file(m)} alt={m.text || m.file.name} loading="lazy" style={{ maxWidth: "100%", borderRadius: 12, ...(m.file.w && m.file.h ? { aspectRatio: `${m.file.w} / ${m.file.h}` } : {}) }} /></a>
                    : m.kind === "voice" ? <audio controls preload="none" src={file(m)} style={{ maxWidth: "100%" }} />
                    : m.kind === "video" ? <video controls playsInline preload="metadata" src={file(m)} style={{ maxWidth: "100%", borderRadius: 12 }} />
                    : <a href={file(m)} target="_blank" rel="noopener noreferrer">📎 {m.file.name} <span style={{ opacity: 0.7 }}>({size(m.file.size)})</span></a>}
                  {m.text && <div>{m.text}</div>}
                  <time>{time(m.created_at)}</time>
                </div>
              ) : (
                <div className={`ac-msg${m.mine ? " is-mine" : ""}`}>{m.text}<time>{time(m.created_at)}{m.mine && t.seenUpTo === m.id ? " · Seen" : ""}</time></div>
              )}
            </div>
          );
        })}
      </div>
      {t.canSend ? (
        <form className="ac-composer" onSubmit={send}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000} placeholder={`Message ${t.other.name.split(" ")[0]}`} aria-label="Message"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 140)}px`; }} />
          <button className="ac-btn" disabled={sending || !text.trim()}>{sending ? "Sending…" : "Send"}</button>
        </form>
      ) : (
        <p className="ac-closed ac-row">
          <span>{t.reason || "You cannot message this person."}</span>
          {t.iBlocked && <button type="button" className="ac-btn ghost sm" onClick={() => void block(false)}>Unblock</button>}
        </p>
      )}
      {sendError && <p className="ac-closed" role="alert" style={{ color: "var(--red-3)", borderTop: 0, paddingTop: 0 }}>{sendError}</p>}
    </>
  );
}
