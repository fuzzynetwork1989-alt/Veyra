"use client";

import { cn } from "@veyra/ui";

export function BrainWave({ active = true, className }: { active?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-end gap-0.5", className)} aria-hidden>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <span
          key={i}
          className={cn(
            "w-1 rounded-full bg-gradient-to-t from-violet-600 to-cyan-400",
            active ? "animate-brain-wave" : "h-1 opacity-40"
          )}
          style={{
            animationDelay: active ? `${i * 0.12}s` : undefined,
            height: active ? undefined : "4px",
          }}
        />
      ))}
    </div>
  );
}