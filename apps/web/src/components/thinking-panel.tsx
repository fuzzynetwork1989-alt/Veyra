"use client";

import { BrainWave } from "@/components/brain-wave";
import { IconBrain } from "@/components/icons";

export type ThinkingStep = {
  phase: string;
  label: string;
  detail?: string;
};

export function ThinkingPanel({
  steps,
  active,
}: {
  steps: ThinkingStep[];
  active: boolean;
}) {
  if (!active && steps.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20 text-violet-300">
          <IconBrain className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-violet-200">Neural processing</p>
          <p className="text-xs text-zinc-500">Observing how Veyra reasons through your request</p>
        </div>
        <BrainWave active={active} className="h-6" />
      </div>
      <div className="space-y-1.5 pl-11">
        {steps.map((step, index) => (
          <div
            key={`${step.phase}-${index}`}
            className="flex items-start gap-2 text-xs text-zinc-400"
          >
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                index === steps.length - 1 && active
                  ? "animate-pulse bg-cyan-400"
                  : "bg-violet-500/60"
              }`}
            />
            <div>
              <span className="text-zinc-300">{step.label}</span>
              {step.detail ? <span className="ml-1 text-zinc-500">— {step.detail}</span> : null}
            </div>
          </div>
        ))}
        {active && steps.length === 0 ? (
          <p className="text-xs text-zinc-500 animate-pulse">Initializing cognitive pipeline…</p>
        ) : null}
      </div>
    </div>
  );
}