/* Pictures for the invented sample data: an illustrated profile picture for every sample person and a cover image
   for every sample project. Everything is drawn here, from shapes, so no photo of a real person and no outside image
   is ever used. The same person or project always gets the same picture.

     node scripts/sample-art.js [database file]          give pictures to sample people and projects that have none
     node scripts/sample-art.js [database file] --redo   draw them all again

   Only sample records are touched (people whose sign-in is "seed:" or "demo:", and their projects). The pictures are
   stored exactly like uploads (lib/files.ts: a random key in the uploads folder next to the database) and served by
   the same routes (/api/avatar/:key, /api/pimage/:key). Someone who uploads their own picture replaces it. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

/* ---------- a small seeded random generator, so a name always draws the same picture ---------- */
function rng(seedText) {
  let h = 2166136261;
  for (const c of String(seedText)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  return { next, pick: (a) => a[Math.floor(next() * a.length)], chance: (p) => next() < p, range: (lo, hi) => lo + next() * (hi - lo) };
}
const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]);
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16), ch = (x) => Math.max(0, Math.min(255, Math.round(f < 0 ? x * (1 + f) : x + (255 - x) * f)));
  return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => ch(x).toString(16).padStart(2, "0")).join("");
};

/* ---------- profile pictures ---------- */
const FEMININE = new Set(["ananya", "diya", "saanvi", "aadhya", "kavya", "ira", "myra", "meera", "priya", "riya", "neha", "sneha", "tanvi", "pooja",
  "shreya", "aditi", "nandini", "lakshmi", "divya", "swathi", "keerthana", "ritika", "simran", "harpreet", "zoya", "sana", "ankita", "bipasha",
  "hetvi", "jinal", "anushka", "khushi"]);
const SKIN = ["#f3cfa8", "#eabf91", "#ddaa78", "#cf9862", "#bf8452", "#ad7046", "#9a5f3a", "#85502f", "#e5b48a", "#c98d5b"];
const HAIR = ["#16100c", "#1f1611", "#2a1d15", "#33241a", "#3d2a1d", "#4a3322", "#1a1a1d"];
const BACKDROP = ["#ffd6a5", "#caffbf", "#9bf6ff", "#a0c4ff", "#bdb2ff", "#ffc6ff", "#fdffb6", "#ffadad", "#b8e0d2", "#f6efed", "#ffb3b3", "#d0f4de"];
const CLOTH = ["#1d3557", "#e63946", "#2a9d8f", "#f4a261", "#6d597a", "#457b9d", "#f1faee", "#222222", "#e9c46a", "#3a5a40", "#ff5a1f", "#7a2cff", "#0f4c5c"];

function portrait(seedText, name) {
  const r = rng(seedText);
  const first = String(name || "").trim().split(/\s+/)[0].toLowerCase();
  const fem = FEMININE.has(first) || (!FEMININE.has(first) && first === "tenzin" && r.chance(0.5));
  const skin = r.pick(SKIN), skinD = shade(skin, -0.16), hair = r.pick(HAIR), bg = r.pick(BACKDROP);
  let cloth = r.pick(CLOTH); if (cloth === bg) cloth = "#1d3557";
  const clothD = shade(cloth, -0.22);
  const glasses = r.chance(0.28), smileOpen = r.chance(0.45), lift = r.range(-2, 2);
  const hx = 100, hy = 92 + lift, rx = 37 + r.range(-2, 2), ry = 45 + r.range(-2, 2);
  const parts = [];
  parts.push(`<rect width="200" height="200" fill="${bg}"/>`);
  parts.push(`<circle cx="${r.range(20, 180).toFixed(0)}" cy="${r.range(10, 60).toFixed(0)}" r="${r.range(30, 60).toFixed(0)}" fill="#fff" opacity=".22"/>`);

  // Hair behind the head (long styles).
  const style = fem ? r.pick(["long", "long", "bun", "bob", "braid", "pony"]) : r.pick(["crop", "side", "curly", "quiff", "buzz", "crop", "side"]);
  if (style === "long") parts.push(`<path d="M${hx - rx - 8} ${hy - 8} C${hx - rx - 14} ${hy + 60} ${hx - rx - 10} ${hy + 92} ${hx - 48} ${hy + 100} L${hx + 48} ${hy + 100} C${hx + rx + 10} ${hy + 92} ${hx + rx + 14} ${hy + 60} ${hx + rx + 8} ${hy - 8} Z" fill="${hair}"/>`);
  if (style === "bob") parts.push(`<path d="M${hx - rx - 9} ${hy - 6} C${hx - rx - 12} ${hy + 30} ${hx - rx - 6} ${hy + 46} ${hx - rx + 6} ${hy + 48} L${hx + rx - 6} ${hy + 48} C${hx + rx + 6} ${hy + 46} ${hx + rx + 12} ${hy + 30} ${hx + rx + 9} ${hy - 6} Z" fill="${hair}"/>`);
  if (style === "braid" || style === "pony") parts.push(`<path d="M${hx - rx - 6} ${hy - 4} C${hx - rx - 8} ${hy + 30} ${hx - rx} ${hy + 40} ${hx - rx + 8} ${hy + 42} L${hx + rx - 8} ${hy + 42} C${hx + rx} ${hy + 40} ${hx + rx + 8} ${hy + 30} ${hx + rx + 6} ${hy - 4} Z" fill="${hair}"/>`);

  // Shoulders and clothes.
  const top = r.pick(["tee", "shirt", "hoodie", "tee"]);
  if (top === "hoodie") parts.push(`<path d="M52 170 C60 140 80 132 100 132 C120 132 140 140 148 170 Z" fill="${clothD}"/>`);
  parts.push(`<path d="M18 200 C22 168 48 150 78 146 L122 146 C152 150 178 168 182 200 Z" fill="${cloth}"/>`);
  // Neck.
  parts.push(`<path d="M${hx - 14} ${hy + 30} L${hx - 14} ${hy + 58} C${hx - 8} ${hy + 66} ${hx + 8} ${hy + 66} ${hx + 14} ${hy + 58} L${hx + 14} ${hy + 30} Z" fill="${skinD}"/>`);
  if (top === "tee") parts.push(`<path d="M${hx - 22} 147 C${hx - 16} 162 ${hx + 16} 162 ${hx + 22} 147" fill="none" stroke="${clothD}" stroke-width="4" stroke-linecap="round"/>`);
  if (top === "shirt") parts.push(`<path d="M${hx - 24} 146 L${hx - 4} 170 L${hx - 14} 146 Z M${hx + 24} 146 L${hx + 4} 170 L${hx + 14} 146 Z" fill="#fff" opacity=".92"/><path d="M${hx} 168 L${hx} 200" stroke="${clothD}" stroke-width="2"/>`);
  if (top === "hoodie") parts.push(`<path d="M${hx - 10} 152 L${hx - 12} 178 M${hx + 10} 152 L${hx + 12} 178" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>`);

  // Ears, head.
  parts.push(`<ellipse cx="${hx - rx + 1}" cy="${hy + 4}" rx="7" ry="11" fill="${skinD}"/><ellipse cx="${hx + rx - 1}" cy="${hy + 4}" rx="7" ry="11" fill="${skinD}"/>`);
  parts.push(`<ellipse cx="${hx}" cy="${hy}" rx="${rx}" ry="${ry}" fill="${skin}"/>`);
  if (fem && r.chance(0.5)) parts.push(`<circle cx="${hx - rx + 2}" cy="${hy + 17}" r="2.4" fill="#f5d061"/><circle cx="${hx + rx - 2}" cy="${hy + 17}" r="2.4" fill="#f5d061"/>`);

  // Hair on top of the head.
  const cap = (drop) => `M${hx - rx - 2} ${hy + drop} C${hx - rx - 6} ${hy - ry - 14} ${hx + rx + 6} ${hy - ry - 14} ${hx + rx + 2} ${hy + drop}`;
  if (style === "crop") parts.push(`<path d="${cap(-4)} C${hx + rx - 6} ${hy - 26} ${hx + 16} ${hy - 34} ${hx} ${hy - 32} C${hx - 18} ${hy - 34} ${hx - rx + 6} ${hy - 26} ${hx - rx - 2} ${hy - 4} Z" fill="${hair}"/>`);
  if (style === "buzz") parts.push(`<path d="${cap(-10)} C${hx + rx - 8} ${hy - 30} ${hx + 16} ${hy - 38} ${hx} ${hy - 37} C${hx - 16} ${hy - 38} ${hx - rx + 8} ${hy - 30} ${hx - rx - 2} ${hy - 10} Z" fill="${hair}" opacity=".78"/>`);
  if (style === "side") parts.push(`<path d="${cap(-2)} C${hx + rx - 2} ${hy - 24} ${hx + 20} ${hy - 30} ${hx - 6} ${hy - 26} C${hx - 20} ${hy - 22} ${hx - rx + 2} ${hy - 14} ${hx - rx - 2} ${hy - 2} Z" fill="${hair}"/><path d="M${hx - 12} ${hy - ry + 4} C${hx + 4} ${hy - ry - 2} ${hx + 20} ${hy - ry + 2} ${hx + 30} ${hy - 30}" stroke="${shade(hair, 0.18)}" stroke-width="2" fill="none" opacity=".6"/>`);
  if (style === "quiff") parts.push(`<path d="${cap(-4)} C${hx + rx - 6} ${hy - 26} ${hx + 16} ${hy - 32} ${hx} ${hy - 30} C${hx - 18} ${hy - 32} ${hx - rx + 6} ${hy - 26} ${hx - rx - 2} ${hy - 4} Z" fill="${hair}"/><path d="M${hx - 26} ${hy - ry + 2} C${hx - 20} ${hy - ry - 22} ${hx + 24} ${hy - ry - 24} ${hx + 30} ${hy - ry + 6} Z" fill="${hair}"/>`);
  if (style === "curly") {
    parts.push(`<path d="${cap(-6)} C${hx + rx - 6} ${hy - 28} ${hx} ${hy - 34} ${hx - rx - 2} ${hy - 6} Z" fill="${hair}"/>`);
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (1.02 + i * 0.096), cx = hx + Math.cos(a) * (rx + 2), cy = hy - 6 + Math.sin(a) * (ry - 4);
      parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(9 + r.range(-1.5, 2)).toFixed(1)}" fill="${hair}"/>`);
    }
  }
  if (fem) {
    // A centre or side parting, framing the face.
    const side = r.chance(0.5) ? 0 : r.pick([-10, 10]);
    parts.push(`<path d="${cap(10)} C${hx + rx - 2} ${hy - 14} ${hx + side + 14} ${hy - 30} ${hx + side} ${hy - ry + 6} C${hx + side - 14} ${hy - 30} ${hx - rx + 2} ${hy - 14} ${hx - rx - 2} ${hy + 10} Z" fill="${hair}"/>`);
    if (style === "bun") parts.push(`<circle cx="${hx}" cy="${hy - ry - 10}" r="16" fill="${hair}"/><path d="M${hx - 13} ${hy - ry} q13 6 26 0" stroke="${shade(hair, 0.2)}" stroke-width="2" fill="none"/>`);
    if (style === "braid") for (let i = 0; i < 4; i++) parts.push(`<ellipse cx="${hx + rx - 2 + i * 1.5}" cy="${hy + 40 + i * 13}" rx="8" ry="8.5" fill="${hair}" stroke="${shade(hair, 0.15)}" stroke-width="1"/>`);
    if (style === "pony") parts.push(`<path d="M${hx + rx - 4} ${hy - 20} C${hx + rx + 30} ${hy - 10} ${hx + rx + 18} ${hy + 40} ${hx + rx + 8} ${hy + 58} C${hx + rx + 4} ${hy + 30} ${hx + rx + 8} ${hy} ${hx + rx - 4} ${hy - 20} Z" fill="${hair}"/>`);
  }

  // Face.
  const ey = hy + 2, ex = 14 + r.range(-1, 1.5), tilt = r.range(-1.5, 1.5);
  parts.push(`<path d="M${hx - ex - 8} ${ey - 11 + tilt} q8 -5 15 -1 M${hx + ex - 7} ${ey - 12 - tilt} q7 -4 15 1" stroke="${hair}" stroke-width="3.4" stroke-linecap="round" fill="none"/>`);
  for (const sx of [-1, 1]) parts.push(`<ellipse cx="${hx + sx * ex}" cy="${ey}" rx="4.2" ry="4.9" fill="#2b1d14"/><circle cx="${hx + sx * ex + 1.4}" cy="${ey - 1.6}" r="1.3" fill="#fff"/>`);
  if (glasses) parts.push(`<g fill="none" stroke="#1b1b1f" stroke-width="2.6"><rect x="${hx - ex - 11}" y="${ey - 9}" width="22" height="17" rx="6"/><rect x="${hx + ex - 11}" y="${ey - 9}" width="22" height="17" rx="6"/><path d="M${hx - ex + 11} ${ey - 2} q${ex - 11} -5 ${2 * (ex - 11)} 0"/></g>`);
  parts.push(`<path d="M${hx - 1} ${ey + 6} q-5 11 0 14 q4 1 6 -1" stroke="${skinD}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`);
  parts.push(`<circle cx="${hx - ex - 6}" cy="${ey + 15}" r="5.5" fill="#ff7b7b" opacity=".16"/><circle cx="${hx + ex + 6}" cy="${ey + 15}" r="5.5" fill="#ff7b7b" opacity=".16"/>`);
  const my = hy + 27;
  parts.push(smileOpen
    ? `<path d="M${hx - 11} ${my} q11 12 22 0 z" fill="#7a2f2a"/><path d="M${hx - 9} ${my + 0.5} q9 4 18 0" fill="#fff" />`
    : `<path d="M${hx - 10} ${my} q10 8 20 0" stroke="#8a3c33" stroke-width="3" fill="none" stroke-linecap="round"/>`);
  if (!fem && r.chance(0.32)) {
    const full = r.chance(0.5);
    parts.push(`<path d="M${hx - rx + 2} ${hy + 6} C${hx - rx + 4} ${hy + ry + 8} ${hx + rx - 4} ${hy + ry + 8} ${hx + rx - 2} ${hy + 6} C${hx + rx - 8} ${hy + 30} ${hx + 14} ${hy + 36} ${hx} ${hy + 36} C${hx - 14} ${hy + 36} ${hx - rx + 8} ${hy + 30} ${hx - rx + 2} ${hy + 6} Z" fill="${hair}" opacity="${full ? 0.95 : 0.32}"/>`);
    parts.push(`<path d="M${hx - 12} ${my - 4} q12 -6 24 0" stroke="${hair}" stroke-width="${full ? 5 : 3}" stroke-linecap="round" fill="none" opacity="${full ? 1 : 0.5}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400" role="img" aria-label="${esc(name || "")}">${parts.join("")}</svg>`;
}

/* ---------- project covers ---------- */
const KINDS = {
  hardware: ["esp32", "embedded c", "arduino", "stm32", "pcb design", "sensors", "fpga", "verilog", "power electronics", "signal processing"],
  ml: ["pytorch", "tensorflow", "computer vision", "ml", "llms", "pandas", "ai", "data analysis"],
  mobile: ["flutter", "kotlin", "firebase"],
  web: ["react", "next.js", "node", "typescript", "django", "postgres", "go", "docker", "fastapi", "sql", "product"],
  build: ["solidworks", "ansys", "cad", "3d printing", "autocad", "revit", "staad pro", "mechanisms"],
  map: ["figma", "ui design", "gis", "illustrator", "blender", "user research"],
};
const SCHEMES = [
  ["#ff5a1f", "#ff0000", "#fff3e8"], ["#1638ff", "#7a2cff", "#eef0ff"], ["#00a676", "#1d3b16", "#e9fff4"], ["#111111", "#3a3a3a", "#ffd23f"],
  ["#7a2cff", "#ff4fa3", "#fff0fb"], ["#0f4c5c", "#2a9d8f", "#e6fbf8"], ["#e63946", "#6d1a36", "#ffeef0"], ["#f4a261", "#e76f51", "#fff6ec"],
  ["#264653", "#1d3557", "#e9f5ff"], ["#ffb3b3", "#ff5a5a", "#0f0000"],
];
const TOPICS = [
  [/\bprint/i, "print"], [/\bbus|ride|cab|auto|transport/i, "bus"], [/solar|sun|power|standby|energy|plug/i, "sun"], [/water|aqua|tank/i, "drop"], [/drone|crop|krishi|farm/i, "leaf"],
  [/\bnotes?\b|library|\bpapers?\b|granth|scholarship/i, "book"], [/\bqr\b|\bpass(es)?\b|entry|ticket|\bfest\b/i, "qr"], [/robot|robocon|line follower|pick-and-place/i, "bot"],
  [/bridge|truss|load/i, "bridge"], [/mental|health|check-in|saathi/i, "heart"], [/map|location|route|indoor/i, "pin"], [/print/i, "print"],
  [/mess|menu|canteen|food|kitchen/i, "bowl"], [/bird|biodiversity|tinyml/i, "bird"], [/sign language|handwriting|script|lipi/i, "hand"],
  [/circuit|simulat/i, "wave"], [/contest|judge|\bcod(e|ing)\b/i, "code"], [/placement|question/i, "brief"], [/\blabs?\b|equipment|oscilloscope|slot/i, "flask"],
  [/complain|hostel|\bfix|warden/i, "wrench"],
];
const ICON = {
  bus: `<rect x="-26" y="-22" width="52" height="38" rx="9"/><rect x="-20" y="-16" width="40" height="14" rx="3" fill="var(--ib)"/><circle cx="-14" cy="20" r="6"/><circle cx="14" cy="20" r="6"/>`,
  sun: `<circle r="14"/><g stroke="currentColor" stroke-width="5" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M0 -22 V-30" transform="rotate(${a})"/>`).join("")}</g>`,
  drop: `<path d="M0 -30 C14 -10 22 2 22 12 A22 22 0 0 1 -22 12 C-22 2 -14 -10 0 -30Z"/>`,
  leaf: `<path d="M-24 24 C-26 -10 0 -28 28 -28 C28 0 10 26 -24 24Z"/><path d="M-20 20 L16 -16" stroke="var(--ib)" stroke-width="4" stroke-linecap="round"/>`,
  book: `<path d="M-28 -20 Q-14 -26 0 -18 Q14 -26 28 -20 V22 Q14 16 0 24 Q-14 16 -28 22Z"/><path d="M0 -18 V24" stroke="var(--ib)" stroke-width="3"/>`,
  qr: `<rect x="-26" y="-26" width="22" height="22" rx="3"/><rect x="4" y="-26" width="22" height="22" rx="3"/><rect x="-26" y="4" width="22" height="22" rx="3"/><rect x="6" y="6" width="8" height="8"/><rect x="18" y="18" width="8" height="8"/><rect x="18" y="6" width="8" height="8"/>`,
  bot: `<rect x="-22" y="-16" width="44" height="34" rx="9"/><circle cx="-9" cy="0" r="5" fill="var(--ib)"/><circle cx="9" cy="0" r="5" fill="var(--ib)"/><path d="M0 -16 V-26" stroke="currentColor" stroke-width="4"/><circle cy="-28" r="4"/>`,
  bridge: `<path d="M-30 18 H30 M-30 18 L-15 -10 L0 18 L15 -10 L30 18 M-15 -10 H15" stroke="currentColor" stroke-width="5" fill="none" stroke-linejoin="round"/>`,
  heart: `<path d="M0 24 C-34 2 -26 -26 -6 -20 C-2 -18 0 -14 0 -12 C0 -14 2 -18 6 -20 C26 -26 34 2 0 24Z"/>`,
  pin: `<path d="M0 30 C-20 6 -22 -4 -22 -10 A22 22 0 0 1 22 -10 C22 -4 20 6 0 30Z"/><circle cy="-10" r="8" fill="var(--ib)"/>`,
  print: `<rect x="-26" y="-8" width="52" height="26" rx="5"/><rect x="-16" y="-26" width="32" height="18" fill="var(--ib)" stroke="currentColor" stroke-width="3"/><rect x="-16" y="10" width="32" height="18" fill="var(--ib)" stroke="currentColor" stroke-width="3"/>`,
  bowl: `<path d="M-30 -4 H30 A30 26 0 0 1 -30 -4Z"/><path d="M-10 -12 q-6 -8 0 -16 M4 -12 q-6 -8 0 -16" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
  bird: `<path d="M-26 6 C-18 -14 2 -18 14 -8 L28 -12 L20 0 C14 16 -6 22 -26 6Z"/><circle cx="10" cy="-6" r="2.6" fill="var(--ib)"/>`,
  hand: `<path d="M-14 26 C-24 12 -24 0 -20 -6 L-20 -20 C-20 -26 -12 -26 -12 -20 L-12 -26 C-12 -32 -4 -32 -4 -26 L-4 -28 C-4 -34 4 -34 4 -28 L4 -24 C4 -30 12 -30 12 -24 L12 2 L18 -6 C22 -10 28 -6 24 0 L10 24Z"/>`,
  code: `<path d="M-12 -20 L-30 0 L-12 20 M12 -20 L30 0 L12 20 M6 -26 L-6 26" stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  brief: `<rect x="-28" y="-14" width="56" height="38" rx="6"/><path d="M-10 -14 V-22 H10 V-14" stroke="currentColor" stroke-width="5" fill="none"/><rect x="-28" y="0" width="56" height="4" fill="var(--ib)"/>`,
  flask: `<path d="M-8 -28 H8 V-8 L24 22 C26 27 22 30 18 30 H-18 C-22 30 -26 27 -24 22 L-8 -8Z"/><path d="M-17 14 H17" stroke="var(--ib)" stroke-width="4"/>`,
  wrench: `<path d="M18 -28 A16 16 0 0 0 4 -6 L-24 22 A5 5 0 0 0 -16 30 L12 2 A16 16 0 0 0 30 -14 L20 -6 L10 -10 L8 -20Z"/>`,
  wave: `<path d="M-32 0 L-20 0 L-14 -20 L-4 22 L6 -14 L12 0 L32 0" stroke="currentColor" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
};

function kindOf(skills, r) {
  const score = Object.fromEntries(Object.keys(KINDS).map((k) => [k, 0]));
  for (const s of skills) for (const [k, list] of Object.entries(KINDS)) if (list.includes(String(s).toLowerCase())) score[k]++;
  const best = Math.max(...Object.values(score));
  const top = Object.keys(score).filter((k) => score[k] === best);
  return best ? top[Math.floor(r.next() * top.length)] : r.pick(["web", "mobile", "ml"]);
}

function scene(kind, variant, r, ink, paper, accent) {
  const g = [];
  if (kind === "hardware" && variant === 1) {
    g.push(`<g transform="translate(360 270) rotate(${r.range(-6, 6).toFixed(1)})"><rect x="-150" y="-110" width="300" height="220" rx="36" fill="${paper}"/><rect x="-150" y="-110" width="300" height="220" rx="36" fill="none" stroke="${ink}" stroke-opacity=".12" stroke-width="8"/>`);
    g.push(`<rect x="-110" y="-70" width="150" height="96" rx="14" fill="#16261d"/><path d="M-96 -10 L-74 -10 L-62 -40 L-46 10 L-32 -26 L-20 -10 L26 -10" stroke="#7cff4f" stroke-width="5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`);
    g.push(`<circle cx="92" cy="-40" r="24" fill="${accent}"/><circle cx="92" cy="-40" r="10" fill="#fff" opacity=".7"/><circle cx="92" cy="30" r="14" fill="${ink}" opacity=".7"/><rect x="-110" y="52" width="200" height="16" rx="8" fill="${ink}" opacity=".15"/>`);
    g.push(`<rect x="-20" y="110" width="40" height="80" fill="${ink}" opacity=".6"/></g>`);
    for (let i = 1; i <= 3; i++) g.push(`<path d="M${520 + i * 6} ${150 - i * 34} a${i * 40} ${i * 40} 0 0 1 0 ${i * 80}" transform="rotate(-20 520 150)" stroke="${paper}" stroke-width="9" fill="none" stroke-linecap="round" opacity="${1 - i * 0.22}"/>`);
  } else if (kind === "hardware") {
    g.push(`<g transform="translate(400 262) rotate(${r.range(-8, 8).toFixed(1)})"><rect x="-230" y="-140" width="460" height="280" rx="22" fill="#0e5a3c"/><rect x="-230" y="-140" width="460" height="280" rx="22" fill="none" stroke="#0a4029" stroke-width="10"/>`);
    for (let i = 0; i < 14; i++) {
      const y = -110 + i * 17, x1 = -210, x2 = r.range(-130, 190);
      g.push(`<path d="M${x1} ${y} H${(x2 * 0.5).toFixed(0)} L${(x2 * 0.5 + 18).toFixed(0)} ${y + 14} H${x2.toFixed(0)}" stroke="#d6b65a" stroke-width="3" fill="none" opacity=".85"/><circle cx="${x2.toFixed(0)}" cy="${y + 14}" r="4.5" fill="#d6b65a"/>`);
    }
    g.push(`<rect x="-62" y="-62" width="124" height="124" rx="10" fill="#1b1b1f"/><rect x="-46" y="-46" width="92" height="92" rx="6" fill="#2b2b31"/>`);
    for (let i = 0; i < 8; i++) for (const side of [-1, 1]) g.push(`<rect x="${side * 66 - (side < 0 ? 10 : 0)}" y="${-52 + i * 14}" width="10" height="6" fill="#c9c9cf"/><rect y="${side * 66 - (side < 0 ? 10 : 0)}" x="${-52 + i * 14}" width="6" height="10" fill="#c9c9cf"/>`);
    g.push(`<circle cx="160" cy="-96" r="9" fill="${accent}"/><circle cx="160" cy="-96" r="20" fill="${accent}" opacity=".3"/><circle cx="-170" cy="96" r="7" fill="#7cff4f"/><circle cx="-170" cy="96" r="16" fill="#7cff4f" opacity=".3"/>`);
    g.push(`<rect x="110" y="40" width="80" height="60" rx="6" fill="#20232a"/><rect x="118" y="48" width="64" height="44" rx="3" fill="#3a3f4b"/></g>`);
  } else if (kind === "ml" && variant === 1) {
    g.push(`<g transform="translate(400 255) rotate(${r.range(-5, 5).toFixed(1)})"><rect x="-260" y="-170" width="520" height="340" rx="22" fill="${paper}"/><path d="M-220 130 H230 M-220 130 V-140" stroke="${ink}" stroke-opacity=".35" stroke-width="4"/>`);
    const centres = [[-120, 50, accent], [40, -60, ink], [150, 60, "#ff4fa3"]];
    for (const [cx, cy, col] of centres) for (let i = 0; i < 22; i++) {
      const a = r.range(0, Math.PI * 2), d = Math.abs(r.range(0, 1) + r.range(0, 1) - 1) * 70;
      g.push(`<circle cx="${(cx + Math.cos(a) * d).toFixed(0)}" cy="${(cy + Math.sin(a) * d * 0.8).toFixed(0)}" r="7" fill="${col}" opacity=".8"/>`);
    }
    g.push(`<path d="M-200 110 C-80 40 20 20 210 -130" stroke="${ink}" stroke-width="5" stroke-dasharray="14 10" fill="none" opacity=".6"/></g>`);
  } else if (kind === "ml") {
    const layers = [3, 5, 5, 2], xs = [190, 330, 470, 610];
    const pos = layers.map((n, li) => Array.from({ length: n }, (_, i) => [xs[li], 250 + (i - (n - 1) / 2) * 62]));
    for (let li = 0; li < pos.length - 1; li++) for (const a of pos[li]) for (const b of pos[li + 1])
      g.push(`<path d="M${a[0]} ${a[1]} L${b[0]} ${b[1]}" stroke="${paper}" stroke-width="${r.range(1, 3.4).toFixed(1)}" opacity="${r.range(0.25, 0.7).toFixed(2)}"/>`);
    pos.flat().forEach(([x, y], i) => g.push(`<circle cx="${x}" cy="${y}" r="22" fill="${i % 3 === 0 ? accent : paper}"/><circle cx="${x}" cy="${y}" r="9" fill="${ink}" opacity=".35"/>`));
    g.push(`<g transform="translate(600 92)"><rect x="-80" y="-44" width="170" height="88" rx="14" fill="${paper}" opacity=".95"/>`);
    for (let i = 0; i < 7; i++) { const h = r.range(14, 60); g.push(`<rect x="${-62 + i * 20}" y="${30 - h}" width="12" height="${h.toFixed(0)}" rx="3" fill="${i === 5 ? accent : ink}" opacity=".85"/>`); }
    g.push(`</g>`);
  } else if (kind === "mobile") {
    g.push(`<g transform="translate(400 262) rotate(${r.range(-10, 10).toFixed(1)})"><rect x="-120" y="-230" width="240" height="470" rx="38" fill="#111"/><rect x="-108" y="-216" width="216" height="442" rx="28" fill="${paper}"/><rect x="-36" y="-206" width="72" height="18" rx="9" fill="#111"/>`);
    g.push(`<rect x="-92" y="-170" width="184" height="96" rx="16" fill="${accent}"/><circle cx="-60" cy="-140" r="16" fill="#fff" opacity=".8"/><rect x="-34" y="-150" width="100" height="12" rx="6" fill="#fff" opacity=".8"/><rect x="-34" y="-130" width="66" height="10" rx="5" fill="#fff" opacity=".55"/>`);
    for (let i = 0; i < 4; i++) g.push(`<rect x="-92" y="${-58 + i * 62}" width="184" height="50" rx="12" fill="${ink}" opacity="${0.08 + (i % 2) * 0.05}"/><circle cx="-66" cy="${-33 + i * 62}" r="13" fill="${ink}" opacity=".35"/><rect x="-44" y="${-42 + i * 62}" width="${r.range(60, 120).toFixed(0)}" height="9" rx="4.5" fill="${ink}" opacity=".5"/><rect x="-44" y="${-27 + i * 62}" width="${r.range(40, 90).toFixed(0)}" height="8" rx="4" fill="${ink}" opacity=".25"/>`);
    g.push(`<rect x="-50" y="198" width="100" height="6" rx="3" fill="#111" opacity=".5"/></g>`);
  } else if (kind === "web" && variant === 1) {
    // A task board: three columns of cards.
    g.push(`<g transform="translate(400 262) rotate(${r.range(-5, 5).toFixed(1)})"><rect x="-290" y="-180" width="580" height="360" rx="18" fill="${paper}"/><rect x="-290" y="-180" width="580" height="44" rx="18" fill="${ink}" opacity=".12"/>`);
    g.push(`<circle cx="-262" cy="-158" r="7" fill="#ff5f57"/><circle cx="-240" cy="-158" r="7" fill="#febc2e"/><circle cx="-218" cy="-158" r="7" fill="#28c840"/>`);
    for (let c = 0; c < 3; c++) {
      const x = -268 + c * 182;
      g.push(`<rect x="${x}" y="-118" width="172" height="282" rx="14" fill="${ink}" opacity=".07"/><rect x="${x + 14}" y="-104" width="${r.range(50, 90).toFixed(0)}" height="11" rx="5.5" fill="${ink}" opacity=".55"/>`);
      const n = 2 + Math.floor(r.next() * 3);
      for (let i = 0; i < n; i++) g.push(`<rect x="${x + 10}" y="${-80 + i * 60}" width="152" height="50" rx="10" fill="${c === 1 && i === 0 ? accent : "#fff"}"/><rect x="${x + 22}" y="${-68 + i * 60}" width="${r.range(60, 110).toFixed(0)}" height="9" rx="4.5" fill="${ink}" opacity=".55"/><circle cx="${x + 146}" cy="${-46 + i * 60}" r="8" fill="${ink}" opacity=".3"/><rect x="${x + 22}" y="${-52 + i * 60}" width="34" height="8" rx="4" fill="${ink}" opacity=".2"/>`);
    }
    g.push(`</g>`);
  } else if (kind === "web" && variant === 2) {
    // A landing page with a hero, a button and a row of people.
    g.push(`<g transform="translate(400 262) rotate(${r.range(-5, 5).toFixed(1)})"><rect x="-290" y="-180" width="580" height="360" rx="18" fill="${paper}"/><rect x="-290" y="-180" width="580" height="44" rx="18" fill="${ink}" opacity=".12"/>`);
    g.push(`<circle cx="-262" cy="-158" r="7" fill="#ff5f57"/><circle cx="-240" cy="-158" r="7" fill="#febc2e"/><circle cx="-218" cy="-158" r="7" fill="#28c840"/>`);
    g.push(`<rect x="-250" y="-104" width="260" height="26" rx="13" fill="${ink}" opacity=".8"/><rect x="-250" y="-66" width="200" height="26" rx="13" fill="${ink}" opacity=".8"/><rect x="-250" y="-22" width="230" height="12" rx="6" fill="${ink}" opacity=".3"/><rect x="-250" y="-2" width="180" height="12" rx="6" fill="${ink}" opacity=".3"/>`);
    g.push(`<rect x="-250" y="34" width="120" height="40" rx="20" fill="${accent}"/><rect x="-118" y="34" width="110" height="40" rx="20" fill="none" stroke="${ink}" stroke-opacity=".4" stroke-width="3"/>`);
    g.push(`<rect x="40" y="-110" width="220" height="200" rx="22" fill="${accent}" opacity=".9"/><circle cx="150" cy="-10" r="62" fill="#fff" opacity=".85"/><path d="M118 -10 l22 22 l44 -48" stroke="${ink}" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    for (let i = 0; i < 5; i++) g.push(`<circle cx="${-236 + i * 28}" cy="122" r="17" fill="${[accent, ink, "#ffb3b3", "#4fd1ff", "#7cff4f"][i]}" stroke="${paper}" stroke-width="4" opacity=".95"/>`);
    g.push(`<rect x="-90" y="114" width="120" height="14" rx="7" fill="${ink}" opacity=".3"/></g>`);
  } else if (kind === "web") {
    g.push(`<g transform="translate(400 262) rotate(${r.range(-5, 5).toFixed(1)})"><rect x="-290" y="-180" width="580" height="360" rx="18" fill="${paper}"/><rect x="-290" y="-180" width="580" height="44" rx="18" fill="${ink}" opacity=".12"/>`);
    g.push(`<circle cx="-262" cy="-158" r="7" fill="#ff5f57"/><circle cx="-240" cy="-158" r="7" fill="#febc2e"/><circle cx="-218" cy="-158" r="7" fill="#28c840"/><rect x="-180" y="-168" width="300" height="20" rx="10" fill="${paper}"/>`);
    g.push(`<rect x="-262" y="-114" width="150" height="270" rx="12" fill="${ink}" opacity=".08"/>`);
    for (let i = 0; i < 6; i++) g.push(`<rect x="-246" y="${-96 + i * 38}" width="${r.range(70, 118).toFixed(0)}" height="12" rx="6" fill="${ink}" opacity="${i === 1 ? 0.75 : 0.3}"/>`);
    g.push(`<rect x="-92" y="-114" width="358" height="118" rx="14" fill="${accent}"/>`);
    let d = "M-74 -24"; for (let i = 1; i <= 8; i++) d += ` L${-74 + i * 40} ${(-30 - r.range(0, 60) - i * 4).toFixed(0)}`;
    g.push(`<path d="${d}" stroke="#fff" stroke-width="5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`);
    for (let i = 0; i < 3; i++) g.push(`<rect x="${-92 + i * 124}" y="22" width="110" height="134" rx="14" fill="${ink}" opacity=".1"/><circle cx="${-62 + i * 124}" cy="56" r="16" fill="${i === 1 ? accent : ink}" opacity=".6"/><rect x="${-78 + i * 124}" y="90" width="80" height="10" rx="5" fill="${ink}" opacity=".45"/><rect x="${-78 + i * 124}" y="110" width="56" height="9" rx="4.5" fill="${ink}" opacity=".25"/>`);
    g.push(`</g>`);
  } else if (kind === "build") {
    const gear = (cx, cy, R, teeth, fill, rot) => {
      let d = "";
      for (let i = 0; i < teeth * 2; i++) {
        const a1 = (i / (teeth * 2)) * Math.PI * 2, a2 = ((i + 1) / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? R : R + R * 0.16;
        d += `${i ? "L" : "M"}${(cx + Math.cos(a1) * rr).toFixed(1)} ${(cy + Math.sin(a1) * rr).toFixed(1)} L${(cx + Math.cos(a2) * rr).toFixed(1)} ${(cy + Math.sin(a2) * rr).toFixed(1)} `;
      }
      return `<g transform="rotate(${rot} ${cx} ${cy})"><path d="${d}Z" fill="${fill}"/><circle cx="${cx}" cy="${cy}" r="${R * 0.38}" fill="${ink}" opacity=".55"/></g>`;
    };
    g.push(gear(300, 250, 120, 12, paper, r.range(0, 30).toFixed(0)), gear(486, 180, 70, 9, accent, r.range(0, 30).toFixed(0)), gear(520, 360, 58, 8, paper, r.range(0, 30).toFixed(0)));
    g.push(`<path d="M120 460 H700 M140 460 L230 400 L320 460 L410 400 L500 460 L590 400 L680 460 M230 400 H590" stroke="${paper}" stroke-width="7" fill="none" opacity=".55" stroke-linejoin="round"/>`);
  } else {
    // A map: blocks, a route and pins.
    g.push(`<g transform="translate(400 262) rotate(${r.range(-6, 6).toFixed(1)})"><rect x="-300" y="-190" width="600" height="380" rx="20" fill="${paper}"/>`);
    for (let i = 0; i < 18; i++) g.push(`<rect x="${(-280 + (i % 6) * 95 + r.range(0, 10)).toFixed(0)}" y="${(-170 + Math.floor(i / 6) * 120 + r.range(0, 10)).toFixed(0)}" width="${r.range(55, 80).toFixed(0)}" height="${r.range(70, 96).toFixed(0)}" rx="8" fill="${ink}" opacity="${r.range(0.06, 0.16).toFixed(2)}"/>`);
    g.push(`<path d="M-250 140 C-150 60 -120 120 -40 30 S110 -30 160 -110 S250 -120 270 -160" stroke="${accent}" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="2 22"/>`);
    g.push(`<path d="M-250 140 C-150 60 -120 120 -40 30 S110 -30 160 -110 S250 -120 270 -160" stroke="${accent}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".5"/>`);
    for (const [x, y] of [[-250, 140], [160, -110]]) g.push(`<g transform="translate(${x} ${y - 30})"><path d="M0 30 C-16 10 -18 2 -18 -4 A18 18 0 0 1 18 -4 C18 2 16 10 0 30Z" fill="${ink}"/><circle cy="-4" r="7" fill="${paper}"/></g>`);
    g.push(`</g>`);
  }
  return g.join("");
}

function cover(seedText, p) {
  const r = rng(seedText);
  const [c1, c2, c3] = SCHEMES[Math.abs(Number(p.id) * 7 + Math.floor(r.next() * 3)) % SCHEMES.length];
  let kind = kindOf(p.skills || [], r);
  const variant = Math.floor(r.next() * 3) % (kind === "web" ? 3 : 2);
  const dark = c3 === "#0f0000";
  const ink = dark ? "#0f0000" : "#15131a", paper = dark ? "#fff7f5" : c3, accent = r.pick(["#ffd23f", "#ff5a1f", "#7cff4f", "#ff4fa3", "#4fd1ff"]);
  const text = `${p.name} ${p.pitch || ""}`;
  const topic = (TOPICS.find(([re]) => re.test(text)) || [null, r.pick(["code", "wave", "pin"])])[1];
  if (!(p.skills || []).length) kind = { bot: "build", bridge: "build", leaf: "hardware", pin: "map", heart: "mobile", bird: "ml", hand: "ml" }[topic] || kind;
  const id = `g${Math.abs(Number(p.id) || 0)}`;
  const blobs = Array.from({ length: 3 }, () => `<circle cx="${r.range(0, 800).toFixed(0)}" cy="${r.range(0, 500).toFixed(0)}" r="${r.range(120, 260).toFixed(0)}" fill="#fff" opacity="${r.range(0.05, 0.12).toFixed(2)}"/>`).join("");
  const dots = Array.from({ length: 24 }, () => `<circle cx="${r.range(0, 800).toFixed(0)}" cy="${r.range(0, 500).toFixed(0)}" r="${r.range(1.5, 3.5).toFixed(1)}" fill="#fff" opacity=".35"/>`).join("");
  const ix = r.chance(0.5) ? 96 : 704, iy = r.chance(0.5) ? 96 : 404;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="1600" height="1000" role="img" aria-label="${esc(p.name)}">`
    + `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`
    + `<filter id="${id}s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity=".28"/></filter></defs>`
    + `<rect width="800" height="500" fill="url(#${id})"/>${blobs}${dots}`
    + `<g filter="url(#${id}s)">${scene(kind, variant, r, ink, paper, accent)}</g>`
    + `<g transform="translate(${ix} ${iy})" filter="url(#${id}s)" style="--ib:${c1}"><circle r="56" fill="${paper}"/><g transform="scale(1.15)" fill="${ink}" color="${ink}">${ICON[topic].replace(/var\(--ib\)/g, paper)}</g></g>`
    + `</svg>`;
}

/* ---------- storing them like uploads ---------- */
function uploadDirFor(dbFile) { return path.join(path.dirname(path.resolve(dbFile)), "uploads"); }
function store(dir, svg) {
  const key = crypto.randomBytes(18).toString("base64url");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, key), svg, { flag: "wx" });
  return key;
}

const SAMPLE_PEOPLE = "(sub LIKE 'seed:%' OR sub LIKE 'demo:%')";

/* Gives every sample person and every sample project a picture. `redo` draws them all again. */
function fill(db, dbFile, { redo = false } = {}) {
  const dir = uploadDirFor(dbFile);
  const drop = (key) => { if (key && /^[A-Za-z0-9_-]{24}$/.test(key)) fs.rmSync(path.join(dir, key), { force: true }); };
  const people = db.prepare(`SELECT id, sub, name, anon, photo_key FROM users WHERE ${SAMPLE_PEOPLE} ${redo ? "" : "AND photo_key IS NULL"}`).all();
  const projects = db.prepare(`SELECT p.id, p.name, p.pitch, p.image_key FROM projects p JOIN users u ON u.id=p.lead_id
    WHERE ${SAMPLE_PEOPLE.replace(/sub/g, "u.sub")} ${redo ? "" : "AND p.image_key IS NULL"}`).all();
  const skillsOf = db.prepare("SELECT skill FROM project_skills WHERE project_id=?");
  // As an upload does (app/api/me/photo/route.ts + lib/identity.ts setPhoto): the key, and the picture people see.
  const setPhoto = db.prepare("UPDATE users SET photo_key=?, photo_mime='image/svg+xml', picture=? WHERE id=?");
  const setHidden = db.prepare("UPDATE users SET photo_key=?, photo_mime='image/svg+xml', real_picture=? WHERE id=?");
  const setImage = db.prepare("UPDATE projects SET image_key=?, image_mime='image/svg+xml' WHERE id=?");
  db.transaction(() => {
    for (const u of people) {
      if (redo) drop(u.photo_key);
      const key = store(dir, portrait(u.sub, u.name));
      (u.anon ? setHidden : setPhoto).run(key, `/api/avatar/${key}`, u.id);
    }
    for (const p of projects) {
      if (redo) drop(p.image_key);
      setImage.run(store(dir, cover(`${p.name}:${p.id}`, { ...p, skills: skillsOf.all(p.id).map((s) => s.skill) })), p.id);
    }
  })();
  return { people: people.length, projects: projects.length };
}

module.exports = { portrait, cover, fill };

if (require.main === module) {
  const Database = require("better-sqlite3");
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--")) || process.env.DATABASE_PATH || "./data/connect.db";
  const db = new Database(file, { timeout: 30000 });
  const n = fill(db, file, { redo: args.includes("--redo") });
  console.log(`Drew ${n.people} profile pictures and ${n.projects} project images.`);
}
