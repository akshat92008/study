export interface ConversationPart {
  type: 'text' | 'image' | 'tool';
  content: string;
}

export interface ConversationTurn {
  role: 'user' | 'model' | 'system' | 'tool';
  content: string; // simplified to plain string for now
  metadata?: {
    sessionId?: string;
    conceptRefs?: string[];
    emotionalState?: string;
    masteryRefs?: string[];
  };
  timestamp: string; // ISO timestamp
}
