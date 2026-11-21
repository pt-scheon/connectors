/* Pure helpers for telling which college an email address belongs to, so the onboarding form can say "that is a DAU
   address" as you type. A copy of backend/lib/domains.ts (the backend decides for real when the code is checked). */

const PUBLIC = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.in", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "pm.me", "rediffmail.com", "zoho.com", "zohomail.in",
  "yandex.com", "mail.com", "gmx.com", "gmx.net", "tutanota.com", "fastmail.com", "hey.com", "duck.com", "inbox.com",
]);

export const domainOf = (email: string) => email.trim().toLowerCase().split("@")[1] ?? "";

export const isPublicMail = (domain: string) => PUBLIC.has(domain) || [...PUBLIC].some((p) => domain.endsWith("." + p));

/* Domains only real institutions can register: .edu, .ac.in, .edu.in, .ac.uk, .edu.au and the like. */
export const isAcademic = (domain: string) => /\.edu$/.test(domain) || /\.(ac|edu)\.[a-z]{2}$/.test(domain);

const onDomain = (domain: string, owned: string) => domain === owned || domain.endsWith("." + owned);

/* The college an email domain belongs to, picking the most specific match. */
export function matchCollege<T extends { domains: string[] }>(domain: string, colleges: T[]): T | undefined {
  let best: T | undefined, len = 0;
  for (const c of colleges)
    for (const d of c.domains.map((x) => x.trim().toLowerCase()).filter(Boolean))
      if (onDomain(domain, d) && d.length > len) { best = c; len = d.length; }
  return best;
}
