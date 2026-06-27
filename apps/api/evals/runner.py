"""Veyra evaluation harness / benchmark runner.

Runs a JSONL dataset of objectives through either the LangGraph runtime
(``--mode graph``) or a single chat completion (``--mode chat``), scores each
case, and prints/writes a benchmark report.

Usage:
    python -m evals.runner --dataset evals/dataset.jsonl
    python -m evals.runner --dataset evals/dataset.jsonl --mode chat --output report.json

Set MOCK_LLM=1 to run deterministically without a live model (used in CI).
"""

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Any

from app import llm
from app.graph.builder import run_graph
from evals.scorer import CaseScore, score_case


def load_dataset(path: str) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Dataset not found: {file_path}")
    for line in file_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            cases.append(json.loads(line))
    return cases


async def _run_case(case: dict[str, Any], mode: str) -> tuple[str, float]:
    goal = case["goal"]
    if mode == "graph":
        state = await run_graph(goal)
        answer = state.get("final", "") or ""
        critic_score = float(state.get("critique", {}).get("score", 0.0))
        return answer, critic_score

    result = await llm.generate_chat_response(message=goal, history=[])
    return result.get("response", ""), 1.0


async def run_benchmark(dataset: str, mode: str) -> list[CaseScore]:
    cases = load_dataset(dataset)
    scores: list[CaseScore] = []
    for case in cases:
        answer, critic_score = await _run_case(case, mode)
        scores.append(
            score_case(
                case["id"],
                answer,
                case.get("expected_keywords", []),
                critic_score,
                min_score=float(case.get("min_score", 0.5)),
            )
        )
    return scores


def _report(scores: list[CaseScore], mode: str, elapsed: float) -> dict[str, Any]:
    passed = sum(1 for s in scores if s.passed)
    total = len(scores)
    avg = round(sum(s.score for s in scores) / total, 3) if total else 0.0
    return {
        "mode": mode,
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "pass_rate": round(passed / total, 3) if total else 0.0,
        "average_score": avg,
        "elapsed_seconds": round(elapsed, 2),
        "cases": [
            {
                "id": s.case_id,
                "score": s.score,
                "keyword_coverage": s.keyword_coverage,
                "critic_score": s.critic_score,
                "passed": s.passed,
                "detail": s.detail,
            }
            for s in scores
        ],
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Veyra eval benchmark runner")
    parser.add_argument("--dataset", default="evals/dataset.jsonl")
    parser.add_argument("--mode", choices=["graph", "chat"], default="graph")
    parser.add_argument("--output", default=None, help="Write JSON report to this path")
    parser.add_argument("--min-pass-rate", type=float, default=0.0, help="Exit non-zero below this pass rate")
    args = parser.parse_args(argv)

    start = time.time()
    scores = asyncio.run(run_benchmark(args.dataset, args.mode))
    report = _report(scores, args.mode, time.time() - start)

    print(json.dumps(report, indent=2))
    for case in report["cases"]:
        flag = "PASS" if case["passed"] else "FAIL"
        print(f"  [{flag}] {case['id']:<24} score={case['score']}")
    print(f"\n{report['passed']}/{report['total']} passed | avg={report['average_score']} | mode={report['mode']}")

    if args.output:
        Path(args.output).write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"Report written to {args.output}")

    if report["pass_rate"] < args.min_pass_rate:
        print(f"Pass rate {report['pass_rate']} below threshold {args.min_pass_rate}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
