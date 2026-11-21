import type { CollegeRef, Progress, Rank } from "./api";

/* What the signed-in pages read and send. These mirror the backend's JSON (backend/lib/account.ts and
   app/api/account/*); the browser asks for them with Connect's sign-in cookie (components/session.tsx), never the server. */

export type Person = { id: number; name: string; picture: string | null; branch: string };

/* The result of an action (sign in, save, send...). `to` is a path on Connect that the action would have gone to;
   lib/paths.ts maps it to the page of the same purpose on this site. */
export type Outcome = { ok: true; message: string; to: string } | { ok: false; error: string; to: string };

export type SignInOptions = {
  providers: { key: string; label: string; ready: boolean }[];
  dev: boolean; demo: boolean;
  people: { id: number; name: string; picture: string | null; college: string | null; role: string; branch: string; admin: boolean }[];
};

export type VerifyState = { pending: false } | { pending: true; to: string; minutes: number; trustDays: number };

export type Stage = "profile" | "prove" | "checking" | "alum-waiting" | "done";
export type Onboarding = {
  stage: Stage; onboarded: boolean; role: string; starter: number;
  me: { name: string; firstName: string; branch: string; gradYear: number | null; skills: string; about: string; github: string; linkedin: string; website: string };
  colleges: { id: number; slug: string; name: string; domains: string[] }[];
  college: { name: string; slug: string; status: string; domains: string[] } | null;
  signInProof: { email: string; domain: string; college: string | null; academic: boolean } | null;
  googleOn: boolean;
  mail: "ready" | "off" | "dev-code";
  pending: { email: string; devCode: string | null } | null;
};

export type Profile = {
  id: number; name: string; picture: string | null; avatar: string | null; anonymous: boolean; realName: string | null;
  role: string; verified: boolean; onboarded: boolean;
  branch: string; classOf: number | null; about: string; github: string; linkedin: string; website: string; openToJoin: boolean;
  college: CollegeRef | null; collegeDomain: string | null; signIns: string[];
  rank: Rank | null;
  credit: { earned: number; spendable: number; shipped: number; joined: number; building: number; left: number };
  credibility: number | null;
  alerts: { left: number; joined: number; circle: boolean; circleWith: number; ring: boolean };
  skills: { confirmed: { skill: string; score: number; band: string; why: string }[]; listedOnly: string[] };
  projects: { id: number; name: string; pitch: string; status: string; private: boolean; shippedAt: string | null; role: string; did: string }[];
  clubs: { name: string; role: string }[];
  progress: Progress | null;
};

export type Settings = {
  name: string; picture: string | null; avatar: string | null; hasOwnPhoto: boolean; anonymous: boolean; realName: string | null; anonSince: string | null;
  role: string; member: boolean; email: string | null;
  emailNotes: boolean; followNotes: boolean; openToJoin: boolean; callsOn: boolean; dmFrom: "all" | "team";
  twoStep: boolean; twoStepAvailable: boolean; twoStepAddress: string | null; trustDays: number;
  mailReady: boolean; emailTo: string | null;
  signIns: string[]; lastSignIn: { at: string | null; device: string | null } | null;
  blocked: Person[];
};

export type InboxItem = { id: number; text: string; href: string; at: string | null; unseen: boolean; isNew: boolean; group: string };
export type Inbox = { items: InboxItem[]; newCount: number };

export type Conversation = { user: Person; unread: number; last: { mine: boolean; preview: string; at: string | null } };
export type MessageList = { conversations: Conversation[]; people: Person[] };
export type Msg = {
  id: number; mine: boolean; text: string; kind: string; project_id: number | null; project_name: string | null; created_at: number; seen: boolean;
  file: { key: string; name: string; type: string; size: number; w: number | null; h: number | null; secs: number | null } | null;
};
export type Thread = { other: Person; messages: Msg[]; seenUpTo: number; canSend: boolean; reason: string; iBlocked: boolean };

export type FeedbackData = {
  kinds: { id: string; label: string }[];
  mine: { id: number; kind: string; kindLabel: string; status: string; statusLabel: string; statusTone: string; text: string; reply: string | null; at: string | null }[];
};

export type RulesDoc = { sections: { title: string; intro: string; rules: { title: string; text: string }[] }[] };
