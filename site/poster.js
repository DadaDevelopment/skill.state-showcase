import { t } from "./i18n.js";
import { decode, horizonByTask, makeFilter, summarize, pairedAgainst, costBreakdown } from "./stats.js";
import { esc, rateChart, ratioChart, stopChart, costPartsChart } from "./charts.js";
import { makeFormatters, loadData } from "./shared.js";

const SHEET_W = 1684;
const SHEET_H = 1189;

function readLang() {
  const params = new URLSearchParams(location.search);
  const browser = (navigator.language || "ru").toLowerCase().startsWith("ru") ? "ru" : "en";
  const lang = params.get("lang") || browser;
  return lang === "en" ? "en" : "ru";
}

function writeLang(lang) {
  const params = new URLSearchParams(location.search);
  if (lang === "ru") params.delete("lang");
  else params.set("lang", lang);
  const query = params.toString();
  try {
    history.replaceState(null, "", query ? "?" + query : location.pathname);
  } catch (error) {
    return;
  }
  document.getElementById("back-link").href = query ? "./?" + query : "./";
  document.getElementById("pdf-link").href = "skill-state-poster-" + lang + ".pdf";
}

function diagram(lang) {
  const width = 440;
  const tile = 24;
  const gap = 5;
  const rowHeight = 46;
  const rows = [
    { key: "baseline", history: 11, state: false, recent: 0 },
    { key: "tail0", history: 0, state: true, recent: 0 },
    { key: "tail2", history: 0, state: true, recent: 2 },
    { key: "tail6", history: 0, state: true, recent: 6 },
  ];
  const height = rows.length * rowHeight + 4;
  let svg = `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="${esc(t(lang, "pDiagram"))}">`;
  rows.forEach((row, i) => {
    const y = i * rowHeight;
    svg += `<text class="diagram-label" x="0" y="${y + 16}">${esc(t(lang, "cond_" + row.key))}</text>`;
    let x = 0;
    const ty = y + 21;
    if (row.state) {
      svg += `<rect class="state-block" x="${x}" y="${ty}" width="92" height="${tile}" rx="4"/>`;
      svg += `<text class="diagram-text" x="${x + 46}" y="${ty + 17}" text-anchor="middle">${esc(t(lang, "pDiagramState"))}</text>`;
      x += 92 + gap * 2;
    }
    for (let k = 0; k < row.history; k += 1) {
      svg += `<rect class="tile" x="${x}" y="${ty}" width="${tile}" height="${tile}" rx="4"/>`;
      x += tile + gap;
    }
    for (let k = 0; k < row.recent; k += 1) {
      svg += `<rect class="tile recent" x="${x}" y="${ty}" width="${tile}" height="${tile}" rx="4"/>`;
      x += tile + gap;
    }
    if (row.history) {
      svg += `<text class="diagram-note" x="${x + 4}" y="${ty + 17}">${esc(t(lang, "pDiagramHistory"))}</text>`;
    }
  });
  return svg + "</svg>";
}

function fit() {
  const stage = document.getElementById("stage");
  const sheet = document.getElementById("sheet");
  const scale = stage.clientWidth / SHEET_W;
  sheet.style.transform = "scale(" + scale + ")";
  stage.style.height = SHEET_H * scale + "px";
}

function render(ctx) {
  const { data, runs, horizon, lang, fmt } = ctx;
  const keep = makeFilter({}, horizon);
  const summaries = data.conditions.map((_, i) => summarize(runs, i, keep));
  const paired = [1, 2, 3].map((i) => ({ index: i, result: pairedAgainst(runs, i, 0, keep) }));
  const shortLabels = data.conditions.map((c) => t(lang, "short_" + c.id));
  const labels = data.conditions.map((c) => t(lang, "cond_" + c.id));
  const stopLabels = data.stops.map((s) => t(lang, "stop_" + s));

  document.documentElement.lang = lang;
  document.title = t(lang, "brand") + " · " + t(lang, "posterNav");
  for (const node of document.querySelectorAll("[data-i18n]")) node.textContent = t(lang, node.dataset.i18n);

  document.getElementById("p-key-peak").textContent = fmt.ratio(paired[0].result.peak);
  document.getElementById("p-key-cost").textContent = fmt.ratio(paired[0].result.cost);
  document.getElementById("p-key-solve").textContent = fmt.pct(summaries[0].rate, 0) + " → " + fmt.pct(summaries[1].rate, 0);
  document.getElementById("p-key-recover").textContent = fmt.pct(summaries[3].rate, 0) + " vs " + fmt.pct(summaries[0].rate, 0);

  document.getElementById("diagram").innerHTML = diagram(lang);

  const facts = [
    [t(lang, "pFactModel"), data.meta.model],
    [t(lang, "pFactBench"), "Terminal-Bench 2.0 · " + data.tasks.length + " / 89"],
    [t(lang, "pFactRuns"), fmt.int(runs.length) + " (" + data.meta.trials + "×" + data.tasks.length + "×" + data.conditions.length + ")"],
    [t(lang, "pFactTariff"), t(lang, "pFactTariffV")],
  ];
  document.getElementById("facts").innerHTML = facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");

  document.getElementById("p-chart-rate").innerHTML = rateChart({ summaries, labels: shortLabels, fmt, hint: t(lang, "chartRate"), width: 560, rowHeight: 40 });
  const metrics = [
    { key: "cost", label: t(lang, "metricCost") },
    { key: "peak", label: t(lang, "metricPeak") },
    { key: "output", label: t(lang, "metricOutput") },
  ];
  document.getElementById("p-chart-ratio").innerHTML = ratioChart({ paired, metrics, labels: shortLabels, fmt, hint: t(lang, "chartRatio"), width: 560, rowHeight: 17, groupGap: 26 });

  const entries = [1, 2, 3].map((i) => ({ index: i, b: costBreakdown(runs, i, 0, keep) }));
  document.getElementById("p-chart-parts").innerHTML = costPartsChart({
    entries,
    labels: shortLabels,
    controlLabel: t(lang, "pControl"),
    partLabels: { input: t(lang, "pPartInput"), cache: t(lang, "pPartCache"), output: t(lang, "pPartOutput") },
    fmt,
    hint: t(lang, "pMechanism"),
    width: 470,
    rowHeight: 20,
  });
  document.getElementById("p-chart-stop").innerHTML = stopChart({ summaries, runs, stops: data.stops, labels: shortLabels, stopLabels, fmt, hint: t(lang, "chartStop"), keep, width: 470, rowHeight: 34, barHeight: 16 });
  document.getElementById("p-limits").innerHTML = ["pLimit1", "pLimit4"].map((key) => `<li>${esc(t(lang, key))}</li>`).join("");

  const vars = {
    peak: fmt.ratio(paired[0].result.peak),
    cost: fmt.ratio(paired[0].result.cost),
    rate6: fmt.pct(summaries[3].rate),
    rateBase: fmt.pct(summaries[0].rate),
    p6: fmt.p(paired[2].result.p),
    ceil0: Math.round(summaries[1].ceilingRate * 100),
  };
  document.getElementById("takeaways").innerHTML = ["pTake1", "pTake2", "pTake3"].map((key) => `<li>${esc(t(lang, key, vars))}</li>`).join("");
  document.getElementById("p-foot-data").textContent = t(lang, "pFooterData", { rev: data.meta.source_revision || "n/a" });
  for (const button of document.querySelectorAll("[data-lang]")) button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
  writeLang(lang);
  fit();
}

async function main() {
  const data = await loadData();
  const runs = decode(data);
  const horizon = horizonByTask(runs, 0, data.tasks.length);
  const ctx = { data, runs, horizon, lang: readLang(), fmt: null };
  const rerender = () => {
    ctx.fmt = makeFormatters(ctx.lang);
    render(ctx);
  };
  for (const button of document.querySelectorAll("[data-lang]")) {
    button.addEventListener("click", () => {
      ctx.lang = button.dataset.lang;
      rerender();
    });
  }
  document.getElementById("print").addEventListener("click", () => window.print());
  window.addEventListener("resize", fit);
  rerender();
}

main().catch((error) => {
  document.body.insertAdjacentText("afterbegin", String(error));
});
