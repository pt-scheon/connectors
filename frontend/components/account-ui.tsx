"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import { initials } from "./cover";
import { useSession } from "./session";
import type { Target } from "@/lib/paths";

/* Small pieces shared by the account pages. */

/* A person's picture from Connect, else their initials. */
export function Face({ name, src, className = "" }: { name: string; src: string | null | undefined; className?: string }) {
  const { pic } = useSession();
  const url = pic(src);
  if (url) return <img className={`avatar ${className}`} src={url} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" />;
  return <span className={`avatar avatar-initials ${className}`} aria-hidden="true">{initials(name)}</span>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: React.ReactNode }) {
  return <p className={`ac-note${tone === "error" ? " is-error" : tone === "ok" ? " is-ok" : ""}`} role={tone === "error" ? "alert" : "status"}>{children}</p>;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <p className="mono ac-loading" role="status">{label}</p>;
}

/* A link that goes where a path on Connect now lives: a page on this site, or (marked ↗) the Connect app. */
export function Go({ to, className, children }: { to: Target; className?: string; children: React.ReactNode }) {
  return to.external
    ? <a href={to.href} className={className}>{children}</a>
    : <Link href={to.href} className={className}>{children}</Link>;
}

/* Page title and the line under it, in the site's huge light type. */
export function Head({ title, lead, compact, children }: { title: string; lead?: React.ReactNode; compact?: boolean; children?: React.ReactNode }) {
  return (
    <>
      <h1 className={`mega${compact ? " ac-mega-sm" : ""}`}>{title}</h1>
      {lead && <p className="lead page-lead">{lead}</p>}
      {children}
    </>
  );
}

/* A button that asks "are you sure?" in place before doing something that is hard to undo. */
export function Confirm({ label, question, yes, onYes, className = "ac-btn ghost sm", disabled }: {
  label: string; question: string; yes: string; onYes: () => void; className?: string; disabled?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" className={className} disabled={disabled} onClick={() => setAsking(true)}>{label}</button>;
  return (
    <span className="ac-confirm" role="group" aria-label={question}>
      <span className="ac-small"><b>{question}</b></span>
      <button type="button" className="ac-btn sm" onClick={() => { setAsking(false); onYes(); }}>{yes}</button>
      <button type="button" className="ac-btn ghost sm" onClick={() => setAsking(false)}>Cancel</button>
    </span>
  );
}

/* These pages fill in after they load, so a link like /settings#alerts needs to scroll once the content is there. */
export function useHashScroll(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [ready]);
}
