export function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function rateChart({ summaries, labels, fmt, hint, width = 640, rowHeight = 58 }) {
  const left = 8;
  const right = 8;
  const plot = width - left - right;
  const top = 12;
  const height = top + summaries.length * rowHeight + 28;
  const x = (value) => left + value * plot;
  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(hint)}" class="chart">`;
  for (const tick of [0, 0.25, 0.5, 0.75, 1]) {
    svg += `<line class="grid" x1="${x(tick)}" x2="${x(tick)}" y1="${top}" y2="${height - 24}"/>`;
    svg += `<text class="tick" x="${x(tick)}" y="${height - 8}" text-anchor="${tick === 0 ? "start" : tick === 1 ? "end" : "middle"}">${Math.round(tick * 100)}%</text>`;
  }
  summaries.forEach((s, i) => {
    const y = top + i * rowHeight;
    const barY = y + 24;
    const mid = barY + 9;
    svg += `<text class="row-label" x="${left}" y="${y + 14}">${esc(labels[i])}</text>`;
    svg += `<g><title>${esc(labels[i])}: ${s.solved}/${s.n}, ${fmt.pct(s.rate)} [${fmt.pct(s.lo)}, ${fmt.pct(s.hi)}]</title>`;
    svg += `<rect class="bar c${i}" x="${x(0)}" y="${barY}" width="${Math.max(0, s.rate * plot)}" height="18" rx="3"/>`;
    svg += `<line class="whisker" x1="${x(s.lo)}" x2="${x(s.hi)}" y1="${mid}" y2="${mid}"/>`;
    svg += `<line class="whisker" x1="${x(s.lo)}" x2="${x(s.lo)}" y1="${mid - 6}" y2="${mid + 6}"/>`;
    svg += `<line class="whisker" x1="${x(s.hi)}" x2="${x(s.hi)}" y1="${mid - 6}" y2="${mid + 6}"/>`;
    svg += `<text class="value" x="${width - right}" y="${y + 14}" text-anchor="end">${fmt.pct(s.rate)}  [${fmt.pct(s.lo)}, ${fmt.pct(s.hi)}]</text></g>`;
  });
  return svg + "</svg>";
}

export function ratioChart({ paired, metrics, labels, fmt, hint, width = 640, rowHeight = 20, groupGap = 30 }) {
  const left = 24;
  const right = 60;
  const plot = width - left - right;
  const lo = Math.log10(0.1);
  const hi = Math.log10(10);
  const x = (value) => {
    const clamped = Math.min(10, Math.max(0.1, value));
    return left + ((Math.log10(clamped) - lo) / (hi - lo)) * plot;
  };
  const groups = metrics.length;
  const rowsPerGroup = paired.length;
  const top = 34;
  const groupHeight = groupGap + rowsPerGroup * rowHeight;
  const height = top + groups * groupHeight + 26;
  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(hint)}" class="chart">`;
  paired.forEach((entry, i) => {
    const lx = left + (i * (width - left - right)) / paired.length;
    svg += `<rect class="swatch c${entry.index}" x="${lx}" y="6" width="12" height="12" rx="2"/>`;
    svg += `<text class="legend" x="${lx + 18}" y="16">${esc(labels[entry.index])}</text>`;
  });
  for (const tick of [0.1, 0.25, 0.5, 1, 2, 4, 10]) {
    svg += `<line class="grid${tick === 1 ? " ref" : ""}" x1="${x(tick)}" x2="${x(tick)}" y1="${top - 4}" y2="${height - 22}"/>`;
    svg += `<text class="tick" x="${x(tick)}" y="${height - 6}" text-anchor="middle">${tick}×</text>`;
  }
  metrics.forEach((metric, g) => {
    const gy = top + g * groupHeight;
    svg += `<text class="group-label" x="${left}" y="${gy + 14}">${esc(metric.label)}</text>`;
    paired.forEach((entry, i) => {
      const value = entry.result[metric.key];
      const y = gy + groupGap - 8 + i * rowHeight;
      const x0 = x(1);
      const x1 = x(value);
      svg += `<g><title>${esc(labels[entry.index])}, ${esc(metric.label)}: ${fmt.ratio(value)}</title>`;
      if (Number.isFinite(value)) {
        svg += `<rect class="bar c${entry.index}" x="${Math.min(x0, x1)}" y="${y}" width="${Math.max(1, Math.abs(x1 - x0))}" height="14" rx="2"/>`;
        svg += `<text class="value" x="${x1 >= x0 ? x1 + 6 : x1 - 6}" y="${y + 11}" text-anchor="${x1 >= x0 ? "start" : "end"}">${fmt.ratio(value)}</text>`;
      }
      svg += "</g>";
    });
  });
  return svg + "</svg>";
}

export function stopChart({ summaries, runs, stops, labels, stopLabels, fmt, hint, keep, width = 640, rowHeight = 56, barHeight = 22 }) {
  const left = 8;
  const plot = width - left * 2;
  const top = 34;
  const order = [0, 1, 3, 2];
  const height = top + summaries.length * rowHeight + 6;
  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(hint)}" class="chart">`;
  order.forEach((stopIndex, i) => {
    const lx = left + (i * plot) / order.length;
    svg += `<rect class="swatch stop${stopIndex}" x="${lx}" y="6" width="12" height="12" rx="2"/>`;
    svg += `<text class="legend" x="${lx + 18}" y="16">${esc(stopLabels[stopIndex])}</text>`;
  });
  summaries.forEach((s, i) => {
    const y = top + i * rowHeight;
    const counts = stops.map(() => 0);
    for (const run of runs) if (run.condition === i && keep(run)) counts[run.stop] += 1;
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    svg += `<text class="row-label" x="${left}" y="${y + 12}">${esc(labels[i])}</text>`;
    let cursor = left;
    for (const stopIndex of order) {
      const share = counts[stopIndex] / total;
      const w = share * plot;
      if (w <= 0) continue;
      svg += `<g><title>${esc(labels[i])}, ${esc(stopLabels[stopIndex])}: ${counts[stopIndex]} (${fmt.pct(share)})</title>`;
      svg += `<rect class="seg stop${stopIndex}" x="${cursor}" y="${y + 18}" width="${w}" height="${barHeight}"/>`;
      if (w > 44) svg += `<text class="seg-text" x="${cursor + w / 2}" y="${y + 18 + barHeight / 2 + 4}" text-anchor="middle">${fmt.pct(share, 0)}</text>`;
      svg += "</g>";
      cursor += w;
    }
  });
  return svg + "</svg>";
}

export function heatmapHtml({ grid, tasks, order, shortLabels, taskLabel, tooltip }) {
  let html = `<table class="heat"><thead><tr><th class="sticky">${esc(taskLabel)}</th>`;
  for (const label of shortLabels) html += `<th>${esc(label)}</th>`;
  html += "</tr></thead><tbody>";
  for (const taskIndex of order) {
    html += `<tr><th class="sticky task">${esc(tasks[taskIndex])}</th>`;
    grid[taskIndex].forEach((cell) => {
      const level = cell.n === 0 ? "none" : String(cell.solved);
      html += `<td class="lv${level}" title="${esc(tooltip(cell))}">${cell.n ? cell.solved + "/" + cell.n : "·"}</td>`;
    });
    html += "</tr>";
  }
  return html + "</tbody></table>";
}

export function costPartsChart({ entries, labels, controlLabel, partLabels, fmt, hint, width = 640, rowHeight = 26 }) {
  const left = 8;
  const right = 70;
  const gutter = 96;
  const plot = width - left - right - gutter;
  const groupHeight = 24 + rowHeight * 2 + 10;
  const top = 34;
  const height = top + entries.length * groupHeight + 4;
  const total = (parts) => parts.input + parts.cache + parts.output;
  const max = Math.max(...entries.flatMap((entry) => [total(entry.b.control), total(entry.b.arm)]));
  const keys = ["input", "cache", "output"];
  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(hint)}" class="chart">`;
  keys.forEach((key, i) => {
    const lx = left + (i * (width - left - right)) / keys.length;
    svg += `<rect class="swatch part-${key}" x="${lx}" y="6" width="12" height="12" rx="2"/>`;
    svg += `<text class="legend" x="${lx + 18}" y="16">${esc(partLabels[key])}</text>`;
  });
  entries.forEach((entry, g) => {
    const gy = top + g * groupHeight;
    svg += `<text class="group-label" x="${left}" y="${gy + 14}">${esc(labels[entry.index])}</text>`;
    [["control", controlLabel], ["arm", labels[entry.index]]].forEach(([side, name], r) => {
      const y = gy + 20 + r * rowHeight;
      let cursor = left + gutter;
      const parts = entry.b[side];
      svg += `<text class="row-label small" x="${left + gutter - 8}" y="${y + rowHeight - 9}" text-anchor="end">${esc(side === "control" ? controlLabel : name)}</text>`;
      for (const key of keys) {
        const w = (parts[key] / max) * plot;
        svg += `<g><title>${esc(name)}, ${esc(partLabels[key])}: ${fmt.usd3(parts[key])}</title><rect class="seg part-${key}" x="${cursor}" y="${y}" width="${Math.max(0, w)}" height="${rowHeight - 5}"/></g>`;
        cursor += w;
      }
      svg += `<text class="value" x="${cursor + 6}" y="${y + rowHeight - 9}">${fmt.usd3(total(parts))}</text>`;
    });
  });
  return svg + "</svg>";
}
