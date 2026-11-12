import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
MODULES = ["i18n.js", "stats.js", "charts.js", "shared.js", "app.js"]
IMPORT_LINE = re.compile(r"^import\s.+?from\s+[\"'].+?[\"'];\s*$", re.MULTILINE)
EXPORT_PREFIX = re.compile(r"^export\s+", re.MULTILINE)


def bundle():
    parts = []
    for name in MODULES:
        source = (SITE / name).read_text()
        source = IMPORT_LINE.sub("", source)
        source = EXPORT_PREFIX.sub("", source)
        parts.append(source.strip())
    return "document.addEventListener(\"DOMContentLoaded\", function () {\n" + "\n\n".join(parts) + "\n});"


CLOSING_SCRIPT = re.compile(r"</(script)", re.IGNORECASE)


def safe_script(text):
    return CLOSING_SCRIPT.sub(lambda m: "<\\/" + m.group(1), text)


def export(out):
    html = (SITE / "index.html").read_text()
    css = (SITE / "style.css").read_text()
    data = (SITE / "data.json").read_text().strip()
    html, css_count = re.subn(
        r'<link rel="stylesheet" href="style\.css">',
        lambda _: "<style>\n" + css + "</style>",
        html,
    )
    script = "<script>window.__SHOWCASE_DATA__=" + safe_script(data) + ";</script>\n<script>\n" + safe_script(bundle()) + "\n</script>"
    html, js_count = re.subn(
        r'<script type="module" src="app\.js"></script>',
        lambda _: script,
        html,
    )
    if css_count != 1 or js_count != 1:
        raise SystemExit("index.html no longer matches the export patterns")
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print("wrote", out, out.stat().st_size, "bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(ROOT / "dist/skill-state-showcase.html"))
    export(parser.parse_args().out)
