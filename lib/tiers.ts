/* Tiers: ranks, like in a game, that show at a glance how much verified work stands behind someone.
   A rank comes from earned credit, which only verified work gives (shipped projects, accurate reviews, vouches from
   teammates, signed-off commissions), never gifts or spending. From Gold up a tier also needs shipped projects, so the
   top ranks stand for things built, not credit collected.

   Every tier has five divisions, 1 (lowest) to 5 (highest): Bronze 1, Bronze 2 ... Bronze 5, then Silver 1. The
   divisions split a tier's credit band into five equal steps; a tier's shipped-project rule applies to all five.
   Change the levels here. */
export type Tier = { id: string; name: string; min: number; shipped: number; color: string; note: string };

export const TIERS: Tier[] = [
  { id: "rookie", name: "Rookie", min: 0, shipped: 0, color: "gray", note: "Verified and getting started" },
  { id: "bronze", name: "Bronze", min: 50, shipped: 0, color: "bronze", note: "Enough earned credit to review other people's projects" },
  { id: "silver", name: "Silver", min: 150, shipped: 0, color: "silver", note: "A steady record of verified work" },
  { id: "gold", name: "Gold", min: 300, shipped: 2, color: "gold", note: "Has shipped more than once" },
  { id: "platinum", name: "Platinum", min: 500, shipped: 3, color: "platinum", note: "A builder teams go looking for" },
  { id: "diamond", name: "Diamond", min: 800, shipped: 5, color: "diamond", note: "Ships again and again, signed by teammates and reviewers" },
  { id: "legend", name: "Legend", min: 1200, shipped: 8, color: "legend", note: "Among the most proven builders in the community" },
];

export const DIVISIONS = 5;
/* The top tier has no tier above it to divide up to, so its divisions are this many credit apart. */
const TOP_STEP = 100;

/* One division of a tier. `id` stays the tier's id (it picks the colours and the emblem), `key` names the division
   ("bronze-3"), `name` is what people read ("Bronze 3"). */
export type Rank = Tier & { key: string; division: number; tierName: string; tierIndex: number };

export const RANKS: Rank[] = TIERS.flatMap((t, ti) => {
  const next = TIERS[ti + 1];
  const step = next ? (next.min - t.min) / DIVISIONS : TOP_STEP;
  return Array.from({ length: DIVISIONS }, (_, i) => ({
    ...t, key: `${t.id}-${i + 1}`, name: `${t.name} ${i + 1}`, division: i + 1, tierName: t.name, tierIndex: ti,
    min: Math.round(t.min + i * step),
  }));
});

export type TierStatus = {
  /* The current division, e.g. Bronze 3. */
  tier: Rank;
  /* Its place in RANKS (0 = Rookie 1), and its tier's place in TIERS (0 = Rookie). */
  index: number; tierIndex: number;
  /* The next division up: Bronze 3 → Bronze 4, Bronze 5 → Silver 1. Null at Legend 5. */
  next: Rank | null;
  /* 0 to 1: how far along the way to the next division, counting both credit and shipped projects. */
  progress: number;
  /* What is still missing for the next division, in words. Empty at the top. */
  needs: string[];
};

export function tierFor(earned: number, shipped: number): TierStatus {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) if (earned >= RANKS[i].min && shipped >= RANKS[i].shipped) index = i;
  const tier = RANKS[index], next = RANKS[index + 1] ?? null;
  if (!next) return { tier, index, tierIndex: tier.tierIndex, next, progress: 1, needs: [] };
  const credit = Math.min(1, Math.max(0, (earned - tier.min) / (next.min - tier.min)));
  const ships = next.shipped > tier.shipped ? Math.min(1, Math.max(0, (shipped - tier.shipped) / (next.shipped - tier.shipped))) : 1;
  const needs: string[] = [];
  if (earned < next.min) needs.push(`${next.min - earned} more credit`);
  if (shipped < next.shipped) needs.push(`${next.shipped - shipped} more shipped project${next.shipped - shipped === 1 ? "" : "s"}`);
  return { tier, index, tierIndex: tier.tierIndex, next, progress: Math.min(credit, ships), needs };
}
