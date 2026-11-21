"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useApi, useGate, useSession } from "@/components/session";
import { Face, Head, Loading, Notice } from "@/components/account-ui";
import type { MessageList } from "@/lib/account-types";
import { ago } from "@/lib/paths";

/* Direct messages with verified people in your own community. The list on the left stays while you move between
   conversations (this is the layout of /messages and /messages/<id>); the open conversation fills the right. */

type Shell = { reload: () => Promise<void> };
const ShellContext = createContext<Shell | null>(null);
export const useMessages = () => { const c = useContext(ShellContext); if (!c) throw new Error("needs <MessagesShell>"); return c; };

export function MessagesShell({ children }: { children: React.ReactNode }) {
  const me = useGate("member");
  const params = useParams<{ id?: string }>();
  const active = params?.id ? Number(params.id) : null;
  const list = useApi<MessageList>(me ? "/api/account/messages" : null);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");
  const { reload } = list;

  // New messages from others show up in the list without a refresh.
  useEffect(() => {
    if (!me) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") void reload(); }, 12000);
    return () => clearInterval(t);
  }, [me, reload]);

  const ctx = useMemo<Shell>(() => ({ reload }), [reload]);
  const d = list.data;
  const people = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (d?.people ?? []).filter((p) => !s || p.name.toLowerCase().includes(s) || p.branch.toLowerCase().includes(s));
  }, [d, q]);

  if (!me) return <section className="sec dark page-top ac-page ac-chat"><Loading /></section>;

  return (
    <section className="sec dark page-top ac-page ac-chat">
      <Head title="Messages" compact />
      {list.error ? <Notice tone="error">{list.error}</Notice> : !d ? <Loading /> : (
        <ShellContext.Provider value={ctx}>
          <div className={`ac-dm${active ? " has-thread" : ""}`}>
            <aside className="ac-convos" aria-label="Conversations">
              <div className="ac-convos-head">
                <h2>Chats</h2>
                <button type="button" className="ac-btn ghost sm" onClick={() => setPicking((v) => !v)} aria-expanded={picking}>{picking ? "Close" : "New message"}</button>
              </div>
              {picking && (
                <div className="ac-pick" style={{ padding: "12px 20px", maxWidth: "none", borderBottom: "1px solid var(--rule)" }}>
                  <label className="ac-field"><span>People in your community</span>
                    <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or branch" autoFocus />
                  </label>
                  <div className="ac-people">
                    {people.length === 0 && <p className="ac-small" style={{ padding: "14px 0" }}>{d.people.length === 0 ? "No one else is verified in your community yet." : "No one matches."}</p>}
                    {people.slice(0, 50).map((p) => (
                      <Link key={p.id} href={`/messages/${p.id}`} className="ac-person" onClick={() => { setPicking(false); setQ(""); }}>
                        <Face name={p.name} src={p.picture} />
                        <span><b>{p.name}</b><span className="sub">{p.branch}</span></span>
                        <span className="mono muted">Write →</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {d.conversations.length === 0 && !picking && (
                <p className="ac-small ac-empty">No conversations yet. Press “New message” to write to someone in your community.</p>
              )}
              {d.conversations.map((c) => (
                <Link key={c.user.id} href={`/messages/${c.user.id}`} className={`ac-convo${active === c.user.id ? " is-on" : ""}${c.unread ? " is-unread" : ""}`} aria-current={active === c.user.id ? "page" : undefined}>
                  <Face name={c.user.name} src={c.user.picture} />
                  <span className="ac-convo-text">
                    <span><b>{c.user.name}</b><time>{ago(c.last.at)}</time></span>
                    <span className="ac-preview">{c.last.mine ? "You: " : ""}{c.last.preview}</span>
                  </span>
                  {c.unread > 0 ? <span className="ac-count" aria-label={`${c.unread} unread`}>{c.unread}</span> : <span />}
                </Link>
              ))}
            </aside>
            <div className="ac-thread">{children}</div>
          </div>
        </ShellContext.Provider>
      )}
    </section>
  );
}

/* The right-hand side when no conversation is open. */
export function PickOne() {
  return (
    <div className="ac-empty">
      <h2>Your messages</h2>
      <p>Pick a conversation, or press “New message” to write to someone in your community. Only verified people at your own college or workplace can message each other.</p>
    </div>
  );
}
