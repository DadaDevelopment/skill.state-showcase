import argparse
import functools
import http.server
import subprocess
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        return


def render(languages, chrome):
    handler = functools.partial(QuietHandler, directory=str(SITE))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        for lang in languages:
            out = SITE / ("skill-state-poster-%s.pdf" % lang)
            subprocess.run(
                [
                    chrome,
                    "--headless=new",
                    "--disable-gpu",
                    "--no-pdf-header-footer",
                    "--virtual-time-budget=8000",
                    "--print-to-pdf=" + str(out),
                    "http://127.0.0.1:%d/poster.html?lang=%s" % (port, lang),
                ],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            print("wrote", out, out.stat().st_size, "bytes")
    finally:
        server.shutdown()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--chrome", default=CHROME)
    parser.add_argument("--lang", nargs="+", default=["ru", "en"])
    args = parser.parse_args()
    render(args.lang, args.chrome)
