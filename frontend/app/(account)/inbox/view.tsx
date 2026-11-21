"use client";

import { useEffect, useMemo, useRef } from "react";
import { useApi, useGate, useSession } from "@/components/session";
import { Go, Head, Loading, Notice } from "@/components/account-ui";
import type { Inbox, InboxItem } from "@/lib/account-types";
import { ago } from "@/lib/paths";

/* Notes from Connect: a teammate asked to join, a project was signed, credit changed. Opening the inbox marks them read
   (the badge in the header clears), but what was new stays marked here until you leave. */
export function InboxView() {
  const me = useGate("onboarded");
  const { call, refresh, target } = useSession();
  const inbox = useApi<Inbox>(me ? "/api/account/inbox" : null);
  const d = inbox.data;

  const opened = useRef(false);
  useEffect(() => {
    if (!d || opened.current) return;
    opened.current = true;
    void call("/api/account/inbox", { method: "POST" }).then(() => refresh());
  }, [d, call, refresh]);

  const groups = useMemo(() => {
    const out: { name: string; items: InboxItem[] }[] = [];
    for (const it of d?.items ?? []) {
      const g = out.find((x) => x.name === it.group);
      if (g) g.items.push(it); else out.push({ name: it.group, items: [it] });
    }
    return out;
  }, [d]);

  return (
    <section className="sec dark page-top ac-page">
      <Head title="Inbox" lead={d ? (d.newCount > 0 ? `${d.newCount} new since you last looked.` : d.items.length ? "Nothing new since you last looked." : "Nothing yet.") : undefined} />
      {!me || inbox.loading ? <Loading />
        : inbox.error ? <Notice tone="error">{inbox.error}</Notice>
        : !d || d.items.length === 0 ? (
          <div className="ac-stack ac-narrow">
            <p className="statement sm">Notes about your projects, messages and credit show up here.</p>
          </div>
        ) : (
          <div className="ac-groups">
            {groups.map((g) => {
              const fresh = g.items.filter((i) => i.isNew).length;
              return (
                <div key={g.name} className="ac-group">
                  <h2>{g.name}{fresh > 0 && <em>{fresh} new</em>}</h2>
                  <ul className="ac-items">
                    {g.items.map((it) => {
                      const to = target(it.href);
                      return (
                        <li key={it.id}>
                          <Go to={to} className={`ac-item${it.isNew ? " is-new" : ""}`}>
                            <time className="mono" dateTime={it.at ?? undefined}>{ago(it.at)}</time>
                            <span className="ac-item-text">{it.text}</span>
                            <span className="ac-go">{to.external ? "Open in Connect ↗" : "Open →"}</span>
                          </Go>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
    </section>
  );
}
