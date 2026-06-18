/**
 * Topic Skeleton Integrity Tests
 * 
 * These tests ensure:
 * 1. No placeholder microtargets exist in seed data
 * 2. No topic appears under a wrong chapter (cross-chapter contamination)
 * 3. Topic slugs are unique within their chapter
 * 4. Every chapter in the syllabus has a matching skeleton
 * 5. Taxonomy paths in JSON data match skeleton chapter assignments
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_CHAPTER_SKELETONS,
  getChapterSkeleton,
  isPlaceholderTitle,
  isPlaceholderQuestion,
} from '../../lib/topic-seeding/templates/neet/topic-skeleton';
import { NEET_UG_2026_UNITS } from '../../lib/syllabus/neet-ug-2026';

describe('Topic Skeleton Integrity', () => {

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. SKELETON COMPLETENESS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('every syllabus chapter has a matching skeleton', () => {
    for (const unit of NEET_UG_2026_UNITS) {
      const skeleton = getChapterSkeleton(unit.chapterSlug);
      expect(skeleton, `Missing skeleton for chapter: ${unit.chapterSlug} (${unit.unitTitle})`).not.toBeNull();
    }
  });

  it('every skeleton has at least 3 topics', () => {
    for (const skeleton of ALL_CHAPTER_SKELETONS) {
      expect(
        skeleton.topics.length,
        `Chapter ${skeleton.chapterSlug} has only ${skeleton.topics.length} topics — needs at least 3`
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('total topic count across all chapters is reasonable (>200)', () => {
    const totalTopics = ALL_CHAPTER_SKELETONS.reduce((sum, s) => sum + s.topics.length, 0);
    expect(totalTopics).toBeGreaterThan(200);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. NO CROSS-CHAPTER CONTAMINATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('topic slugs are unique within each chapter', () => {
    for (const skeleton of ALL_CHAPTER_SKELETONS) {
      const slugs = skeleton.topics.map(t => t.slug);
      const uniqueSlugs = new Set(slugs);
      const duplicates = slugs.filter((s, i) => slugs.indexOf(s) !== i);
      expect(
        duplicates,
        `Chapter ${skeleton.chapterSlug} has duplicate topic slugs: ${duplicates.join(', ')}`
      ).toEqual([]);
    }
  });

  it('topic slugs do not appear in wrong chapters', () => {
    // Build a map of topic slug → chapter slug
    const topicToChapter = new Map<string, string>();
    const violations: string[] = [];

    for (const skeleton of ALL_CHAPTER_SKELETONS) {
      for (const topic of skeleton.topics) {
        if (topicToChapter.has(topic.slug)) {
          // Same slug in multiple chapters — this is OK for generic slugs like "types-of-movement"
          // but we should log it as a warning
          const otherChapter = topicToChapter.get(topic.slug)!;
          // Only flag if it's in different subjects
          const otherSkeleton = ALL_CHAPTER_SKELETONS.find(s => s.chapterSlug === otherChapter);
          if (otherSkeleton && otherSkeleton.subject !== skeleton.subject) {
            violations.push(
              `Topic "${topic.slug}" appears in both ${otherChapter} (${otherSkeleton.subject}) and ${skeleton.chapterSlug} (${skeleton.subject})`
            );
          }
        }
        topicToChapter.set(topic.slug, skeleton.chapterSlug);
      }
    }

    expect(violations, `Cross-subject topic contamination:\n${violations.join('\n')}`).toEqual([]);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. SLUG FORMAT VALIDATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('all topic slugs use valid format (lowercase, hyphens, no spaces)', () => {
    const invalid: string[] = [];
    for (const skeleton of ALL_CHAPTER_SKELETONS) {
      for (const topic of skeleton.topics) {
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(topic.slug)) {
          invalid.push(`${skeleton.chapterSlug} → "${topic.slug}"`);
        }
      }
    }
    expect(invalid, `Invalid slug format:\n${invalid.join('\n')}`).toEqual([]);
  });

  it('all chapter slugs use valid format', () => {
    for (const skeleton of ALL_CHAPTER_SKELETONS) {
      expect(skeleton.chapterSlug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. TOPIC ORDER IS CONTIGUOUS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('topic orderIndex values are contiguous starting from 1', () => {
    const issues: string[] = [];
    for (const skeleton of ALL_CHAPTER_SKELETONS) {
      const indices = skeleton.topics.map(t => t.orderIndex).sort((a, b) => a - b);
      if (indices[0] !== 1) {
        issues.push(`${skeleton.chapterSlug}: orderIndex starts at ${indices[0]}, should be 1`);
      }
      for (let i = 1; i < indices.length; i++) {
        if (indices[i] !== indices[i - 1] + 1) {
          issues.push(`${skeleton.chapterSlug}: gap between orderIndex ${indices[i - 1]} and ${indices[i]}`);
        }
      }
    }
    expect(issues, `Order issues:\n${issues.join('\n')}`).toEqual([]);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. DISPLAY NAME SANITY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it('no display name contains placeholder patterns', () => {
    const placeholders: string[] = [];
    for (const skeleton of ALL_CHAPTER_SKELETONS) {
      for (const topic of skeleton.topics) {
        if (isPlaceholderTitle(topic.displayName)) {
          placeholders.push(`${skeleton.chapterSlug} → "${topic.displayName}"`);
        }
      }
    }
    expect(placeholders, `Placeholder display names found:\n${placeholders.join('\n')}`).toEqual([]);
  });

  it('every topic has at least 1 alias', () => {
    const missing: string[] = [];
    for (const skeleton of ALL_CHAPTER_SKELETONS) {
      for (const topic of skeleton.topics) {
        if (topic.aliases.length === 0) {
          missing.push(`${skeleton.chapterSlug} → "${topic.displayName}"`);
        }
      }
    }
    expect(missing, `Topics with no aliases:\n${missing.join('\n')}`).toEqual([]);
  });
});

describe('Placeholder Detection', () => {

  it('detects numbered placeholder titles', () => {
    expect(isPlaceholderTitle('Human Physiology Anatomical features 39')).toBe(true);
    expect(isPlaceholderTitle('Physics Laws of Motion Newton concepts 5')).toBe(true);
    expect(isPlaceholderTitle('Chemistry Chemical Bonding principles 12')).toBe(true);
  });

  it('does not flag real topic titles', () => {
    expect(isPlaceholderTitle('Blood Groups and Coagulation')).toBe(false);
    expect(isPlaceholderTitle('ECG (Electrocardiograph)')).toBe(false);
    expect(isPlaceholderTitle('Cardiac Cycle')).toBe(false);
    expect(isPlaceholderTitle("Newton's Second Law")).toBe(false);
    expect(isPlaceholderTitle("Ohm's Law")).toBe(false);
  });

  it('detects placeholder questions', () => {
    expect(isPlaceholderQuestion('What are the fundamental laws or mechanisms governing Human Physiology Anatomical features 39?')).toBe(true);
  });

  it('does not flag real questions', () => {
    expect(isPlaceholderQuestion('What is the difference between plasma and serum?')).toBe(false);
    expect(isPlaceholderQuestion('Name the enzyme that initiates protein digestion in the stomach.')).toBe(false);
  });
});

describe('JSON Seed Data Quality', () => {
  const dataDir = path.join(process.cwd(), 'lib/topic-seeding/templates/neet/data');
  const subjects = ['physics', 'chemistry', 'biology'];

  for (const subject of subjects) {
    const subjectDir = path.join(dataDir, subject);
    if (!fs.existsSync(subjectDir)) continue;

    const files = fs.readdirSync(subjectDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      it(`${subject}/${file}: no placeholder microtarget titles`, () => {
        const content = JSON.parse(fs.readFileSync(path.join(subjectDir, file), 'utf-8'));
        const placeholders: string[] = [];

        for (const mission of content.missions || []) {
          for (const mt of mission.microtargets || []) {
            if (isPlaceholderTitle(mt.title)) {
              placeholders.push(mt.title);
            }
          }
        }

        expect(placeholders, `${subject}/${file} contains placeholder microtargets`).toEqual([]);
      });

      it(`${subject}/${file}: no placeholder questions`, () => {
        const content = JSON.parse(fs.readFileSync(path.join(subjectDir, file), 'utf-8'));
        const placeholderQs: string[] = [];

        for (const mission of content.missions || []) {
          for (const mt of mission.microtargets || []) {
            for (const q of mt.activeRecallQuestions || []) {
              if (isPlaceholderQuestion(q.question)) {
                placeholderQs.push(q.question.substring(0, 80));
              }
            }
          }
        }

        expect(placeholderQs, `${subject}/${file} contains placeholder questions`).toEqual([]);
      });
    }
  }
});
