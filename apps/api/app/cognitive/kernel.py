"""CognitiveKernel — orchestrates the full Veyra Cognitive OS pipeline."""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

from app import llm
from app.cognitive.ethics import run_ethics_gate
from app.cognitive.faculties import faculties_summary, select_faculties
from app.cognitive.modes import get_mode
from app.cognitive.prompts import INTEGRATOR_PROMPT, VEYRA_META_BRAIN
from app.cognitive.selves import format_selves_block, run_inner_chorus
from app.cognitive.temporal import load_temporal_layers
from app.cognitive_memory import record_trace_event


@dataclass
class ThinkingStep:
    phase: str
    label: str
    detail: str | None = None


@dataclass
class CognitiveResult:
    response: str
    model: str
    tokens_used: int
    thinking_steps: list[ThinkingStep] = field(default_factory=list)
    ethics: dict[str, Any] = field(default_factory=dict)
    faculties: list[dict[str, Any]] = field(default_factory=list)
    inner_voices: list[dict[str, Any]] = field(default_factory=list)
    temporal: dict[str, str] = field(default_factory=dict)
    mode: str = "inner_voice"


class CognitiveKernel:
    """Unified cognitive orchestration kernel for all Veyra surfaces."""

    async def process(
        self,
        *,
        user_id: str,
        session_id: str,
        message: str,
        history: list[dict[str, str]],
        cognitive_mode: str = "inner_voice",
        quality_mode: str | None = None,
        custom_instructions: str | None = None,
        use_rag: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> CognitiveResult:
        mode = get_mode(cognitive_mode)
        steps: list[ThinkingStep] = []
        total_tokens = 0

        if cognitive_mode == "standard":
            result = await llm.generate_chat_response(
                message=message,
                history=history,
                quality_mode=quality_mode,
                custom_instructions=custom_instructions,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return CognitiveResult(
                response=result["response"],
                model=result["model"],
                tokens_used=result["tokens_used"],
                mode="standard",
            )

        temporal = load_temporal_layers(user_id=user_id, history=history, message=message)
        steps.append(ThinkingStep("temporal", "Loading hierarchical time mind", "Micro · Meso · Macro layers"))
        self._trace(user_id, session_id, steps[-1])

        ethics = await run_ethics_gate(message=message, micro_context=temporal["micro"], quality_mode=quality_mode)
        total_tokens += 64
        risk = ", ".join(ethics.get("risk_flags") or []) or "none"
        steps.append(
            ThinkingStep(
                "ethics",
                "Emotion–ethics control loop",
                f"State: {ethics.get('emotional_state')} · tone: {ethics.get('desired_tone')} · risks: {risk}",
            )
        )
        self._trace(user_id, session_id, steps[-1], metadata=ethics)

        faculties = select_faculties(message, use_rag=use_rag)
        steps.append(
            ThinkingStep("faculties", "Activating cognitive faculties", faculties_summary(faculties))
        )
        self._trace(user_id, session_id, steps[-1])

        voices, voice_tokens = await run_inner_chorus(
            message=message,
            temporal=temporal,
            mode=mode,
            quality_mode=quality_mode,
        )
        total_tokens += voice_tokens
        role_names = ", ".join(v["role"].title() for v in voices) or "none"
        steps.append(ThinkingStep("selves", "Polyphonic inner chorus", f"Voices: {role_names}"))
        self._trace(user_id, session_id, steps[-1], metadata={"roles": [v["role"] for v in voices]})

        integrator_message = INTEGRATOR_PROMPT.format(
            selves_block=format_selves_block(voices),
            emotional_state=ethics.get("emotional_state", "neutral"),
            desired_tone=ethics.get("desired_tone", "warm"),
            safety_level=ethics.get("safety_level", "low"),
            micro=temporal["micro"][:600],
            meso=temporal["meso"][:400],
            macro=temporal["macro"][:400],
            faculties=faculties_summary(faculties),
        )

        system_parts = [VEYRA_META_BRAIN, f"[MODE: {mode['label']}]\n{mode['description']}"]
        if ethics.get("safety_level") == "high":
            system_parts.append(
                "SAFETY: User may be in distress. Prioritize validation, de-escalation, and encourage real-world support."
            )
        if custom_instructions and custom_instructions.strip():
            system_parts.append(f"User instructions:\n{custom_instructions.strip()}")

        steps.append(ThinkingStep("integrate", "Integrating inner chorus", f"Mode: {mode['label']}"))
        self._trace(user_id, session_id, steps[-1])

        result = await llm.generate_chat_response(
            message=f"{integrator_message}\n\nUser message: {message}",
            history=history,
            quality_mode=quality_mode,
            temperature=temperature,
            max_tokens=max_tokens,
            custom_instructions="\n\n".join(system_parts),
        )
        total_tokens += result.get("tokens_used", 0)

        steps.append(ThinkingStep("synthesize", "Composing unified response", "Cognitive integration complete"))
        self._trace(user_id, session_id, steps[-1])

        return CognitiveResult(
            response=result["response"],
            model=result["model"],
            tokens_used=total_tokens,
            thinking_steps=steps,
            ethics=ethics,
            faculties=faculties,
            inner_voices=voices,
            temporal=temporal,
            mode=cognitive_mode,
        )

    async def stream(
        self,
        *,
        user_id: str,
        session_id: str,
        message: str,
        history: list[dict[str, str]],
        cognitive_mode: str = "inner_voice",
        quality_mode: str | None = None,
        custom_instructions: str | None = None,
        use_rag: bool = False,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield thinking steps, then token chunks, then done."""
        if cognitive_mode == "standard":
            async for chunk in llm.stream_chat_response(
                message=message,
                history=history,
                quality_mode=quality_mode,
                custom_instructions=custom_instructions,
                temperature=temperature,
                max_tokens=max_tokens,
            ):
                yield chunk
            return

        result = await self.process(
            user_id=user_id,
            session_id=session_id,
            message=message,
            history=history,
            cognitive_mode=cognitive_mode,
            quality_mode=quality_mode,
            custom_instructions=custom_instructions,
            use_rag=use_rag,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        for step in result.thinking_steps:
            yield {
                "type": "thinking",
                "phase": step.phase,
                "label": step.label,
                "detail": step.detail,
            }

        # Stream integrator output word-by-word for UX continuity
        words = result.response.split(" ")
        for i, word in enumerate(words):
            token = word if i == 0 else f" {word}"
            yield {"type": "token", "content": token}

        yield {
            "type": "done",
            "model": result.model,
            "tokens_used": result.tokens_used,
            "cognitive": {
                "mode": result.mode,
                "ethics": result.ethics,
                "faculties": result.faculties,
                "inner_voices": [{"role": v["role"], "weight": v.get("weight")} for v in result.inner_voices],
            },
        }

    def _trace(
        self,
        user_id: str,
        session_id: str,
        step: ThinkingStep,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        try:
            record_trace_event(
                user_id,
                session_id=session_id,
                phase=step.phase,
                label=step.label,
                detail=step.detail,
                metadata=metadata,
            )
        except Exception:
            pass