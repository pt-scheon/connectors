import { SECTIONS } from "@/app/rule-list";
import { json, preflight } from "@/lib/public-http";

/* How credit, skills and credibility are worked out, as plain text for the showcase's rules page. It is the same list
   Connect's own /rules page draws, and every number in it is read from lib/rules.ts, so the two cannot drift apart. */
export function GET() {
  return json({ sections: SECTIONS.map((s) => ({ title: s.title, intro: s.intro, rules: s.rules.map(([title, text]) => ({ title, text })) })) });
}

export const OPTIONS = preflight;
