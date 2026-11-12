import argparse
import csv
import json
import subprocess
from pathlib import Path

CONDITIONS = [
    {"id": "baseline", "tail": None},
    {"id": "tail0", "tail": 0},
    {"id": "tail2", "tail": 2},
    {"id": "tail6", "tail": 6},
]
STOPS = ["solved", "unsolved", "output_ceiling", "turn_budget"]
RUN_COLUMNS = [
    "task",
    "condition",
    "trial",
    "solved",
    "turns",
    "cost",
    "input",
    "cache",
    "output",
    "peak",
    "stop",
]
VAXIS_NUMERIC = [
    "tasks",
    "repeats",
    "runs",
    "solved_t1",
    "solved_t2",
    "solved",
    "arm_only_vs_control",
    "control_only_vs_arm",
    "arm_only_vs_hybrid",
    "hybrid_only_vs_arm",
    "median_input_tokens",
    "median_output_tokens",
    "median_cache_read_tokens",
    "median_turns",
    "median_cost_usd",
    "total_cost_usd_rounded",
]


def number(value):
    if value == "":
        return None
    parsed = float(value)
    return int(parsed) if parsed.is_integer() else parsed


def git_revision(repo):
    try:
        return subprocess.check_output(
            ["git", "-C", str(repo), "rev-parse", "--short", "HEAD"], text=True
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def build(repo, out):
    repo = Path(repo)
    cond_index = {c["id"]: i for i, c in enumerate(CONDITIONS)}
    stop_index = {s: i for i, s in enumerate(STOPS)}
    with open(repo / "data/e1-release/canonical-e1-full.csv", newline="") as handle:
        source = list(csv.DictReader(handle))
    tasks = sorted({row["task_id"] for row in source})
    task_index = {t: i for i, t in enumerate(tasks)}
    runs = []
    for row in source:
        stop = row["stop_reason"]
        if stop not in stop_index:
            raise SystemExit("unknown stop reason: " + stop)
        runs.append(
            [
                task_index[row["task_id"]],
                cond_index[row["condition"]],
                int(row["trial"]),
                int(row["solved"]),
                int(row["turns"]),
                float(row["cost_usd"]),
                int(row["input_tokens"]),
                int(row["cache_read_tokens"]),
                int(row["output_tokens"]),
                int(row["prompt_peak_tokens"]),
                stop_index[stop],
            ]
        )
    runs.sort()
    if len(runs) != len(tasks) * len(CONDITIONS) * 3:
        raise SystemExit("design shape broken: %d runs" % len(runs))
    with open(repo / "data/followup-final/arm-summary.csv", newline="") as handle:
        vaxis = []
        for row in csv.DictReader(handle):
            item = {"arm": row["arm"], "protocol": row["protocol"], "schema": row["schema"]}
            for key in VAXIS_NUMERIC:
                item[key] = number(row[key])
            vaxis.append(item)
    payload = {
        "meta": {
            "model": source[0]["model"],
            "corpus": source[0]["corpus"],
            "trials": 3,
            "source_repo": "DadaDevelopment/skill.state-paper",
            "source_revision": git_revision(repo),
        },
        "conditions": CONDITIONS,
        "tasks": tasks,
        "stops": STOPS,
        "run_columns": RUN_COLUMNS,
        "runs": runs,
        "vaxis": vaxis,
    }
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    print("wrote", out, len(runs), "runs", out.stat().st_size, "bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=str(Path.home() / "IdeaProjects/skill.state-paper"))
    parser.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "site/data.json"))
    args = parser.parse_args()
    build(args.repo, args.out)
