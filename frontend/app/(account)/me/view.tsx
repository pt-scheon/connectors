"use client";

import Link from "next/link";
import { useApi, useGate, useSession } from "@/components/session";
import { Face, Go, Loading, Notice, useHashScroll } from "@/components/account-ui";
import { TierBadge } from "@/components/tier";
import { ProgressChart } from "@/components/progress-chart";
import { monthYear, pad2 } from "@/lib/api";
import type { Profile } from "@/lib/account-types";

const STATUS: Record<string, string> = { recruiting: "Recruiting", building: "Building", review: "In review", shipped: "Shipped" };
const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/* Your own page on Connect: the same record everyone else sees on /builders/<you>, plus what only you see
   (private projects, credibility, what you can spend) and the ways to change it. */
export function MeView() {
  const me = useGate("onboarded");
  const { target } = useSession();
  const api = useApi<Profile>(me ? "/api/account/profile" : null);
  const p = api.data;

  // The content arrives after the page, so a link like /me#progress needs to scroll once it is there.
  useHashScroll(!!p);

  if (!me || (!p && !api.error)) return <section className="sec dark page-top ac-page"><Loading /></section>;
  if (!p) return <section className="sec dark page-top ac-page"><Notice tone="error">{api.error}</Notice></section>;

  const alum = p.role === "alum";
  const r = p.rank;
  const links = ([["GitHub", p.github], ["LinkedIn", p.linkedin], ["Website", p.website]] as [string, string][]).filter(([, v]) => v);
  const line = [p.branch, p.classOf && `class of ${p.classOf}`, alum && "alum"].filter(Boolean).join(", ");
  const projects = p.projects;
  const showSkills = !alum && (p.skills.confirmed.length > 0 || p.skills.listedOnly.length > 0);
  // The last section follows a dark one (the hero or Progress) unless the Skills section, which is cream, comes just before it.
  const tightTail = alum || (!!r && !showSkills);

  return (
    <>
      <section className="sec dark page-top ac-page">
        <div className="person-head">
          <Face name={p.name} src={p.anonymous ? p.avatar : p.avatar ?? p.picture} className="person-avatar" />
          <h1 className="mega">{p.name}</h1>
        </div>
        <p className="lead page-lead">
          {line}{p.college && <>{line && " · "}<Link href={`/colleges/${p.college.slug}`}>{p.college.name}</Link></>}
        </p>
        {p.about && <p className="ac-about">{p.about}</p>}
        <div className="ac-badges">
          {p.verified
            ? <span className="ac-badge ok">{alum ? "Alum approved by a community admin" : p.collegeDomain ? `Verified @${p.collegeDomain} email` : "Verified"}</span>
            : <span className="ac-badge warn">Not verified</span>}
          {!alum && p.openToJoin && <span className="ac-badge ok">Open to projects</span>}
          {p.anonymous && <span className="ac-badge">Anonymous{p.realName ? ` · real name ${p.realName}` : ""}</span>}
          {p.signIns.map((s) => <span key={s} className="ac-badge">{s} sign-in</span>)}
        </div>
        {links.length > 0 && <div className="ac-links">{links.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer">{label}: {host(url)} ↗</a>)}</div>}
        <div className="ac-hero-actions">
          <Link className="ac-btn" href="/me/edit">Edit profile</Link>
          <Link className="ac-btn ghost" href="/settings">Settings</Link>
          <Link className="ac-btn ghost" href={`/builders/${p.id}`}>See it as others do</Link>
        </div>

        {!alum && (
          <div className="ac-alerts">
            {p.alerts.left > 0 && <Notice>Left or dropped {p.alerts.left} of {p.alerts.joined} projects. Teams see this before accepting a join request.</Notice>}
            {p.alerts.circle && <Notice>Closed circle: all of your credit comes from projects with the same {p.alerts.circleWith} {p.alerts.circleWith === 1 ? "person" : "people"}.</Notice>}
            {p.alerts.ring && <Notice>Vouch ring: a small group that only vouches for each other. Their vouches for one another count a quarter.</Notice>}
          </div>
        )}

        {!alum && (
          <dl className="stats" style={{ marginTop: "clamp(32px, 4vw, 56px)" }}>
            <div><dd>{p.credit.earned}</dd><dt className="mono">credit earned · {p.credit.spendable} to spend</dt></div>
            <div><dd>{p.credit.shipped}<small>/{p.credit.joined}</small></dd><dt className="mono">shipped of joined</dt></div>
            <div><dd>{p.credibility ?? "—"}<small>/100</small></dd><dt className="mono">credibility</dt></div>
            <div>
              {r ? <dd className={`stat-rank tier-name tier-${r.id}`}><TierBadge tier={r} size={52} title />{r.name}</dd> : <dd>—</dd>}
              <dt className="mono">rank</dt>
            </div>
          </dl>
        )}
      </section>

      {!alum && (
        <section className="sec light split">
          <h2 className="title">Signed work</h2>
          {projects.length === 0 ? (
            <div className="ac-stack">
              <p className="statement sm">No projects yet. Credit comes from shipping work other people sign for.</p>
              <div><Go to={{ href: "/work", external: false }} className="btn-line">See what others shipped <span aria-hidden="true">→</span></Go></div>
            </div>
          ) : (
            <ol className="rows">
              {projects.map((x, i) => {
                const to = x.status === "shipped" && !x.private ? { href: `/work/${x.id}`, external: false } : target(`/projects/${x.id}`);
                return (
                  <li key={x.id}>
                    <Go to={to} className="row">
                      <span className="row-tile" aria-hidden="true">{pad2(i + 1)}</span>
                      <span className="row-main">
                        <span className="row-title">{x.name}{x.role && <span className="muted"> · {x.role}</span>}{x.private && <span className="ac-private">private</span>}</span>
                        <span className="row-sub">{x.did || x.pitch}</span>
                      </span>
                      <span className="mono row-meta">{STATUS[x.status] ?? x.status}{x.shippedAt && <><br />{monthYear(x.shippedAt)}</>}{to.external && <><br />opens in Connect ↗</>}</span>
                    </Go>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {!alum && r && (
        <section className="sec dark split" id="progress">
          <h2 className="title">Progress</h2>
          <div className="progress">
            <div className="rank-card">
              <TierBadge tier={r} size={72} />
              <div className="rank-text">
                <b className={`rank-name tier-name tier-${r.id}`}>{r.name}</b>
                <span className="muted">{r.note}.</span>
              </div>
            </div>
            {r.next ? (
              <div className="rank-next">
                <span className="mono rank-next-row"><span>Next: <b className={`tier-name tier-${r.next.id}`}>{r.next.name}</b></span><span className="muted">{r.next.needs.join(" and ")}</span></span>
                <span className={`rank-bar tier-${r.next.id}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.next.progress * 100)} aria-label={`Progress to ${r.next.name}`}>
                  <i style={{ width: `${Math.max(2, Math.round(r.next.progress * 100))}%` }} />
                </span>
              </div>
            ) : <p className="mono muted">The top rank. Nothing above it.</p>}
            {p.progress && (
              <>
                <ProgressChart p={p.progress} />
                {p.progress.reached.length > 0 && (
                  <ul className="reached" aria-label="Ranks reached">
                    {p.progress.reached.map((x) => (
                      <li key={x.tier.key} className={`tier-chip tier-${x.tier.id}`}><TierBadge tier={x.tier} size={16} /><span>{x.tier.name}</span><span className="muted">{monthYear(x.at)}</span></li>
                    ))}
                  </ul>
                )}
                {p.progress.recent.length > 0 && (
                  <ul className="plain-list moves">
                    {p.progress.recent.map((m, i) => (
                      <li key={i} className="plain-link">
                        <span className="move-main"><span>{m.what}</span><span className="mono muted">{monthYear(m.at)} · {m.why}</span></span>
                        <span className={`mono move-n${m.n < 0 ? " neg" : ""}`}>{m.n > 0 ? "+" : "−"}{Math.abs(m.n)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {p.anonymous && <p className="ac-small">You are anonymous, so everyone else sees only your rank and totals. This record is only for you.</p>}
          </div>
        </section>
      )}

      {showSkills && (
        <section className="sec light split">
          <h2 className="title">Skills</h2>
          <div className="ac-stack">
            {p.skills.confirmed.length > 0 && (
              <div className="ac-skills-list">
                {p.skills.confirmed.map((k) => (
                  <div key={k.skill} className="ac-skill">
                    <span><b>{k.skill}</b><span className="mono">{k.score}<span className="muted"> / 100</span></span></span>
                    <span className="ac-meter" aria-hidden="true"><i style={{ width: `${k.score}%` }} /></span>
                    <span className="ac-small">{k.band} confidence · {k.why}</span>
                  </div>
                ))}
              </div>
            )}
            {p.skills.confirmed.length === 0 && <p className="ac-small">No skill confirmed yet. Skills count only when teammates or reviewers confirm them on shipped work.</p>}
            {p.skills.listedOnly.length > 0 && (
              <div className="ac-stack tight">
                <span className="mono-label">Listed, not confirmed by anyone</span>
                <ul className="chips">{p.skills.listedOnly.map((k) => <li key={k}>{k}</li>)}</ul>
              </div>
            )}
            <p className="ac-small">Scores come only from work other people confirmed. <Link href="/rules">How they are worked out</Link></p>
          </div>
        </section>
      )}

      <section className={`sec dark${tightTail ? " tight-top" : ""}`}>
        <div className="split">
          <div className="ac-stack">
            {p.clubs.length > 0 && (
              <>
                <h2 className="title-sm mono-label">Clubs (confirmed by leads)</h2>
                <ul className="plain-list">{p.clubs.map((c) => <li key={c.name} className="plain-link"><span>{c.name}</span><span className="mono muted">{c.role}</span></li>)}</ul>
              </>
            )}
          </div>
          <div className="ac-stack tight">
            <h2 className="title-sm mono-label">More in Connect</h2>
            <p className="ac-small">Project workspaces, clubs, commissions and funding are still in the Connect app.</p>
            <div className="ac-row">
              {me.member && <a className="ac-btn ghost sm" href={target("/projects").href}>Project workspace ↗</a>}
              <Link className="ac-btn ghost sm" href="/inbox">Inbox</Link>
              <Link className="ac-btn ghost sm" href="/feedback">Send feedback</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
