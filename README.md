**Live:** https://dadadevelopment.github.io/skill.state-showcase/

# Skill.State showcase

Interactive page for the Skill.State study (Terminal-Bench 2.0, GLM-5.3-flash, 87 tasks x 4 conditions x 3 trials). Static, no framework, no server. Every number is recomputed in the browser from the 1044 raw run rows of `skill.state-paper/data/e1-release`.

Poster: [poster.html](https://dadadevelopment.github.io/skill.state-showcase/poster.html), PDFs `site/skill-state-poster-ru.pdf` and `site/skill-state-poster-en.pdf` (A1 landscape).

## Use

```bash
python3 scripts/build_data.py
node tests/stats.test.mjs
python3 scripts/export_html.py
node tests/export.test.mjs
python3 scripts/render_poster.py
```

- `site/` is the page (open through any static server).
- `dist/skill-state-showcase.html` is one self-contained file (data, CSS and JS inlined, no network). Send this one.
- `scripts/render_poster.py` prints `site/poster.html` to A1 PDFs through headless Chrome.
- `scripts/build_data.py --repo <path>` reads the paper repository and writes `site/data.json`.
- `tests/stats.test.mjs` checks the browser statistics against the tables in the paper repository (solve rates, Wilson intervals, exact McNemar, cost / peak / output / cache ratios, horizon split).

## What is shown

- Summary by condition with filters (trial, task length), URL state (`?lang=en&trial=1&horizon=long`).
- Charts: solve rate with 95% interval, how runs ended (including `output_ceiling`), cost of memory on a log scale.
- Per-task heatmap, sortable.
- Runtime-state configurations from `data/followup-final/arm-summary.csv` as an aggregate-only table.
- A limitations section stating what is lost and what is not independently verified.

## Provenance and licences

The page layout idea follows MTGBench (github.com/skyberg11/MTGBench, MIT). No MTGBench code, data or logos are copied; its licence is kept in `licenses/` as the acknowledgement. Paper data licence: see the paper repository.
