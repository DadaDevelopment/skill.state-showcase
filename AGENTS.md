# Skill.State showcase

Static GitHub Pages site for the Skill.State study: interactive page (`site/index.html`) and an A1 conference poster (`site/poster.html`, PDFs `site/skill-state-poster-{ru,en}.pdf`).

- Live: https://dadadevelopment.github.io/skill.state-showcase/
- Source data: `DadaDevelopment/skill.state-paper`, `data/e1-release` and `data/followup-final`. Rebuild with `python3 scripts/build_data.py --repo <path to paper repo>`.
- No framework, no build step for the site. `site/` is deployed as is by `.github/workflows/pages.yml`.

## Commands

- `python3 scripts/build_data.py` writes `site/data.json`.
- `node tests/stats.test.mjs` checks the browser statistics against the paper tables.
- `python3 scripts/export_html.py` writes the single-file page to `dist/`; `node tests/export.test.mjs` checks it.
- `python3 scripts/render_poster.py` renders both poster PDFs with headless Chrome (A1 landscape, one page).

## Rules

- No comments in source files.
- Numbers on the pages are recomputed in the browser from raw runs; do not hardcode result numbers in markup or strings.
- The limitations section and the output-limit banner are part of the result, keep them in sync with the data.
- The poster sheet is a fixed 1684 x 1189 px canvas (A1 ratio); a change that makes a column overflow must be checked in both languages and in the PDF.
