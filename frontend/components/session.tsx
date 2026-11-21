"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Account, Me } from "@/lib/api";
import type { Outcome } from "@/lib/account-types";
import { frontPath, type Target } from "@/lib/paths";

/* Who is signed in, for the whole site: the account menu, the header and every account page share this one answer, so
   signing in or out changes them all at once and nothing asks Connect twice.

   The browser asks Connect (the backend, `appUrl`) directly, sending Connect's own sign-in cookie. That works because the
   cookie belongs to the host, not the port, so this site and Connect share it on localhost, and in production when both
   sit on one site (for example connect.example.com and api.example.com). Connect only answers origins it trusts
   (backend SHOWCASE_URL). If it cannot be reached, the site simply behaves as signed out. */

export type State = { status: "loading" } | { status: "out" } | { status: "in"; me: Me };

type Reply<T> = { ok: boolean; status: number; data: T };
type CallInit = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit };

type Ctx = {
  appUrl: string;
  state: State;
  me: Me | null;
  /* A call to Connect with the sign-in cookie. Never throws: a failure comes back as { ok: false, data: { error } }. */
  call: <T = Record<string, unknown>>(path: string, init?: CallInit) => Promise<Reply<T>>;
  /* Run one of Connect's actions (sign in, save settings, send feedback...). */
  act: (action: string, fields?: Record<string, string | number | boolean | null | undefined>) => Promise<Outcome>;
  refresh: () => Promise<Me | null>;
  /* Signs out. From a page that needs a signed-in person it then goes to `to` (the home page unless told otherwise);
     from any other page it stays. Pass null to stay wherever this is. */
  signOut: (to?: string | null) => Promise<boolean>;
  /* For when this person is no longer signed in because they chose to leave (sign out, delete account): the page
     they are on must not bounce them to the sign-in page on its way out. */
  leave: (to: string | null) => void;
  /* Set while such an exit is under way; read by useGate. */
  leaving: React.MutableRefObject<boolean>;
  flash: (text: string, tone?: "ok" | "error") => void;
  /* A picture path on Connect (or a provider's https photo) as an address the browser can load. */
  pic: (src: string | null | undefined) => string | null;
  /* Where a path on Connect lives on this site (or stays on Connect when there is no page here yet). */
  target: (to: string) => Target;
};

const SessionContext = createContext<Ctx | null>(null);

export function useSession(): Ctx {
  const c = useContext(SessionContext);
  if (!c) throw new Error("useSession needs <SessionProvider>");
  return c;
}

const OFFLINE = "Can’t reach Connect right now. Check your connection and try again.";

/* The pages that only make sense for a signed-in person (see useGate). */
const NEEDS_A_PERSON = /^\/(me|inbox|messages|settings|feedback|onboarding)(\/|$)/;

export function SessionProvider({ appUrl, children }: { appUrl: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const leaving = useRef(false);
  // A new page has opened: whatever exit was under way is over, and its gate may act again.
  useLayoutEffect(() => { leaving.current = false; }, [pathname]);
  const [state, setState] = useState<State>({ status: "loading" });
  const [toast, setToast] = useState<{ n: number; text: string; tone: "ok" | "error" } | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const call = useCallback<Ctx["call"]>(async (path, init = {}) => {
    const { json, headers, ...rest } = init;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch(`${appUrl}${path}`, {
        credentials: "include", cache: "no-store", ...rest, signal: ctl.signal,
        ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
        headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      });
      const data = await r.json().catch(() => ({}));
      // The server says nobody is signed in (the cookie ran out, or "sign out everywhere" was used elsewhere).
      if (r.status === 401 && data?.error === "signed_out" && mounted.current) setState({ status: "out" });
      return { ok: r.ok, status: r.status, data };
    } catch {
      return { ok: false, status: 0, data: { error: OFFLINE } as never };
    } finally { clearTimeout(timer); }
  }, [appUrl]);

  const refresh = useCallback(async () => {
    const r = await call<Account>("/api/public/me");
    const me = r.ok && r.data?.signedIn ? r.data : null;
    if (!mounted.current) return me;
    // A dropped connection keeps what we knew rather than signing the person out on a hiccup.
    if (r.status === 0) { setState((s) => (s.status === "loading" ? { status: "out" } : s)); return null; }
    setState(me ? { status: "in", me } : { status: "out" });
    return me;
  }, [call]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Keep the badges fresh: when the tab comes back, and once a minute while it is open and someone is signed in.
  const signedIn = state.status === "in";
  useEffect(() => {
    const again = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    const t = signedIn ? setInterval(again, 60_000) : undefined;
    return () => { document.removeEventListener("visibilitychange", again); window.removeEventListener("focus", again); if (t) clearInterval(t); };
  }, [refresh, signedIn]);

  const act = useCallback<Ctx["act"]>(async (action, fields = {}) => {
    const r = await call<{ ok?: boolean; message?: string; error?: string; to?: string }>("/api/account/act", { method: "POST", json: { action, ...fields } });
    const d = r.data ?? {};
    if (r.ok && d.ok) return { ok: true, message: d.message ?? "", to: d.to ?? "/" };
    const error = d.error === "signed_out" ? "You were signed out. Sign in again." : d.error === "bad_origin" ? "Connect does not trust this site yet. See SHOWCASE_URL in the backend settings." : d.error || OFFLINE;
    return { ok: false, error, to: d.to ?? "" };
  }, [call]);

  const leave = useCallback((to: string | null) => {
    leaving.current = true;
    setState({ status: "out" });
    if (to) router.replace(to);
  }, [router]);

  const signOut = useCallback(async (to?: string | null) => {
    const r = await call("/api/public/signout", { method: "POST" });
    if (r.ok) leave(to === undefined ? (NEEDS_A_PERSON.test(window.location.pathname) ? "/" : null) : to);
    return r.ok;
  }, [call, leave]);

  const flash = useCallback((text: string, tone: "ok" | "error" = "ok") => setToast({ n: Date.now(), text, tone }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast((x) => (x?.n === toast.n ? null : x)), 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const pic = useCallback((src: string | null | undefined) => (!src ? null : /^https?:\/\//.test(src) ? src : `${appUrl}${src}`), [appUrl]);
  const me = state.status === "in" ? state.me : null;
  const target = useCallback((to: string) => frontPath(to, appUrl, me?.id), [appUrl, me?.id]);

  const value = useMemo<Ctx>(() => ({ appUrl, state, me, call, act, refresh, signOut, leave, leaving, flash, pic, target }),
    [appUrl, state, me, call, act, refresh, signOut, leave, flash, pic, target]);

  return (
    <SessionContext.Provider value={value}>
      {children}
      {toast && <div className={`ac-toast${toast.tone === "error" ? " is-error" : ""}`} role={toast.tone === "error" ? "alert" : "status"} key={toast.n}>
        <span>{toast.text}</span>
        <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}>×</button>
      </div>}
    </SessionContext.Provider>
  );
}

/* For a page that needs a signed-in person: sends everyone else where they belong (sign in, finish setting up, verify)
   and returns the person once they may stay. `null` means "wait, or being sent elsewhere". */
export function useGate(need: "signed-in" | "onboarded" | "member" = "onboarded"): Me | null {
  const { state, leaving } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const me = state.status === "in" ? state.me : null;
  const to = state.status === "out" ? `/signin?next=${encodeURIComponent(pathname)}`
    : me && need !== "signed-in" && !me.onboarded ? "/onboarding"
    : me && need === "member" && !me.member ? "/onboarding"
    : null;
  // Someone who just chose to sign out or delete their account is already on their way elsewhere: do not send them to sign in.
  useEffect(() => { if (to && !(state.status === "out" && leaving.current)) router.replace(to); }, [to, router, state.status, leaving]);
  return me && !to ? me : null;
}

/* Reads one thing from Connect for the signed-in person and keeps it. `reload()` fetches again without flicker. */
export function useApi<T>(path: string | null) {
  const { call } = useSession();
  const [st, setSt] = useState<{ data: T | null; error: string; status: number; loading: boolean }>({ data: null, error: "", status: 0, loading: !!path });
  const seq = useRef(0);
  const load = useCallback(async (quiet: boolean) => {
    if (!path) return;
    const n = ++seq.current;
    if (!quiet) setSt((s) => ({ ...s, loading: true, error: "" }));
    const r = await call<T & { error?: string }>(path);
    if (n !== seq.current) return;
    if (r.ok) setSt({ data: r.data, error: "", status: r.status, loading: false });
    else setSt((s) => ({ data: quiet ? s.data : null, error: String((r.data as { error?: string })?.error || OFFLINE), status: r.status, loading: false }));
  }, [path, call]);
  useEffect(() => { void load(false); }, [load]);
  const reload = useCallback(() => load(true), [load]);
  const set = useCallback((f: (d: T) => T) => setSt((s) => (s.data ? { ...s, data: f(s.data) } : s)), []);
  return { ...st, reload, set };
}
