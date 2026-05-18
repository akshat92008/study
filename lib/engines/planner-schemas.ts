import { z } from 'zod';

export const MissionTaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(['study', 'revision', 'practice', 'mock_test', 'break', 'review']),
  subject: z.string().nullable().optional(),
  chapter: z.string().nullable().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  estimated_minutes: z.number().int().min(5).max(180),
  scheduled_start_time: z.string().nullable().optional(), // HH:mm format
  rationale: z.string(), // Explainability: Why was this scheduled?
});

export const DailyMissionSchema = z.object({
  missionScore: z.number().min(0).max(100), // Overall intensity/importance of today
  estimatedTotalHours: z.number().min(0.5).max(14),
  breakRecommendation: z.string(),
  tasks: z.array(MissionTaskSchema),
});
