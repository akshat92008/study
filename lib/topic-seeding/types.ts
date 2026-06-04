export type SeedSource = 'seeded_template' | 'custom_seed' | 'ai_seed';
export interface SeedTemplateTopic {
  topic: string;
  microtarget: string;
  orderIndex: number;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
}
export interface SeedTemplate {
  templateKey: string;
  subject: string;
  chapter: string;
  displayName: string;
  aliases: string[];
  topics: SeedTemplateTopic[];
}
export interface SeedTopicParams {
  userId: string;
  goalId: string;
  goalTitle: string;
  goalType?: string | null;
  presetId?: string | null;
  subjects?: string[] | null;
  subject?: string | null;
  chapter?: string | null;
  targetDate?: string | null;
}
export interface SeedTopicResult {
  seeded: number;
  conceptsSeeded: number;
  skipped: boolean;
  templateKey: string;
  source: SeedSource;
  reason?: string;
}
export interface SelectedSeedTemplate {
  template: SeedTemplate;
  templateKey: string;
  source: SeedSource;
  confidence: number;
}
