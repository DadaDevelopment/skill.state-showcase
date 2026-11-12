import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "../dist/skill-state-showcase.html"), "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

assert.equal(scripts.length, 2, "data script and bundle script");
for (const [index, source] of scripts.entries()) {
  assert.doesNotThrow(() => new Function(source), "inline script " + index + " must parse");
}
assert.ok(scripts[0].startsWith("window.__SHOWCASE_DATA__="));
assert.ok(scripts[1].includes("DOMContentLoaded"));
assert.ok(!/<link[^>]+stylesheet/.test(html), "no external stylesheet");
assert.ok(!/src="app\.js"/.test(html), "no external module");
assert.ok(!/https?:\/\/[^"' )]+\.(js|css)\b/.test(html), "no remote assets");

console.log("export tests passed");
