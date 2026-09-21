// Renders one HTML "flow" page per e2e spec from Playwright's JSON reporter
// output (playwright.local.config.ts writes artifacts/e2e-runs/<run>-<port>/results.json).
// Steps come from `step()` in tests/e2e/helpers.ts: the title starts with the
// actor ("Owner: …") and a jpeg screenshot is attached as "step:<title>".
//
//   node scripts/e2e-flow-report.mjs [--out <dir>] [results.json …]
//
// Default input: every artifacts/e2e-runs/*/results.json (pass files to pick one
// run per spec). Default output: artifacts/e2e-flows. Screenshots are copied next to the pages.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const OUT = outIdx >= 0 ? args.splice(outIdx, 2)[1] : "artifacts/e2e-flows";
const inputs = args.length
  ? args
  : readdirSync("artifacts/e2e-runs")
      .map((d) => path.join("artifacts/e2e-runs", d, "results.json"))
      .filter((f) => existsSync(f));

const ACTORS = [
  "Owner",
  "Foodiva",
  "Chef_house",
  "สาขาศาลาแดง",
  "สาขามีนบุรี",
  "ระบบ",
];
const ACTOR_CLASS = Object.fromEntries(ACTORS.map((a, i) => [a, `a${i}`]));

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const ms = (d) =>
  d >= 60_000
    ? `${(d / 60_000).toFixed(1)} นาที`
    : d >= 1000
      ? `${(d / 1000).toFixed(1)} วิ`
      : `${Math.round(d)} มส.`;
const slug = (s) => s.replace(/\.spec\.ts$/, "").replace(/[\\/]/g, "__");

/** Walks a suite tree and yields { file, spec } for every spec. */
function* specs(suite, file = suite.file) {
  for (const spec of suite.specs ?? []) yield { file: spec.file ?? file, spec };
  for (const child of suite.suites ?? [])
    yield* specs(child, child.file ?? file);
}

/** Flattens nested test.step entries into rows with depth. */
function flatten(steps, depth = 0, out = []) {
  for (const s of steps ?? []) {
    out.push({ ...s, depth });
    flatten(s.steps, depth + 1, out);
  }
  return out;
}

function actorOf(title) {
  const m = /^([^:]+):\s*/.exec(title);
  return m && ACTORS.includes(m[1].trim()) ? m[1].trim() : "";
}

const runs = inputs.map((file) => ({
  file,
  json: JSON.parse(readFileSync(file, "utf8")),
}));
mkdirSync(OUT, { recursive: true });

// Group by spec file across lanes; the last result of each test wins.
const byFile = new Map();
for (const { json } of runs)
  for (const suite of json.suites)
    for (const { file, spec } of specs(suite)) {
      if (!byFile.has(file))
        byFile.set(file, { file, tests: [], startTime: json.stats.startTime });
      for (const test of spec.tests) {
        const result = test.results[test.results.length - 1];
        if (!result) continue;
        byFile
          .get(file)
          .tests.push({ title: spec.title, line: spec.line, test, result });
      }
    }

const CSS = `
:root{--bg:#f7f7f5;--fg:#1c1c1a;--muted:#6b6b66;--card:#fff;--line:#e4e4e0;--ok:#15803d;--bad:#b91c1c;--warn:#b45309;--skip:#6b7280;
--a0:#1d4ed8;--a1:#b45309;--a2:#7c3aed;--a3:#0f766e;--a4:#be185d;--a5:#475569}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--fg:#ecebe7;--muted:#a3a39c;--card:#1e1e1c;--line:#31312e;--ok:#4ade80;--bad:#f87171;--warn:#fbbf24;--skip:#9ca3af}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,"Segoe UI",Tahoma,"Noto Sans Thai",sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:0}
.muted{color:var(--muted);font-size:13px}a{color:inherit}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:16px 0}
.badge{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid currentColor}
.ok{color:var(--ok)}.bad{color:var(--bad)}.warn{color:var(--warn)}.skip{color:var(--skip)}
.actor{display:inline-block;padding:0 8px;border-radius:6px;font-size:12px;font-weight:600;color:#fff;white-space:nowrap}
.a0{background:var(--a0)}.a1{background:var(--a1)}.a2{background:var(--a2)}.a3{background:var(--a3)}.a4{background:var(--a4)}.a5{background:var(--a5)}
.strip{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:8px 0 12px}.strip .arrow{color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:6px 8px;border-top:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600;font-size:12px}
td.n{color:var(--muted);width:2.5em}td.t{width:100%}td.d{white-space:nowrap;color:var(--muted)}
.sub{padding-left:calc(var(--depth)*16px)}
.shot{display:block;width:160px;height:100px;object-fit:cover;object-position:top;border:1px solid var(--line);border-radius:6px;background:#000}
.err{white-space:pre-wrap;font:12px/1.4 ui-monospace,Consolas,monospace;color:var(--bad);background:color-mix(in srgb,var(--bad) 8%,transparent);border-radius:8px;padding:8px;margin:8px 0;overflow:auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px}
.top{display:flex;gap:12px;flex-wrap:wrap;align-items:baseline}
@media (max-width:600px){.shot{width:100px;height:64px}main{padding:16px 12px}}
`;

function statusOf(test, result) {
  if (result.status === "skipped") return ["ข้าม", "skip"];
  if (test.status === "expected")
    return result.status === "passed"
      ? ["ผ่าน", "ok"]
      : ["ตกตามคาด (บั๊กเปิดอยู่)", "warn"];
  if (test.status === "flaky") return ["ผ่านหลังรันซ้ำ", "warn"];
  return ["ตก", "bad"];
}

const pages = [];
for (const [file, group] of byFile) {
  const name = slug(file);
  const shotsDir = path.join(OUT, "shots", name);
  mkdirSync(shotsDir, { recursive: true });
  let shotN = 0;
  const copyShot = (att) => {
    // step() attaches a buffer, which the JSON reporter inlines as base64 `body`;
    // Playwright's own failure screenshots come as a `path` on disk.
    const onDisk = att?.path && existsSync(att.path);
    if (!onDisk && !att?.body) return "";
    const ext = att.contentType === "image/png" ? "png" : "jpg";
    const rel = `shots/${name}/${String(++shotN).padStart(3, "0")}.${ext}`;
    if (onDisk) copyFileSync(att.path, path.join(OUT, rel));
    else writeFileSync(path.join(OUT, rel), Buffer.from(att.body, "base64"));
    return rel;
  };

  const counts = { ok: 0, bad: 0, warn: 0, skip: 0 };
  let total = 0;
  const sections = group.tests.map(({ title, line, test, result }, i) => {
    const [label, cls] = statusOf(test, result);
    counts[cls]++;
    total += result.duration;
    const rows = flatten(result.steps);
    // Attachments named step:<title> are matched to steps in order of appearance.
    const shots = (result.attachments ?? []).filter((a) =>
      a.name.startsWith("step:"),
    );
    let shotIdx = 0;
    const actors = [];
    const body = rows
      .map((s, n) => {
        const actor = actorOf(s.title);
        if (actor && actors[actors.length - 1] !== actor) actors.push(actor);
        let shot = "";
        if (shots[shotIdx] && shots[shotIdx].name === `step:${s.title}`)
          shot = copyShot(shots[shotIdx++]);
        const text = actor ? s.title.slice(actor.length + 1).trim() : s.title;
        return `<tr><td class="n">${n + 1}</td><td>${actor ? `<span class="actor ${ACTOR_CLASS[actor]}">${esc(actor)}</span>` : ""}</td>
<td class="t"><div class="sub" style="--depth:${s.depth}">${esc(text)}${s.error ? ` <span class="badge bad">ตก</span>` : ""}</div>${
          s.error
            ? `<div class="err">${esc(s.error.message ?? s.error).slice(0, 1500)}</div>`
            : ""
        }</td><td class="d">${ms(s.duration)}</td><td>${shot ? `<a href="${shot}" target="_blank"><img class="shot" loading="lazy" src="${shot}" alt=""></a>` : ""}</td></tr>`;
      })
      .join("\n");
    const failShots = (result.attachments ?? [])
      .filter(
        (a) => a.name === "screenshot" && a.contentType?.startsWith("image/"),
      )
      .map(copyShot)
      .filter(Boolean);
    const annotations = (test.annotations ?? [])
      .map(
        (a) =>
          `<span class="badge warn">${esc(a.type)}${a.description ? `: ${esc(a.description)}` : ""}</span>`,
      )
      .join(" ");
    const errors = (result.errors ?? [])
      .map(
        (e) => `<div class="err">${esc(e.message ?? "").slice(0, 3000)}</div>`,
      )
      .join("");
    return `<section class="card" id="t${i}">
<div class="top"><h2>${esc(title)}</h2><span class="badge ${cls}">${label}</span><span class="muted">${ms(result.duration)} · บรรทัด ${line} · ${rows.length} ก้าว</span></div>
${annotations ? `<div style="margin-top:6px">${annotations}</div>` : ""}
${actors.length ? `<div class="strip">${actors.map((a) => `<span class="actor ${ACTOR_CLASS[a]}">${esc(a)}</span>`).join('<span class="arrow">→</span>')}</div>` : ""}
${rows.length ? `<table><thead><tr><th>#</th><th>ผู้ทำ</th><th>ก้าว</th><th>เวลา</th><th>หน้าจอ</th></tr></thead><tbody>${body}</tbody></table>` : `<p class="muted">ไม่มี step() ใน test นี้</p>`}
${errors}
${failShots.length ? `<div class="grid">${failShots.map((s) => `<a href="${s}" target="_blank"><img class="shot" src="${s}" alt="failure"></a>`).join("")}</div>` : ""}
</section>`;
  });

  const toc = group.tests
    .map(({ title, test, result }, i) => {
      const [label, cls] = statusOf(test, result);
      return `<li><a href="#t${i}">${esc(title)}</a> <span class="badge ${cls}">${label}</span></li>`;
    })
    .join("");
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(file)} — flow</title><style>${CSS}</style></head><body><main>
<p class="muted"><a href="index.html">← ทุก flow</a></p>
<h1>${esc(file)}</h1>
<p class="muted">รันเมื่อ ${new Date(group.startTime).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · ${group.tests.length} test · ${ms(total)} · <span class="ok">ผ่าน ${counts.ok}</span> · <span class="bad">ตก ${counts.bad}</span> · <span class="warn">ตกตามคาด ${counts.warn}</span> · <span class="skip">ข้าม ${counts.skip}</span></p>
<ol>${toc}</ol>
${sections.join("\n")}
</main></body></html>`;
  writeFileSync(path.join(OUT, `${name}.html`), html);
  pages.push({
    file,
    name,
    counts,
    total,
    n: group.tests.length,
    startTime: group.startTime,
  });
}

const sum = pages.reduce(
  (a, p) => ({
    ok: a.ok + p.counts.ok,
    bad: a.bad + p.counts.bad,
    warn: a.warn + p.counts.warn,
    skip: a.skip + p.counts.skip,
    n: a.n + p.n,
    total: a.total + p.total,
  }),
  { ok: 0, bad: 0, warn: 0, skip: 0, n: 0, total: 0 },
);
const index = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>E2E Full System — flows</title><style>${CSS}</style></head><body><main>
<h1>E2E Full System — flow การทดสอบ</h1>
<p class="muted">${pages.length} spec · ${sum.n} test · ${ms(sum.total)} · <span class="ok">ผ่าน ${sum.ok}</span> · <span class="bad">ตก ${sum.bad}</span> · <span class="warn">ตกตามคาด ${sum.warn}</span> · <span class="skip">ข้าม ${sum.skip}</span> · สร้างเมื่อ ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
<div class="card"><table><thead><tr><th>spec</th><th>test</th><th>ผ่าน</th><th>ตก</th><th>ตกตามคาด</th><th>ข้าม</th><th>เวลา</th></tr></thead><tbody>
${pages
  .sort((a, b) => a.file.localeCompare(b.file))
  .map(
    (p) =>
      `<tr><td><a href="${p.name}.html">${esc(p.file)}</a></td><td>${p.n}</td><td class="ok">${p.counts.ok}</td><td class="${p.counts.bad ? "bad" : ""}">${p.counts.bad}</td><td class="${p.counts.warn ? "warn" : ""}">${p.counts.warn}</td><td>${p.counts.skip}</td><td class="d">${ms(p.total)}</td></tr>`,
  )
  .join("\n")}
</tbody></table></div>
<p class="muted">สีของผู้ทำ: ${ACTORS.map((a) => `<span class="actor ${ACTOR_CLASS[a]}">${esc(a)}</span>`).join(" ")}</p>
</main></body></html>`;
writeFileSync(path.join(OUT, "index.html"), index);
console.log(`${pages.length} flow pages → ${OUT}`);
