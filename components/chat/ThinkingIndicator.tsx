'use client';

import { Bot } from 'lucide-react';

export function ThinkingIndicator({
  label = 'Amaura is thinking',
}: {
  label?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 shadow-[0_0_20px_rgba(139,92,246,0.18)]">
        <Bot className="h-4 w-4" />
      </div>
      <div className="max-w-[80%] rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-400">
          <span>{label}</span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-300" />
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-violet-300 [animation-delay:-0.32s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-violet-300 [animation-delay:-0.16s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-violet-300" />
        </div>
      </div>
    </div>
  );
}
