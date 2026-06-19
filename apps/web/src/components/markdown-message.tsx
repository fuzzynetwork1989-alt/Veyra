"use client";

import { useMemo } from "react";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, '<code class="rounded bg-zinc-800 px-1 py-0.5 text-violet-300">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-violet-400 underline" target="_blank" rel="noreferrer">$1</a>'
  );
  return out;
}

export function MarkdownMessage({ content, compact }: { content: string; compact?: boolean }) {
  const html = useMemo(() => {
    const blocks = content.split(/```/);
    const parts: string[] = [];

    blocks.forEach((block, index) => {
      if (index % 2 === 1) {
        const lines = block.split("\n");
        const lang = lines[0]?.trim() || "";
        const code = lines.slice(1).join("\n");
        parts.push(
          `<pre class="my-2 overflow-x-auto rounded-xl border border-white/10 bg-zinc-950 p-3 text-xs"><code data-lang="${escapeHtml(lang)}">${escapeHtml(code)}</code></pre>`
        );
      } else {
        block.split("\n\n").forEach((para) => {
          if (!para.trim()) return;
          if (para.startsWith("### ")) {
            parts.push(`<h4 class="mb-1 mt-2 text-sm font-semibold text-zinc-200">${renderInline(para.slice(4))}</h4>`);
          } else if (para.startsWith("## ")) {
            parts.push(`<h3 class="mb-1 mt-2 text-base font-semibold text-zinc-100">${renderInline(para.slice(3))}</h3>`);
          } else if (para.startsWith("# ")) {
            parts.push(`<h2 class="mb-1 mt-2 text-lg font-semibold text-zinc-100">${renderInline(para.slice(2))}</h2>`);
          } else if (para.startsWith("- ") || para.startsWith("* ")) {
            const items = para
              .split("\n")
              .map((line) => `<li>${renderInline(line.replace(/^[-*]\s/, ""))}</li>`)
              .join("");
            parts.push(`<ul class="my-2 list-disc space-y-1 pl-5 text-sm">${items}</ul>`);
          } else {
            parts.push(
              `<p class="${compact ? "my-1" : "my-2"} text-sm leading-relaxed whitespace-pre-wrap">${renderInline(para)}</p>`
            );
          }
        });
      }
    });

    return parts.join("");
  }, [content, compact]);

  return (
    <div
      className="prose-invert max-w-none text-zinc-200"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}