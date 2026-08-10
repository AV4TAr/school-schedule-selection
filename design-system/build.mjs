/**
 * Builds the Claude Design preview pages.
 *
 * Every page inlines `src/styles/tokens.css` and `src/styles/components.css`
 * verbatim — the exact files the app ships — so a preview can never drift from
 * what the product actually renders. Edit the tokens, rebuild, and both move.
 *
 *   node design-system/build.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(here, "..");
const outDir = path.join(here, "dist");

const tokens = fs.readFileSync(path.join(repo, "src/styles/tokens.css"), "utf8");
const primitives = fs.readFileSync(path.join(repo, "src/styles/components.css"), "utf8");

/** Chrome for the preview canvas itself; layered above the shared primitives. */
const shell = `
@layer components, preview;
@layer preview {
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    background: var(--c-bg);
    color: var(--c-text);
    font-family: var(--t-sans);
    font-size: var(--t-base);
    -webkit-font-smoothing: antialiased;
  }
  h1 { font-size: var(--t-lg); font-weight: 600; letter-spacing: var(--t-tight); margin: 0 0 2px; }
  .note { color: var(--c-text-2); font-size: var(--t-xs); margin: 0 0 20px; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
  .col { display: flex; flex-direction: column; gap: 10px; }
  .stack { display: flex; flex-direction: column; gap: 22px; }
  .group-label {
    font-size: var(--t-2xs); font-weight: 600; text-transform: uppercase;
    letter-spacing: .05em; color: var(--c-text-3); margin-bottom: 8px;
  }
  table { border-collapse: collapse; width: 100%; }
  .swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 10px; }
  .swatch { border: 1px solid var(--c-line); border-radius: var(--r-md); overflow: hidden; background: var(--c-surface); }
  .swatch .chip-area { height: 46px; }
  .swatch .meta { padding: 6px 8px; border-top: 1px solid var(--c-line); }
  .swatch .name { font-size: var(--t-2xs); font-weight: 600; }
  .swatch .val { font-size: var(--t-2xs); color: var(--c-text-3); font-family: var(--t-mono); }
}
`;

function page({ title, note, body }) {
  return `<!DOCTYPE html>
<!-- Previews follow the viewer's system theme; the app itself defaults to light. -->
<html lang="en" data-theme="system">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${tokens}${primitives}${shell}</style>
</head>
<body>
<h1>${title}</h1>
<p class="note">${note}</p>
${body}
</body>
</html>`;
}

const swatch = (name, varName) => `
  <div class="swatch">
    <div class="chip-area" style="background: var(${varName})"></div>
    <div class="meta"><div class="name">${name}</div><div class="val">${varName}</div></div>
  </div>`;

const PEOPLE = [
  ["Noriko", 1],
  ["Heather", 2],
  ["Teresa", 3],
  ["Jeanette", 4],
];

const chip = (name, hue, pinned = false) => `
  <button class="chip" data-person="${hue}" data-pinned="${pinned}">
    <span class="chip-dot"></span><span>${name}</span>${pinned ? '<span style="margin-left:auto">🔒</span>' : ""}
  </button>`;

/** A staffing cell exactly as the schedule grid renders it. */
function cell(names, state) {
  const border =
    state === "critical"
      ? "border-left-color: var(--c-danger); background: color-mix(in srgb, var(--c-danger-soft) 45%, transparent);"
      : state === "warn"
        ? "border-left-color: var(--c-warn); background: color-mix(in srgb, var(--c-warn-soft) 40%, transparent);"
        : "border-left-color: transparent;";
  const pill =
    state === "critical"
      ? '<span class="pill pill-danger num" style="align-self:flex-start;margin-top:2px">2/3</span>'
      : state === "warn"
        ? '<span class="pill pill-warn num" style="align-self:flex-start;margin-top:2px">1/2</span>'
        : "";
  return `<td style="padding:6px;vertical-align:top">
    <div style="display:flex;flex-direction:column;gap:2px;border-left:2px solid;border-radius:var(--r-md);padding:4px 4px 4px 6px;${border}">
      ${names.map(([n, h]) => chip(n, h)).join("")}${pill}
    </div></td>`;
}

const COMPONENTS = [
  {
    slug: "foundations/colors",
    group: "Foundations",
    name: "Colour",
    subtitle: "Surfaces, text, accent, semantic states, person hues",
    viewport: { width: 900, height: 700 },
    title: "Colour",
    note: "Every value is a CSS custom property, declared once with light-dark(). This card follows your system theme; the app defaults to light with a toggle.",
    body: `<div class="stack">
      <div><div class="group-label">Surfaces</div><div class="swatches">
        ${swatch("Background", "--c-bg")}${swatch("Surface", "--c-surface")}${swatch("Raised", "--c-raised")}${swatch("Line", "--c-line")}${swatch("Line strong", "--c-line-strong")}
      </div></div>
      <div><div class="group-label">Accent</div><div class="swatches">
        ${swatch("Accent", "--c-accent")}${swatch("Hover", "--c-accent-hover")}${swatch("Soft", "--c-accent-soft")}${swatch("Line", "--c-accent-line")}
      </div></div>
      <div><div class="group-label">State</div><div class="swatches">
        ${swatch("OK", "--c-ok")}${swatch("OK soft", "--c-ok-soft")}${swatch("Warn", "--c-warn")}${swatch("Warn soft", "--c-warn-soft")}${swatch("Danger", "--c-danger")}${swatch("Danger soft", "--c-danger-soft")}
      </div></div>
      <div><div class="group-label">Person hues — assigned by roster position, stable across the app</div><div class="swatches">
        ${[1, 2, 3, 4, 5, 6].map((i) => swatch(`Person ${i}`, `--c-p${i}`)).join("")}
      </div></div>
    </div>`,
  },
  {
    slug: "foundations/type",
    group: "Foundations",
    name: "Typography",
    subtitle: "Six sizes, tabular numerals for all times",
    viewport: { width: 760, height: 520 },
    title: "Typography",
    note: "One sans stack. Times, hours and counts use .num for tabular figures so columns line up.",
    body: `<div class="stack">
      <div class="col">
        <div class="page-title">Weekly schedule — page title</div>
        <div class="section-title">Weekly hours — section title</div>
        <div style="font-size:var(--t-base)">Body — controls and prose (14px)</div>
        <div style="font-size:var(--t-sm)">Small — table body, the workhorse (13px)</div>
        <div style="font-size:var(--t-xs);color:var(--c-text-2)">Extra small — captions and hints (12px)</div>
        <div style="font-size:var(--t-2xs);color:var(--c-text-3)">2XS — pills and meta (11px)</div>
        <div class="label">Label — uppercase field caption</div>
      </div>
      <div>
        <div class="group-label">Tabular numerals</div>
        <div class="num" style="font-size:var(--t-sm);line-height:1.6">
          8:00 – 8:45 AM<br>10:05 – 11:40 AM<br>11:40 AM – 1:15 PM<br>13.5 h · 7.92 h · 6.08 h
        </div>
      </div>
    </div>`,
  },
  {
    slug: "components/buttons",
    group: "Components",
    name: "Buttons",
    subtitle: "Primary, default, ghost, danger, small",
    viewport: { width: 700, height: 300 },
    title: "Buttons",
    note: "Borders and a one-pixel shadow do the work; elevation stays restrained.",
    body: `<div class="stack">
      <div><div class="group-label">Variants</div><div class="row">
        <button class="btn btn-primary">Generate schedule</button>
        <button class="btn">Print view</button>
        <button class="btn btn-ghost">Cancel</button>
        <button class="btn btn-ghost btn-danger">Remove person</button>
        <button class="btn" disabled>Disabled</button>
      </div></div>
      <div><div class="group-label">Small</div><div class="row">
        <button class="btn btn-sm">+ Add shift</button>
        <button class="btn btn-sm btn-primary">Save</button>
        <button class="btn btn-ghost btn-danger btn-sm">✕</button>
      </div></div>
      <div><div class="group-label">With a count</div><div class="row">
        <button class="btn">Clear all locks <span class="pill">3</span></button>
      </div></div>
    </div>`,
  },
  {
    slug: "components/fields",
    group: "Components",
    name: "Form fields",
    subtitle: "Text, time, number, select, checkbox",
    viewport: { width: 720, height: 330 },
    title: "Form fields",
    note: "One .field class across every input type, so a row of mixed controls lines up.",
    body: `<div class="stack">
      <div class="row" style="align-items:flex-end">
        <div style="width:176px"><label class="label">Name</label><input class="field" value="Arrival"></div>
        <div style="width:104px"><label class="label">From</label><input class="field num" type="time" value="08:00"></div>
        <div style="width:104px"><label class="label">To</label><input class="field num" type="time" value="08:45"></div>
        <div style="width:80px"><label class="label">Minimum</label><input class="field num" type="number" value="1" style="text-align:right"></div>
        <div style="width:80px"><label class="label">Preferred</label><input class="field num" type="number" value="2" style="text-align:right"></div>
      </div>
      <div class="row" style="align-items:flex-end">
        <div style="width:150px"><label class="label">Day</label>
          <select class="field"><option>Monday</option><option>Tuesday</option></select></div>
        <label class="row" style="gap:6px;font-size:var(--t-base);color:var(--c-text-2);padding-bottom:7px">
          <input type="checkbox" checked> Active</label>
        <div style="width:200px"><label class="label">Disabled</label><input class="field" value="Locked" disabled></div>
      </div>
      <div style="width:260px"><label class="label">Placeholder</label><input class="field" placeholder="New person"></div>
    </div>`,
  },
  {
    slug: "components/pills",
    group: "Components",
    name: "Pills",
    subtitle: "Neutral, OK, warning, danger",
    viewport: { width: 640, height: 240 },
    title: "Pills",
    note: "Coverage state is carried by colour and by an explicit ratio, never colour alone.",
    body: `<div class="stack">
      <div><div class="group-label">States</div><div class="row">
        <span class="pill">4</span>
        <span class="pill pill-ok">Settings saved</span>
        <span class="pill pill-warn">Below preferred</span>
        <span class="pill pill-danger">Understaffed</span>
      </div></div>
      <div><div class="group-label">Coverage ratios</div><div class="row">
        <span class="pill pill-warn num">1/2</span>
        <span class="pill pill-danger num">2/3</span>
        <span class="pill num">3/3</span>
      </div></div>
    </div>`,
  },
  {
    slug: "components/chips",
    group: "Components",
    name: "Person chips",
    subtitle: "One hue per person, default and locked",
    viewport: { width: 640, height: 340 },
    title: "Person chips",
    note: "The hue comes from data-person and stays with that person everywhere. Clicking a chip locks the assignment.",
    body: `<div class="stack">
      <div><div class="group-label">Default</div>
        <div class="col" style="width:190px">${PEOPLE.map(([n, h]) => chip(n, h)).join("")}</div></div>
      <div><div class="group-label">Locked — kept on the next generate</div>
        <div class="col" style="width:190px">${PEOPLE.map(([n, h]) => chip(n, h, true)).join("")}</div></div>
    </div>`,
  },
  {
    slug: "patterns/schedule-grid",
    group: "Patterns",
    name: "Schedule grid",
    subtitle: "Time by day, with coverage states",
    viewport: { width: 940, height: 460 },
    title: "Schedule grid",
    note: "Shifts down, weekdays across. A coloured left edge marks a cell that is short of people; the ratio spells out how short.",
    body: `<div class="card" style="overflow:hidden">
      <table>
        <thead><tr style="border-bottom:1px solid var(--c-line)">
          <th class="col-head" style="width:170px;padding-left:16px">Shifts</th>
          ${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((d) => `<th class="col-head">${d}</th>`).join("")}
        </tr></thead>
        <tbody>
          <tr style="border-bottom:1px solid var(--c-line)">
            <th style="text-align:left;vertical-align:top;padding:10px 12px 10px 16px">
              <div style="font-size:var(--t-sm);font-weight:600">Arrival</div>
              <div class="num" style="font-size:var(--t-2xs);color:var(--c-text-3)">8:00 – 8:45 AM</div></th>
            ${cell([["Noriko", 1]], "warn")}${cell([["Noriko", 1]], "warn")}
            <td style="padding:10px 12px;color:var(--c-text-3)">·</td>
            ${cell([["Noriko", 1]], "warn")}${cell([["Jeanette", 4]], "warn")}
          </tr>
          <tr style="border-bottom:1px solid var(--c-line)">
            <th style="text-align:left;vertical-align:top;padding:10px 12px 10px 16px">
              <div style="font-size:var(--t-sm);font-weight:600">Recess</div>
              <div class="num" style="font-size:var(--t-2xs);color:var(--c-text-3)">10:05 – 11:40 AM</div></th>
            ${cell([["Noriko", 1]], "ok")}${cell([["Heather", 2]], "ok")}${cell([["Heather", 2]], "ok")}${cell([["Noriko", 1]], "ok")}${cell([["Jeanette", 4]], "ok")}
          </tr>
          <tr>
            <th style="text-align:left;vertical-align:top;padding:10px 12px 10px 16px">
              <div style="font-size:var(--t-sm);font-weight:600">Lunch</div>
              <div class="num" style="font-size:var(--t-2xs);color:var(--c-text-3)">11:40 AM – 1:15 PM</div></th>
            ${cell([["Noriko", 1], ["Teresa", 3]], "critical")}
            ${cell([["Jeanette", 4], ["Heather", 2], ["Teresa", 3]], "ok")}
            ${cell([["Noriko", 1], ["Heather", 2], ["Teresa", 3]], "ok")}
            ${cell([["Noriko", 1], ["Heather", 2], ["Teresa", 3]], "ok")}
            ${cell([["Jeanette", 4], ["Noriko", 1], ["Teresa", 3]], "ok")}
          </tr>
        </tbody>
      </table>
    </div>`,
  },
  {
    slug: "patterns/workload",
    group: "Patterns",
    name: "Workload bars",
    subtitle: "Hours per person against an even-split marker",
    viewport: { width: 820, height: 300 },
    title: "Workload bars",
    note: "The vertical rule is the even split across everyone. Anything reaching past it is above fair share — the fastest way to see an unbalanced week.",
    body: (() => {
      const rows = [
        ["Noriko", 1, 810, "5", "1h 30m"],
        ["Heather", 2, 475, "3", "0m"],
        ["Teresa", 3, 475, "5", "0m"],
        ["Jeanette", 4, 365, "2", "45m"],
      ];
      const scale = 810;
      const mean = rows.reduce((s, r) => s + r[2], 0) / rows.length;
      return `<div class="card" style="overflow:hidden">
        ${rows
          .map(
            ([name, hue, mins, days, idle], i) => `
          <div style="display:grid;grid-template-columns:8.5rem 1fr auto;align-items:center;gap:16px;padding:10px 16px;${i ? "border-top:1px solid var(--c-line)" : ""}">
            <div class="row" style="gap:8px">
              <span class="chip-dot" style="background:var(--c-p${hue})"></span>
              <span style="font-size:var(--t-sm);font-weight:500">${name}</span></div>
            <div class="row" style="gap:12px;flex-wrap:nowrap">
              <div style="position:relative;height:10px;flex:1;border-radius:var(--r-full);background:var(--c-raised);overflow:hidden">
                <div style="height:100%;border-radius:var(--r-full);width:${(mins / scale) * 100}%;background:var(--c-p${hue})"></div>
                <span style="position:absolute;top:0;height:100%;width:1px;background:color-mix(in srgb, var(--c-text) 45%, transparent);left:${(mean / scale) * 100}%"></span>
              </div>
              <span class="num" style="width:64px;text-align:right;font-size:var(--t-sm);font-weight:500;color:${mins > mean ? "var(--c-text)" : "var(--c-text-2)"}">${(mins / 60).toFixed(2)} h</span>
            </div>
            <div class="num row" style="gap:16px;font-size:var(--t-2xs);color:var(--c-text-3)">
              <span>Days ${days}</span><span>Waiting ${idle}</span></div>
          </div>`,
          )
          .join("")}
      </div>`;
    })(),
  },
  {
    slug: "patterns/coverage-banner",
    group: "Patterns",
    name: "Coverage warnings",
    subtitle: "All-clear and problem states",
    viewport: { width: 820, height: 340 },
    title: "Coverage warnings",
    note: "Critical gaps are listed before soft ones, each naming the day, the shift and how short it is.",
    body: `<div class="stack">
      <p style="display:flex;align-items:center;gap:8px;margin:0;border:1px solid var(--c-ok-line);border-radius:var(--r-md);background:var(--c-ok-soft);padding:8px 12px;color:var(--c-ok)">✓ Every shift meets its minimum.</p>
      <div class="card" style="overflow:hidden">
        <div class="row" style="gap:8px;border-bottom:1px solid var(--c-line);padding:10px 16px">
          <h2 style="margin:0;font-size:var(--t-sm);font-weight:600">Coverage warnings</h2>
          <span class="pill pill-danger">1</span><span class="pill pill-warn">4</span>
        </div>
        ${[
          ["danger", "Understaffed", "Monday", "Lunch", "11:40 AM – 1:15 PM", "2 of 3 needed"],
          ["warn", "Below preferred", "Monday", "Arrival", "8:00 – 8:45 AM", "1 of 2 needed"],
          ["warn", "Below preferred", "Friday", "Arrival", "8:00 – 8:45 AM", "1 of 2 needed"],
        ]
          .map(
            ([kind, label, day, name, time, ratio], i) => `
          <div class="row" style="gap:12px;padding:8px 16px;${i ? "border-top:1px solid var(--c-line)" : ""}">
            <span class="pill pill-${kind}">${label}</span>
            <span style="font-weight:500">${day}</span>
            <span style="color:var(--c-text-2)">${name}</span>
            <span class="num" style="font-size:var(--t-xs);color:var(--c-text-3)">${time}</span>
            <span class="num" style="margin-left:auto;font-size:var(--t-xs);color:var(--c-text-2)">${ratio}</span>
          </div>`,
          )
          .join("")}
      </div>
    </div>`,
  },
  {
    slug: "patterns/nav",
    group: "Patterns",
    name: "Navigation",
    subtitle: "Sticky header with language toggle",
    viewport: { width: 900, height: 180 },
    title: "Navigation",
    note: "English and Spanish are peers; the toggle sits on the right and persists per browser.",
    body: `<div class="card" style="overflow:hidden;padding:0">
      <div class="row" style="gap:20px;padding:10px 24px;border-bottom:1px solid var(--c-line);background:var(--c-surface)">
        <div class="row" style="gap:8px">
          <span style="display:grid;place-items:center;width:24px;height:24px;border-radius:var(--r-sm);background:var(--c-accent);color:var(--c-accent-fg);font-size:var(--t-2xs);font-weight:700">SS</span>
          <span style="font-size:var(--t-base);font-weight:600;letter-spacing:-0.02em">School Supervision Schedule</span>
        </div>
        <nav class="row" style="gap:2px">
          <span style="border-radius:var(--r-sm);padding:6px 10px;background:var(--c-raised);font-weight:500">Schedule</span>
          <span style="border-radius:var(--r-sm);padding:6px 10px;color:var(--c-text-2)">Staff</span>
          <span style="border-radius:var(--r-sm);padding:6px 10px;color:var(--c-text-2)">Shifts</span>
          <span style="border-radius:var(--r-sm);padding:6px 10px;color:var(--c-text-2)">Settings</span>
        </nav>
        <div class="row" style="gap:2px;margin-left:auto;border:1px solid var(--c-line);border-radius:var(--r-sm);background:var(--c-raised);padding:2px">
          <span style="border-radius:3px;padding:2px 6px;background:var(--c-surface);font-size:var(--t-2xs);font-weight:600;box-shadow:var(--e-1)">EN</span>
          <span style="border-radius:3px;padding:2px 6px;color:var(--c-text-3);font-size:var(--t-2xs);font-weight:600">ES</span>
        </div>
      </div>
    </div>`,
  },
];

fs.rmSync(outDir, { recursive: true, force: true });

const written = [];
for (const c of COMPONENTS) {
  const file = path.join(outDir, `${c.slug}.html`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // The first-line marker is what the Design System pane indexes into a card.
  const marker = `<!-- @dsCard group="${c.group}" name="${c.name}" subtitle="${c.subtitle}" width="${c.viewport.width}" height="${c.viewport.height}" -->\n`;
  fs.writeFileSync(file, marker + page(c));
  written.push(`${c.slug}.html`);
}

console.log(`Built ${written.length} previews into design-system/dist:`);
for (const f of written) console.log(`  ${f}`);
