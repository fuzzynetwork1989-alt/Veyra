"""Scoring helpers for the eval harness."""

from dataclasses import dataclass


@dataclass
class CaseScore:
    case_id: str
    keyword_coverage: float
    critic_score: float
    score: float
    passed: bool
    detail: str


def keyword_coverage(answer: str, keywords: list[str]) -> float:
    if not keywords:
        return 1.0
    lowered = (answer or "").lower()
    hits = sum(1 for kw in keywords if kw.lower() in lowered)
    return round(hits / len(keywords), 3)


def score_case(
    case_id: str,
    answer: str,
    keywords: list[str],
    critic_score: float,
    *,
    min_score: float = 0.5,
) -> CaseScore:
    coverage = keyword_coverage(answer, keywords)
    # Blend retrieval-style keyword coverage with the runtime critic verdict.
    combined = round(0.6 * coverage + 0.4 * float(critic_score or 0.0), 3)
    passed = combined >= min_score
    detail = f"coverage={coverage} critic={critic_score}"
    return CaseScore(
        case_id=case_id,
        keyword_coverage=coverage,
        critic_score=float(critic_score or 0.0),
        score=combined,
        passed=passed,
        detail=detail,
    )
