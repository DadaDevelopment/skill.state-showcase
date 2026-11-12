import { t } from "./i18n.js";
import { decode, horizonByTask, makeFilter, summarize, pairedAgainst, perTask } from "./stats.js";
import { esc, rateChart, ratioChart, stopChart, heatmapHtml } from "./charts.js";
import { makeFormatters, loadData } from "./shared.js";

const REPO = "https://github.com/DadaDevelopment/skill.state-paper";
const DEFAULTS = { lang: "ru", trial: "all", horizon: "all", sort: "name" };

function readState() {
  const params = new URLSearchParams(location.search);
  const state = { ...DEFAULTS };
  const browser = (navigator.language || "ru").toLowerCase().startsWith("ru") ? "ru" : "en";
  state.lang = params.get("lang") || browser;
  for (const key of ["trial", "horizon", "sort"]) if (params.has(key)) state[key] = params.get(key);
  if (!["ru", "en"].includes(state.lang)) state.lang = "ru";
  if (!["all", "1", "2", "3"].includes(state.trial)) state.trial = "all";
  if (!["all", "short", "long"].includes(state.horizon)) state.horizon = "all";
  if (!["name", "base", "gap"].includes(state.sort)) state.sort = "name";
  return state;
}

function writeState(state) {
  const params = new URLSearchParams();
  for (const key of Object.keys(DEFAULTS)) if (state[key] !== DEFAULTS[key]) params.set(key, state[key]);
  const query = params.toString();
  try {
    history.replaceState(null, "", query ? "?" + query : location.pathname);
  } catch (error) {
    return;
  }
}

function setText(root, lang, vars) {
  document.documentElement.lang = lang;
  for (const node of root.querySelectorAll("[data-i18n]")) {
    node.textContent = t(lang, node.dataset.i18n, vars);
  }
}

function fillSelect(select, options, value) {
  select.innerHTML = options.map(([key, label]) => `<option value="${esc(key)}">${esc(label)}</option>`).join("");
  select.value = value;
}

function tableHtml({ data, lang, summaries, paired, fmt }) {
  const label = (i) => t(lang, "cond_" + data.conditions[i].id);
  const head = ["colCondition", "colSolved", "colRate", "colCtrlOnly", "colArmOnly", "colP", "colCost", "colPeak", "colOutput", "colCache", "colTotal", "colPerSolved", "colCeiling"];
  let html = "<table class=\"summary\"><thead><tr>";
  head.forEach((key, i) => {
    html += `<th${i === 0 ? " class=\"sticky\"" : ""}>${esc(t(lang, key))}</th>`;
  });
  html += "</tr></thead><tbody>";
  summaries.forEach((s, i) => {
    const r = paired.find((entry) => entry.index === i);
    const dash = "—";
    const heavy = s.ceilingRate >= 0.3 ? " warn" : "";
    html += `<tr><th class="sticky"><span class="swatch c${i}"></span>${esc(label(i))}</th>`;
    html += `<td>${s.solved}/${s.n}</td>`;
    html += `<td>${fmt.pct(s.rate)} <span class="muted">[${fmt.pct(s.lo)}, ${fmt.pct(s.hi)}]</span></td>`;
    html += `<td>${r ? r.result.controlOnly : dash}</td><td>${r ? r.result.armOnly : dash}</td>`;
    html += `<td${r && r.result.p < 0.05 ? " class=\"sig\"" : ""}>${r ? fmt.p(r.result.p) : dash}</td>`;
    html += `<td>${r ? fmt.ratio(r.result.cost) : dash}</td><td>${r ? fmt.ratio(r.result.peak) : dash}</td>`;
    html += `<td>${r ? fmt.ratio(r.result.output) : dash}</td><td>${r ? fmt.ratio(r.result.cache) : dash}</td>`;
    html += `<td>${fmt.usd(s.cost)}</td><td>${fmt.usd(s.costPerSolved)}</td>`;
    html += `<td class="${heavy.trim()}">${s.ceiling} <span class="muted">(${fmt.pct(s.ceilingRate, 0)})</span></td></tr>`;
  });
  return html + "</tbody></table>";
}

function vaxisHtml({ data, lang, fmt }) {
  const head = ["vArm", "vProtocol", "vSchema", "vSolved", "vRate", "vArmOnly", "vTurns", "vCost", "vTotal"];
  let html = "<table class=\"summary\"><thead><tr>";
  head.forEach((key, i) => {
    html += `<th${i === 0 ? " class=\"sticky\"" : ""}>${esc(t(lang, key))}</th>`;
  });
  html += "</tr></thead><tbody>";
  for (const row of data.vaxis) {
    const isControl = row.arm === "control";
    html += `<tr><th class="sticky mono">${esc(row.arm)}</th><td>${esc(row.protocol)}</td><td>${esc(row.schema)}</td>`;
    html += `<td>${row.solved}/${row.runs}</td><td>${fmt.pct(row.solved / row.runs)}</td>`;
    html += `<td>${isControl ? "—" : row.arm_only_vs_control + " / " + row.control_only_vs_arm}</td>`;
    html += `<td>${row.median_turns}</td><td>${fmt.usd4(row.median_cost_usd)}</td><td>${fmt.usd(row.total_cost_usd_rounded)}</td></tr>`;
  }
  return html + "</tbody></table>";
}

function render(ctx) {
  const { data, runs, horizon, state, fmt } = ctx;
  const lang = state.lang;
  const keep = makeFilter(state, horizon);
  const nCond = data.conditions.length;
  const nTasks = data.tasks.length;
  const labels = data.conditions.map((c) => t(lang, "cond_" + c.id));
  const shortLabels = data.conditions.map((c) => t(lang, "short_" + c.id));
  const stopLabels = data.stops.map((s) => t(lang, "stop_" + s));
  const summaries = data.conditions.map((_, i) => summarize(runs, i, keep));
  const paired = data.conditions
    .map((_, i) => i)
    .filter((i) => i > 0)
    .map((i) => ({ index: i, result: pairedAgainst(runs, i, 0, keep) }));

  const all = makeFilter({}, horizon);
  const fullSummaries = data.conditions.map((_, i) => summarize(runs, i, all));
  const fullTail0 = pairedAgainst(runs, 1, 0, all);
  const fullTail6 = pairedAgainst(runs, 3, 0, all);

  setText(document, lang, {});
  document.title = t(lang, "brand");
  document.getElementById("key-peak").textContent = fmt.ratio(fullTail0.peak);
  document.getElementById("key-cost").textContent = fmt.ratio(fullTail0.cost);
  document.getElementById("key-solve").textContent = fmt.pct(fullSummaries[0].rate) + " → " + fmt.pct(fullSummaries[1].rate);
  document.getElementById("key-recover").textContent = fmt.pct(fullSummaries[3].rate) + " vs " + fmt.pct(fullSummaries[0].rate);
  document.getElementById("key-recover-p").textContent = "p = " + fmt.p(fullTail6.p);
  document.getElementById("caveat-text").textContent = t(lang, "caveatBanner", {
    pct: Math.round(fullSummaries[1].ceilingRate * 100),
    pctBase: Math.round(fullSummaries[0].ceilingRate * 100),
  });

  fillSelect(document.getElementById("trial"), [["all", t(lang, "all")], ["1", t(lang, "trialN", { n: 1 })], ["2", t(lang, "trialN", { n: 2 })], ["3", t(lang, "trialN", { n: 3 })]], state.trial);
  fillSelect(document.getElementById("horizon"), [["all", t(lang, "all")], ["short", t(lang, "short")], ["long", t(lang, "long")]], state.horizon);
  fillSelect(document.getElementById("sort"), [["name", t(lang, "sortName")], ["base", t(lang, "sortBase")], ["gap", t(lang, "sortGap")]], state.sort);
  document.getElementById("horizon-note").textContent = t(lang, "horizonNote", { cut: horizon.cut });

  document.getElementById("table").innerHTML = tableHtml({ data, lang, summaries, paired, fmt });

  document.getElementById("chart-rate").innerHTML = rateChart({ summaries, labels, fmt, hint: t(lang, "chartRate") });
  const metrics = [
    { key: "cost", label: t(lang, "metricCost") },
    { key: "peak", label: t(lang, "metricPeak") },
    { key: "output", label: t(lang, "metricOutput") },
    { key: "cache", label: t(lang, "metricCache") },
  ];
  document.getElementById("chart-ratio").innerHTML = ratioChart({ paired, metrics, labels, fmt, hint: t(lang, "chartRatio") });
  document.getElementById("chart-stop").innerHTML = stopChart({ summaries, runs, stops: data.stops, labels, stopLabels, fmt, hint: t(lang, "chartStop"), keep });

  const grid = perTask(runs, nTasks, nCond, keep);
  const order = data.tasks.map((_, i) => i);
  const solvedOf = (task, cond) => grid[task][cond].solved;
  if (state.sort === "name") order.sort((a, b) => data.tasks[a].localeCompare(data.tasks[b]));
  if (state.sort === "base") order.sort((a, b) => solvedOf(b, 0) - solvedOf(a, 0) || data.tasks[a].localeCompare(data.tasks[b]));
  if (state.sort === "gap") order.sort((a, b) => solvedOf(b, 0) - solvedOf(b, 1) - (solvedOf(a, 0) - solvedOf(a, 1)) || data.tasks[a].localeCompare(data.tasks[b]));
  document.getElementById("heatmap").innerHTML = heatmapHtml({
    grid,
    tasks: data.tasks,
    order,
    shortLabels,
    taskLabel: t(lang, "colTask"),
    tooltip: (cell) => t(lang, "tooltipSolved", { s: cell.solved, n: cell.n }),
  });

  document.getElementById("vaxis").innerHTML = vaxisHtml({ data, lang, fmt });

  const limitVars = {
    baseCeil: fullSummaries[0].ceiling,
    tail0Ceil: fullSummaries[1].ceiling,
    tail2Ceil: fullSummaries[2].ceiling,
    tail6Ceil: fullSummaries[3].ceiling,
  };
  document.getElementById("limits").innerHTML = t(lang, "limits")
    .map((item) => `<li>${esc(item.replace(/\{(\w+)\}/g, (_, name) => limitVars[name]))}</li>`)
    .join("");
  document.getElementById("footer-data").textContent = t(lang, "footerData", { rev: data.meta.source_revision || "n/a" });
  for (const button of document.querySelectorAll("[data-lang]")) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
  }
  writeState(state);
}

async function main() {
  const data = await loadData();
  const runs = decode(data);
  const horizon = horizonByTask(runs, 0, data.tasks.length);
  const state = readState();
  const ctx = { data, runs, horizon, state, fmt: makeFormatters(state.lang) };
  const rerender = () => {
    ctx.fmt = makeFormatters(state.lang);
    render(ctx);
  };
  for (const id of ["trial", "horizon", "sort"]) {
    document.getElementById(id).addEventListener("change", (event) => {
      state[id] = event.target.value;
      rerender();
    });
  }
  document.getElementById("reset").addEventListener("click", () => {
    Object.assign(state, { trial: "all", horizon: "all", sort: "name" });
    rerender();
  });
  for (const button of document.querySelectorAll("[data-lang]")) {
    button.addEventListener("click", () => {
      state.lang = button.dataset.lang;
      rerender();
    });
  }
  document.getElementById("repo-link").href = REPO;
  rerender();
}

main().catch((error) => {
  document.getElementById("fatal").hidden = false;
  document.getElementById("fatal").textContent = String(error);
});
