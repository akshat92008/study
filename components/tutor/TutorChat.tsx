// components/tutor/TutorChat.tsx
'use client';

import { GlobalChat } from '@/components/chat/GlobalChat';
import { AgentActivityFeed } from '@/components/amaura/AgentActivityFeed';

export default function TutorChat() {
  return (
    <div className="flex flex-col md:flex-row gap-[var(--sp-4)] h-full">
      <div className="flex-1 min-h-0 h-full">
        <GlobalChat />
      </div>
      <div className="hidden md:block w-[380px] flex-shrink-0">
        <AgentActivityFeed />
      </div>
    </div>
  );
}
