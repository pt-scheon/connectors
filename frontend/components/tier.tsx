import type { TierRef } from "@/lib/api";

/* The rank badge: a shield in the tier's colour with a mark that grows with the tier (a dot, one to three chevrons,
   a star, a diamond, a crown), so badges can be told apart without colour too. The division (Bronze 1 to Bronze 5)
   lights that many of the five pips along the foot of the shield. */
const MARK: Record<string, React.ReactNode> = {
  rookie: <circle cx="16" cy="17" r="3" />,
  bronze: <path d="M10.5 15.5 16 20l5.5-4.5" fill="none" strokeWidth="2.6" />,
  silver: <path d="M10.5 12.5 16 17l5.5-4.5M10.5 17.5 16 22l5.5-4.5" fill="none" strokeWidth="2.4" />,
  gold: <path d="M10.5 10.5 16 15l5.5-4.5M10.5 15 16 19.5l5.5-4.5M10.5 19.5 16 24l5.5-4.5" fill="none" strokeWidth="2.2" />,
  platinum: <path d="m16 9.5 2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z" />,
  diamond: <path d="M11.5 12.5h9l3 3.5-7.5 8-7.5-8zM11.5 12.5 16 24M20.5 12.5 16 24M8.5 16h15" strokeWidth="1.4" strokeLinejoin="round" />,
  legend: <path d="m9.5 21.5-1-9 4.2 3.4L16 10l3.3 5.9 4.2-3.4-1 9z" strokeLinejoin="round" />,
};

/* Five pips along the foot of the shield: lit up to the division (Bronze 3 = three lit). */
const PIPS = [0, 1, 2, 3, 4].map((i) => ({ cx: 16 + (i - 2) * 2.75, cy: 26.9 - 0.2 * (i - 2) ** 2 }));

function Emblem({ id, division }: { id: string; division?: number }) {
  return (
    <>
      <path className="tb-back" d="M16 1.5 29 6v11.5c0 8.4-5.6 14.4-13 17-7.4-2.6-13-8.6-13-17V6z" />
      <path className="tb-face" d="M16 4.6 26.2 8.2v9.3c0 6.8-4.4 11.7-10.2 14-5.8-2.3-10.2-7.2-10.2-14V8.2z" />
      {division ? (
        <>
          <g className="tb-mark" stroke="currentColor" strokeLinecap="round" transform="translate(16 15.3) scale(.8) translate(-16 -17)">{MARK[id]}</g>
          {PIPS.map((p, i) => <circle key={i} className={i < division ? "tb-pip on" : "tb-pip"} cx={p.cx} cy={p.cy} r="1.2" />)}
        </>
      ) : <g className="tb-mark" stroke="currentColor" strokeLinecap="round">{MARK[id]}</g>}
    </>
  );
}

export function TierBadge({ tier, size = 20, title }: { tier: Pick<TierRef, "id" | "name"> & { division?: number }; size?: number; title?: boolean }) {
  return (
    <svg className={`tier-badge tier-${tier.id}`} width={size} height={size * 1.12} viewBox="0 0 32 36"
      {...(title ? { role: "img", "aria-label": `${tier.name} rank` } : { "aria-hidden": true })}>
      <Emblem id={tier.id} division={tier.division} />
    </svg>
  );
}

/* Badge and name together, as on a Connect profile. */
export function TierChip({ tier, className = "" }: { tier: TierRef; className?: string }) {
  return (
    <span className={`tier-chip tier-${tier.id} ${className}`} title={`${tier.name}: ${tier.note}`}>
      <TierBadge tier={tier} size={16} /><span>{tier.name}</span>
    </span>
  );
}
