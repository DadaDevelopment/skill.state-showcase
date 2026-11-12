import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  costBreakdown,
  costParts,
  decode,
  horizonByTask,
  makeFilter,
  mcnemarExact,
  pairedAgainst,
  summarize,
  wilson,
} from "../site/stats.js";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "../site/data.json"), "utf8"));
const runs = decode(data);
const nTasks = data.tasks.length;
const all = makeFilter({}, { long: [] });

assert.equal(runs.length, 1044);
assert.equal(nTasks, 87);

const expectedSolved = { baseline: 160, tail0: 91, tail2: 118, tail6: 154 };
const expectedCi = {
  baseline: [0.553, 0.67],
  tail0: [0.293, 0.408],
  tail2: [0.393, 0.513],
  tail6: [0.529, 0.648],
};
data.conditions.forEach((condition, index) => {
  const s = summarize(runs, index, all);
  assert.equal(s.n, 261, condition.id + " n");
  assert.equal(s.solved, expectedSolved[condition.id], condition.id + " solved");
  assert.ok(Math.abs(s.lo - expectedCi[condition.id][0]) < 0.0006, condition.id + " ci lo " + s.lo);
  assert.ok(Math.abs(s.hi - expectedCi[condition.id][1]) < 0.0006, condition.id + " ci hi " + s.hi);
});

const expectedPaired = {
  tail0: { controlOnly: 82, armOnly: 13, both: 78, p: 2.08e-13, cost: 2.57, peak: 0.47, output: 4.55, cache: 0.89 },
  tail2: { controlOnly: 58, armOnly: 16, both: 102, p: 9.67e-7, cost: 1.39, peak: 0.6, output: 2.08, cache: 0.4 },
  tail6: { controlOnly: 29, armOnly: 23, both: 131, p: 0.488, cost: 1.15, peak: 0.81, output: 1.36, cache: 0.21 },
};
data.conditions.forEach((condition, index) => {
  if (condition.id === "baseline") return;
  const r = pairedAgainst(runs, index, 0, all);
  const e = expectedPaired[condition.id];
  assert.equal(r.pairs, 261);
  assert.equal(r.controlOnly, e.controlOnly, condition.id + " controlOnly");
  assert.equal(r.armOnly, e.armOnly, condition.id + " armOnly");
  assert.equal(r.both, e.both, condition.id + " both");
  assert.ok(Math.abs(Math.log10(r.p) - Math.log10(e.p)) < 0.01, condition.id + " p " + r.p);
  for (const key of ["cost", "peak", "output", "cache"]) {
    assert.ok(Math.abs(r[key] - e[key]) < 0.006, condition.id + " " + key + " " + r[key]);
  }
});

const totals = { baseline: 17.85, tail0: 14.83, tail2: 12.88, tail6: 11.83 };
data.conditions.forEach((condition, index) => {
  const s = summarize(runs, index, all);
  assert.ok(Math.abs(s.cost - totals[condition.id]) < 0.006, condition.id + " cost " + s.cost);
});

const horizon = horizonByTask(runs, 0, nTasks);
assert.equal(horizon.cut, 11);
assert.equal(horizon.long.filter(Boolean).length, 42);
const expectedHorizon = {
  tail0: { short: [28, 5], long: [54, 8] },
  tail2: { short: [23, 8], long: [35, 8] },
  tail6: { short: [11, 10], long: [18, 13] },
};
for (const part of ["short", "long"]) {
  const keep = makeFilter({ horizon: part }, horizon);
  data.conditions.forEach((condition, index) => {
    if (condition.id === "baseline") return;
    const r = pairedAgainst(runs, index, 0, keep);
    const [co, ao] = expectedHorizon[condition.id][part];
    assert.equal(r.controlOnly, co, condition.id + " " + part + " controlOnly");
    assert.equal(r.armOnly, ao, condition.id + " " + part + " armOnly");
  });
}

assert.equal(mcnemarExact(0, 0), 1);
assert.equal(mcnemarExact(5, 5), 1);
assert.ok(Math.abs(mcnemarExact(1, 9) - 0.021484375) < 1e-9);
const [lo, hi] = wilson(0, 10);
assert.equal(lo, 0);
assert.ok(hi > 0.27 && hi < 0.30);

let worst = 0;
for (const run of runs) {
  const parts = costParts(run);
  const total = parts.input + parts.cache + parts.output;
  worst = Math.max(worst, Math.abs(total - run.cost));
}
assert.ok(worst < 2e-6, "tariff recomputation differs from cost_usd by " + worst);

data.conditions.forEach((condition, index) => {
  if (condition.id === "baseline") return;
  const b = costBreakdown(runs, index, 0, all);
  assert.equal(b.n, expectedPaired[condition.id].both, condition.id + " breakdown pairs");
  const armTotal = b.arm.input + b.arm.cache + b.arm.output;
  const ctrlTotal = b.control.input + b.control.cache + b.control.output;
  assert.ok(armTotal > 0 && ctrlTotal > 0);
});

const ceiling = data.conditions.map((_, i) => summarize(runs, i, all).ceiling);
assert.deepEqual(ceiling, [62, 117, 95, 67]);

console.log("stats tests passed");
