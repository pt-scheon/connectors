"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { initials } from "./cover";
import { useSession } from "./session";
import { TierChip } from "./tier";

/* The round picture at the top right. It shows who is signed in (the site-wide session, components/session.tsx), then
   opens a menu: your profile, rank, messages, inbox, settings and sign out; or sign in. Every link goes to a page on this
   site. The one exception is marked with ↗: the project workspace, which still lives in the Connect app. */
export function AccountMenu() {
  const { state, me, signOut, pic, appUrl } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLDivElement>(null), btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  // Close on a click outside or Escape, and hand focus back to the button.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function out() {
    setBusy(true); setError("");
    const ok = await signOut();
    setBusy(false);
    if (ok) setOpen(false); else setError("Couldn’t sign out from here. Try again.");
  }

  const photo = me ? pic(me.picture) : null;
  const face = me
    ? photo ? <img src={photo} alt="" referrerPolicy="no-referrer" /> : <span>{initials(me.name)}</span>
    : <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8.5" r="3.75" /><path d="M4.75 19.5c1.2-3.4 3.9-5.25 7.25-5.25s6.05 1.85 7.25 5.25" strokeLinecap="round" /></svg>;
  const unread = me ? me.unread.inbox + me.unread.messages : 0;
  const close = () => setOpen(false);

  return (
    <div className={`account${open ? " is-open" : ""}`} ref={box}>
      <button ref={btn} type="button" className={`account-btn${me ? " has-user" : ""}`} aria-haspopup="menu" aria-expanded={open} aria-controls={id}
        aria-label={me ? `Account: ${me.name}${unread ? `, ${unread} unread` : ""}` : "Account and sign in"} onClick={() => setOpen((v) => !v)} data-loading={state.status === "loading" || undefined}>
        {face}
        {unread > 0 && <i className="account-pip" aria-hidden="true" />}
      </button>
      <div id={id} className="account-panel" role="menu" aria-hidden={!open} inert={!open}>
        {me ? (
          <>
            <div className="account-who">
              <span className="account-face" aria-hidden="true">{face}</span>
              <span className="account-id">
                <b>{me.name}</b>
                <span className="mono muted">{me.college?.name ?? (me.onboarded ? "Connect" : "Finish setting up")}</span>
              </span>
            </div>
            {me.rank && <TierChip tier={me.rank} className="account-rank" />}
            {me.anonymous && <span className="mono muted account-note">You’re anonymous. Others see this alias.</span>}
            {!me.onboarded ? (
              <Link role="menuitem" className="account-cta" href="/onboarding" onClick={close}>Finish setting up</Link>
            ) : !me.member && me.role === "student" ? (
              <Link role="menuitem" className="account-cta" href="/onboarding" onClick={close}>Verify your college email</Link>
            ) : null}
            <nav className="account-links" aria-label="Account">
              {me.onboarded && <Link role="menuitem" href="/me" onClick={close}>Your profile <span aria-hidden="true">→</span></Link>}
              {me.rank && <Link role="menuitem" href="/me#progress" onClick={close}>Rank and progress <span aria-hidden="true">→</span></Link>}
              {me.member && <Link role="menuitem" href="/messages" onClick={close}>Messages {me.unread.messages > 0 ? <b className="account-count">{me.unread.messages}</b> : <span aria-hidden="true">→</span>}</Link>}
              {me.onboarded && <Link role="menuitem" href="/inbox" onClick={close}>Inbox {me.unread.inbox > 0 ? <b className="account-count">{me.unread.inbox}</b> : <span aria-hidden="true">→</span>}</Link>}
              {me.onboarded && <Link role="menuitem" href="/settings" onClick={close}>Settings <span aria-hidden="true">→</span></Link>}
              {me.onboarded && <Link role="menuitem" href="/feedback" onClick={close}>Feedback <span aria-hidden="true">→</span></Link>}
              {me.member && <a role="menuitem" href={`${appUrl}/`} onClick={close}>Project workspace <span aria-hidden="true">↗</span></a>}
              {me.admin && <a role="menuitem" href={`${appUrl}/admin`} onClick={close}>Admin <span aria-hidden="true">↗</span></a>}
            </nav>
            <button role="menuitem" type="button" className="account-out" onClick={out} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>
            {error && <p className="account-error">{error}</p>}
          </>
        ) : (
          <>
            <p className="account-lead">{state.status === "loading" ? "Checking…" : "You’re not signed in."}</p>
            <Link role="menuitem" className="account-cta" href="/signin" onClick={close}>Sign in to Connect</Link>
            <nav className="account-links" aria-label="Account">
              <Link role="menuitem" href="/signin" onClick={close}>Join with your college email <span aria-hidden="true">→</span></Link>
              <Link role="menuitem" href="/rules" onClick={close}>How credit works <span aria-hidden="true">→</span></Link>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
