export function wilson(k, n, z = 1.96) {
  if (n === 0) return [NaN, NaN];
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export function mcnemarExact(b, c) {
  const n = b + c;
  if (n === 0) return 1;
  const m = Math.min(b, c);
  let pmf = Math.pow(0.5, n);
  let cdf = pmf;
  for (let k = 0; k < m; k += 1) {
    pmf = (pmf * (n - k)) / (k + 1);
    cdf += pmf;
  }
  return Math.min(1, 2 * cdf);
}

export function median(values) {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function decode(data) {
  const index = Object.fromEntries(data.run_columns.map((name, i) => [name, i]));
  return data.runs.map((row) => {
    const out = {};
    for (const name of data.run_columns) out[name] = row[index[name]];
    out.solved = out.solved === 1;
    return out;
  });
}

export function horizonByTask(runs, controlIndex, nTasks) {
  const turns = Array.from({ length: nTasks }, () => []);
  for (const run of runs) if (run.condition === controlIndex) turns[run.task].push(run.turns);
  const perTask = turns.map(median);
  const cut = median(perTask);
  return { cut, long: perTask.map((value) => value > cut) };
}

export function makeFilter({ trial = "all", horizon = "all" }, horizonInfo) {
  return (run) => {
    if (trial !== "all" && run.trial !== Number(trial)) return false;
    if (horizon === "short" && horizonInfo.long[run.task]) return false;
    if (horizon === "long" && !horizonInfo.long[run.task]) return false;
    return true;
  };
}

export function summarize(runs, conditionIndex, keep) {
  const rows = runs.filter((run) => run.condition === conditionIndex && keep(run));
  const n = rows.length;
  const solved = rows.filter((run) => run.solved).length;
  const [lo, hi] = wilson(solved, n);
  const total = (field) => rows.reduce((sum, run) => sum + run[field], 0);
  return {
    n,
    solved,
    rate: n ? solved / n : NaN,
    lo,
    hi,
    cost: total("cost"),
    turns: total("turns"),
    input: total("input"),
    cache: total("cache"),
    output: total("output"),
    ceiling: rows.filter((run) => run.stop === 2).length,
    ceilingRate: n ? rows.filter((run) => run.stop === 2).length / n : NaN,
    costPerSolved: solved ? total("cost") / solved : NaN,
    medianPeak: median(rows.map((run) => run.peak)),
  };
}

export function pairedAgainst(runs, conditionIndex, controlIndex, keep) {
  const control = new Map();
  for (const run of runs) {
    if (run.condition === controlIndex && keep(run)) control.set(run.task * 10 + run.trial, run);
  }
  const pairs = [];
  for (const run of runs) {
    if (run.condition !== conditionIndex || !keep(run)) continue;
    const base = control.get(run.task * 10 + run.trial);
    if (base) pairs.push([base, run]);
  }
  const controlOnly = pairs.filter(([a, b]) => a.solved && !b.solved).length;
  const armOnly = pairs.filter(([a, b]) => !a.solved && b.solved).length;
  const both = pairs.filter(([a, b]) => a.solved && b.solved);
  const ratio = (field) => {
    const values = both.filter(([a]) => a[field] > 0).map(([a, b]) => b[field] / a[field]);
    return median(values);
  };
  return {
    pairs: pairs.length,
    controlOnly,
    armOnly,
    both: both.length,
    p: mcnemarExact(controlOnly, armOnly),
    cost: ratio("cost"),
    peak: ratio("peak"),
    output: ratio("output"),
    cache: ratio("cache"),
  };
}

export const TARIFF = { input: 0.15, cache: 0.03, output: 0.5 };

export function costParts(run) {
  return {
    input: (run.input * TARIFF.input) / 1e6,
    cache: (run.cache * TARIFF.cache) / 1e6,
    output: (run.output * TARIFF.output) / 1e6,
  };
}

export function costBreakdown(runs, conditionIndex, controlIndex, keep) {
  const control = new Map();
  for (const run of runs) {
    if (run.condition === controlIndex && run.solved && keep(run)) control.set(run.task * 10 + run.trial, run);
  }
  const sum = { control: { input: 0, cache: 0, output: 0 }, arm: { input: 0, cache: 0, output: 0 } };
  let n = 0;
  for (const run of runs) {
    if (run.condition !== conditionIndex || !run.solved || !keep(run)) continue;
    const base = control.get(run.task * 10 + run.trial);
    if (!base) continue;
    n += 1;
    for (const [side, item] of [["control", base], ["arm", run]]) {
      const parts = costParts(item);
      for (const key of Object.keys(parts)) sum[side][key] += parts[key];
    }
  }
  const mean = (side) => Object.fromEntries(Object.entries(sum[side]).map(([key, value]) => [key, n ? value / n : NaN]));
  return { n, control: mean("control"), arm: mean("arm") };
}

export function perTask(runs, nTasks, nConditions, keep) {
  const grid = Array.from({ length: nTasks }, () =>
    Array.from({ length: nConditions }, () => ({ solved: 0, n: 0 }))
  );
  for (const run of runs) {
    if (!keep(run)) continue;
    const cell = grid[run.task][run.condition];
    cell.n += 1;
    if (run.solved) cell.solved += 1;
  }
  return grid;
}
