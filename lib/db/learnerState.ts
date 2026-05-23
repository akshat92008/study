// lib/db/learnerState.ts

import { pgTable, uuid, numeric, timestamp, text, jsonb } from 'drizzle-orm/pg-core';

export const learnerState = pgTable('learner_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  conceptId: uuid('concept_id').notNull(),
  masteryScore: numeric('mastery_score', { precision: 5, scale: 4 }).notNull().default('0.0'),
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
});

export const learnerEvent = pgTable('learner_event', {
  id: uuid('id').primaryKey().defaultRandom(), // using uuid for simplicity instead of BIGSERIAL
  userId: uuid('user_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
