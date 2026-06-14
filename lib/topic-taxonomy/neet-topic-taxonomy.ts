import { ALL_NEET_CHAPTER_SEEDS } from '../topic-seeding/templates/neet';
import type { NeetTopicNode, WeakAreaGranularity, ConceptWeakness, NeetTaxonomyNodeType } from './types';

// Flatten the hierarchical 50 generated seeds into an array of TopicNodes
function buildTaxonomy(): NeetTopicNode[] {
  const nodes: NeetTopicNode[] = [];
  const addedSlugs = new Set<string>();

  function addNode(node: NeetTopicNode) {
    if (!addedSlugs.has(node.slug)) {
      nodes.push(node);
      addedSlugs.add(node.slug);
    }
  }

  for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
    // We can infer Subject and Chapter nodes
    const subjectSlug = chapter.subject.toLowerCase();
    
    // Add subject
    addNode({
      id: `subj-${subjectSlug}`,
      slug: subjectSlug,
      title: chapter.subject,
      type: "subject",
      subject: chapter.subject,
      unitSlug: chapter.chapterSlug, // approximations
      chapterSlug: chapter.chapterSlug,
      path: [chapter.subject],
      aliases: [],
      conceptTags: [],
    });

    // Add chapter
    addNode({
      id: `chap-${chapter.chapterSlug}`,
      slug: chapter.chapterSlug,
      title: chapter.chapterTitle,
      type: "chapter",
      subject: chapter.subject,
      unitSlug: chapter.chapterSlug,
      chapterSlug: chapter.chapterSlug,
      parentSlug: subjectSlug,
      path: [chapter.subject, chapter.chapterTitle],
      aliases: chapter.aliases,
      conceptTags: [],
    });

    // Iterate missions to extract Topic, Subtopic, Concept, Microskill from Questions
    for (const mission of chapter.missions) {
      for (const mt of mission.microtargets) {
        if (!mt.activeRecallQuestions) continue;

        for (const q of mt.activeRecallQuestions) {
          if (!q.taxonomyPath) continue;
          
          const tp = q.taxonomyPath;
          
          const topicNode: NeetTopicNode = {
            id: `topic-${tp.topicSlug}`,
            slug: tp.topicSlug,
            title: tp.topicSlug.replace(/-/g, ' '),
            type: "topic",
            subject: tp.subject,
            unitSlug: tp.unitSlug,
            chapterSlug: tp.chapterSlug,
            parentSlug: tp.chapterSlug,
            path: [chapter.subject, chapter.chapterTitle, tp.topicSlug],
            aliases: [],
            conceptTags: [],
          };
          addNode(topicNode);

          const subtopicNode: NeetTopicNode = {
            id: `subtopic-${tp.subtopicSlug}`,
            slug: tp.subtopicSlug,
            title: tp.subtopicSlug.replace(/-/g, ' '),
            type: "subtopic",
            subject: tp.subject,
            unitSlug: tp.unitSlug,
            chapterSlug: tp.chapterSlug,
            parentSlug: tp.topicSlug,
            path: [chapter.subject, chapter.chapterTitle, tp.topicSlug, tp.subtopicSlug],
            aliases: [],
            conceptTags: [],
          };
          addNode(subtopicNode);

          const conceptNode: NeetTopicNode = {
            id: `concept-${tp.conceptSlug}`,
            slug: tp.conceptSlug,
            title: tp.conceptSlug.replace(/-/g, ' '),
            type: "concept",
            subject: tp.subject,
            unitSlug: tp.unitSlug,
            chapterSlug: tp.chapterSlug,
            parentSlug: tp.subtopicSlug,
            path: [chapter.subject, chapter.chapterTitle, tp.topicSlug, tp.subtopicSlug, tp.conceptSlug],
            aliases: [],
            conceptTags: q.conceptTags,
          };
          addNode(conceptNode);

          const skillNode: NeetTopicNode = {
            id: `skill-${tp.microskillSlug}`,
            slug: tp.microskillSlug,
            title: tp.microskillSlug.replace(/-/g, ' '),
            type: "microskill",
            subject: tp.subject,
            unitSlug: tp.unitSlug,
            chapterSlug: tp.chapterSlug,
            parentSlug: tp.conceptSlug,
            path: [chapter.subject, chapter.chapterTitle, tp.topicSlug, tp.subtopicSlug, tp.conceptSlug, tp.microskillSlug],
            aliases: [],
            conceptTags: q.conceptTags,
          };
          addNode(skillNode);

          if (q.errorPatterns) {
            for (const ep of q.errorPatterns) {
              const epNode: NeetTopicNode = {
                id: `error-${ep.slug}`,
                slug: ep.slug,
                title: ep.slug.replace(/-/g, ' '),
                type: "error_pattern",
                subject: tp.subject,
                unitSlug: tp.unitSlug,
                chapterSlug: tp.chapterSlug,
                parentSlug: tp.microskillSlug,
                path: [chapter.subject, chapter.chapterTitle, tp.topicSlug, tp.subtopicSlug, tp.conceptSlug, tp.microskillSlug, ep.slug],
                aliases: [],
                conceptTags: [],
              };
              addNode(epNode);
            }
          }
        }
      }
    }
  }

  return nodes;
}

export const NEET_TOPIC_TAXONOMY = buildTaxonomy();

export function getTopicNodeBySlug(slug: string): NeetTopicNode | undefined {
  return NEET_TOPIC_TAXONOMY.find(n => n.slug === slug);
}

export function getChildrenOfTopic(slug: string): NeetTopicNode[] {
  return NEET_TOPIC_TAXONOMY.filter(n => n.parentSlug === slug);
}

export function getTopicPath(slug: string): string[] {
  const node = getTopicNodeBySlug(slug);
  return node ? node.path : [];
}

export function getChapterTopics(chapterSlug: string): NeetTopicNode[] {
  return NEET_TOPIC_TAXONOMY.filter(n => n.chapterSlug === chapterSlug && n.type === 'topic');
}

export function getWeakAreaDisplayPath(weakness: Partial<ConceptWeakness>): string[] {
  if (weakness.displayPath && weakness.displayPath.length > 0) {
    return weakness.displayPath;
  }
  
  const path: string[] = [];
  if (weakness.chapterSlug) path.push(weakness.chapterSlug.replace(/-/g, ' '));
  if (weakness.topicSlug) path.push(weakness.topicSlug.replace(/-/g, ' '));
  if (weakness.subtopicSlug) path.push(weakness.subtopicSlug.replace(/-/g, ' '));
  if (weakness.conceptSlug) path.push(weakness.conceptSlug.replace(/-/g, ' '));
  if (weakness.microskillSlug) path.push(weakness.microskillSlug.replace(/-/g, ' '));
  if (weakness.errorPatternSlug) path.push(weakness.errorPatternSlug.replace(/-/g, ' '));
  
  return path;
}

export function resolveConceptFromQuestion(questionId: string) {
  for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
    for (const mission of chapter.missions) {
      for (const mt of mission.microtargets) {
        if (!mt.activeRecallQuestions) continue;
        const q = mt.activeRecallQuestions.find(x => x.id === questionId);
        if (q && q.taxonomyPath) {
          return {
            taxonomyPath: q.taxonomyPath,
            conceptTags: q.conceptTags,
            errorPatterns: q.errorPatterns || []
          };
        }
      }
    }
  }
  return null;
}

export function resolveConceptFromTags(conceptTags: string[]) {
  // A naive implementation finding the first node containing some of these tags
  for (const tag of conceptTags) {
    const match = NEET_TOPIC_TAXONOMY.find(n => n.conceptTags.includes(tag) && (n.type === 'concept' || n.type === 'microskill'));
    if (match) return match;
  }
  return null;
}
