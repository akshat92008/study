'use client';

import { Bot } from 'lucide-react';
import { memo } from 'react';

export const ThinkingIndicator = memo(function ThinkingIndicator({
  label = 'Amaura is thinking',
}: {
  label?: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/10 text-violet-300">
        <Bot className="h-4 w-4" />
      </div>

      <div className="max-w-[80%] rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <div className="mb-2 text-xs font-medium text-zinc-400">
          {label}
        </div>

        <div className="flex items-center gap-1.5" aria-label="Thinking">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-300 animate-bounce [animation-delay:-0.24s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-violet-300 animate-bounce [animation-delay:-0.12s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-violet-300 animate-bounce" />
        </div>
      </div>
    </div>
  );
});
