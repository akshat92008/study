import { ChapterSeed } from '../../../types';

export const chemical_kinetics_seed: ChapterSeed = {
  exam: "NEET",
  syllabusVersion: "NEET_UG_2026",
  subject: "Chemistry",
  unitNumber: 8,
  unitTitle: "Chemical Kinetics",
  chapterSlug: "chemical-kinetics",
  chapterTitle: "Chemical Kinetics",
  classLevel: "12",
  aliases: ["kinetics","rate of reaction"],
  ncertMapping: ["Chemical Kinetics"],
  prerequisites: [],
  estimatedHours: 8,
  priority: "high",
  missions: [
    {
      id: "chemical-kinetics-m-0",
      title: "Kinetics and Rate law Essentials",
      description: "A comprehensive mission covering kinetics and rate law.",
      conceptTags: ["kinetics", "rate_law"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "chemical-kinetics-mt-0-0",
        title: "Mastering Kinetics and Rate law",
        conceptTags: ["kinetics", "rate_law"],
        ncertAnchors: ["NCERT paragraph on kinetics"],
        mustKnowFacts: [
          "The most important fact about kinetics is its relationship with rate law.",
          "Always remember the standard unit and formula for kinetics."
        ],
        formulas: [
          {
            name: "Standard equation for kinetics",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing kinetics with rate law.",
          "Forgetting the sign convention in kinetics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-0-0-0",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-0-1",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-0-2",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-0-3",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-0-4",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on kinetics and rate law.",
          "Assertion-Reason based on kinetics properties."
        ],
        masteryCriteria: [
          "Can accurately define kinetics.",
          "Can solve numericals involving rate law."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-0-1",
        title: "Mastering Kinetics and Rate law",
        conceptTags: ["kinetics", "rate_law"],
        ncertAnchors: ["NCERT paragraph on kinetics"],
        mustKnowFacts: [
          "The most important fact about kinetics is its relationship with rate law.",
          "Always remember the standard unit and formula for kinetics."
        ],
        formulas: [
          {
            name: "Standard equation for kinetics",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing kinetics with rate law.",
          "Forgetting the sign convention in kinetics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-0-1-0",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-1-1",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-1-2",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-1-3",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-1-4",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on kinetics and rate law.",
          "Assertion-Reason based on kinetics properties."
        ],
        masteryCriteria: [
          "Can accurately define kinetics.",
          "Can solve numericals involving rate law."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-0-2",
        title: "Mastering Kinetics and Rate law",
        conceptTags: ["kinetics", "rate_law"],
        ncertAnchors: ["NCERT paragraph on kinetics"],
        mustKnowFacts: [
          "The most important fact about kinetics is its relationship with rate law.",
          "Always remember the standard unit and formula for kinetics."
        ],
        formulas: [
          {
            name: "Standard equation for kinetics",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing kinetics with rate law.",
          "Forgetting the sign convention in kinetics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-0-2-0",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-2-1",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-2-2",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-2-3",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-2-4",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on kinetics and rate law.",
          "Assertion-Reason based on kinetics properties."
        ],
        masteryCriteria: [
          "Can accurately define kinetics.",
          "Can solve numericals involving rate law."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-0-3",
        title: "Mastering Kinetics and Rate law",
        conceptTags: ["kinetics", "rate_law"],
        ncertAnchors: ["NCERT paragraph on kinetics"],
        mustKnowFacts: [
          "The most important fact about kinetics is its relationship with rate law.",
          "Always remember the standard unit and formula for kinetics."
        ],
        formulas: [
          {
            name: "Standard equation for kinetics",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing kinetics with rate law.",
          "Forgetting the sign convention in kinetics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-0-3-0",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-3-1",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-3-2",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-3-3",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-0-3-4",
          question: "What is the primary function or definition of kinetics and rate law in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of kinetics",
            "It interacts with rate law"
          ],
          acceptedSynonyms: ["kinetics principle", "rate law basics"],
          conceptTags: ["kinetics", "rate_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-0",
            subtopicSlug: "kinetics",
            conceptSlug: "rate-law",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-kinetics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that kinetics behaves differently than rate law."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on kinetics and rate law.",
          "Assertion-Reason based on kinetics properties."
        ],
        masteryCriteria: [
          "Can accurately define kinetics.",
          "Can solve numericals involving rate law."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "chemical-kinetics-m-1",
      title: "Rate law and Order Essentials",
      description: "A comprehensive mission covering rate law and order.",
      conceptTags: ["rate_law", "order"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "chemical-kinetics-mt-1-0",
        title: "Mastering Rate law and Order",
        conceptTags: ["rate_law", "order"],
        ncertAnchors: ["NCERT paragraph on rate law"],
        mustKnowFacts: [
          "The most important fact about rate law is its relationship with order.",
          "Always remember the standard unit and formula for rate law."
        ],
        formulas: [
          {
            name: "Standard equation for rate law",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing rate law with order.",
          "Forgetting the sign convention in rate law calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-1-0-0",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-0-1",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-0-2",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-0-3",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-0-4",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on rate law and order.",
          "Assertion-Reason based on rate law properties."
        ],
        masteryCriteria: [
          "Can accurately define rate law.",
          "Can solve numericals involving order."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-1-1",
        title: "Mastering Rate law and Order",
        conceptTags: ["rate_law", "order"],
        ncertAnchors: ["NCERT paragraph on rate law"],
        mustKnowFacts: [
          "The most important fact about rate law is its relationship with order.",
          "Always remember the standard unit and formula for rate law."
        ],
        formulas: [
          {
            name: "Standard equation for rate law",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing rate law with order.",
          "Forgetting the sign convention in rate law calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-1-1-0",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-1-1",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-1-2",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-1-3",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-1-4",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on rate law and order.",
          "Assertion-Reason based on rate law properties."
        ],
        masteryCriteria: [
          "Can accurately define rate law.",
          "Can solve numericals involving order."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-1-2",
        title: "Mastering Rate law and Order",
        conceptTags: ["rate_law", "order"],
        ncertAnchors: ["NCERT paragraph on rate law"],
        mustKnowFacts: [
          "The most important fact about rate law is its relationship with order.",
          "Always remember the standard unit and formula for rate law."
        ],
        formulas: [
          {
            name: "Standard equation for rate law",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing rate law with order.",
          "Forgetting the sign convention in rate law calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-1-2-0",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-2-1",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-2-2",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-2-3",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-2-4",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on rate law and order.",
          "Assertion-Reason based on rate law properties."
        ],
        masteryCriteria: [
          "Can accurately define rate law.",
          "Can solve numericals involving order."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-1-3",
        title: "Mastering Rate law and Order",
        conceptTags: ["rate_law", "order"],
        ncertAnchors: ["NCERT paragraph on rate law"],
        mustKnowFacts: [
          "The most important fact about rate law is its relationship with order.",
          "Always remember the standard unit and formula for rate law."
        ],
        formulas: [
          {
            name: "Standard equation for rate law",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing rate law with order.",
          "Forgetting the sign convention in rate law calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-1-3-0",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-3-1",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-3-2",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-3-3",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-1-3-4",
          question: "What is the primary function or definition of rate law and order in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of rate law",
            "It interacts with order"
          ],
          acceptedSynonyms: ["rate law principle", "order basics"],
          conceptTags: ["rate_law", "order"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-1",
            subtopicSlug: "rate-law",
            conceptSlug: "order",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-rate-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that rate law behaves differently than order."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on rate law and order.",
          "Assertion-Reason based on rate law properties."
        ],
        masteryCriteria: [
          "Can accurately define rate law.",
          "Can solve numericals involving order."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "chemical-kinetics-m-2",
      title: "Order and Molecularity Essentials",
      description: "A comprehensive mission covering order and molecularity.",
      conceptTags: ["order", "molecularity"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "chemical-kinetics-mt-2-0",
        title: "Mastering Order and Molecularity",
        conceptTags: ["order", "molecularity"],
        ncertAnchors: ["NCERT paragraph on order"],
        mustKnowFacts: [
          "The most important fact about order is its relationship with molecularity.",
          "Always remember the standard unit and formula for order."
        ],
        formulas: [
          {
            name: "Standard equation for order",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing order with molecularity.",
          "Forgetting the sign convention in order calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-2-0-0",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-0-1",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-0-2",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-0-3",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-0-4",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on order and molecularity.",
          "Assertion-Reason based on order properties."
        ],
        masteryCriteria: [
          "Can accurately define order.",
          "Can solve numericals involving molecularity."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-2-1",
        title: "Mastering Order and Molecularity",
        conceptTags: ["order", "molecularity"],
        ncertAnchors: ["NCERT paragraph on order"],
        mustKnowFacts: [
          "The most important fact about order is its relationship with molecularity.",
          "Always remember the standard unit and formula for order."
        ],
        formulas: [
          {
            name: "Standard equation for order",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing order with molecularity.",
          "Forgetting the sign convention in order calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-2-1-0",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-1-1",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-1-2",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-1-3",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-1-4",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on order and molecularity.",
          "Assertion-Reason based on order properties."
        ],
        masteryCriteria: [
          "Can accurately define order.",
          "Can solve numericals involving molecularity."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-2-2",
        title: "Mastering Order and Molecularity",
        conceptTags: ["order", "molecularity"],
        ncertAnchors: ["NCERT paragraph on order"],
        mustKnowFacts: [
          "The most important fact about order is its relationship with molecularity.",
          "Always remember the standard unit and formula for order."
        ],
        formulas: [
          {
            name: "Standard equation for order",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing order with molecularity.",
          "Forgetting the sign convention in order calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-2-2-0",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-2-1",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-2-2",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-2-3",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-2-4",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on order and molecularity.",
          "Assertion-Reason based on order properties."
        ],
        masteryCriteria: [
          "Can accurately define order.",
          "Can solve numericals involving molecularity."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-2-3",
        title: "Mastering Order and Molecularity",
        conceptTags: ["order", "molecularity"],
        ncertAnchors: ["NCERT paragraph on order"],
        mustKnowFacts: [
          "The most important fact about order is its relationship with molecularity.",
          "Always remember the standard unit and formula for order."
        ],
        formulas: [
          {
            name: "Standard equation for order",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing order with molecularity.",
          "Forgetting the sign convention in order calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-2-3-0",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-3-1",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-3-2",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-3-3",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-2-3-4",
          question: "What is the primary function or definition of order and molecularity in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of order",
            "It interacts with molecularity"
          ],
          acceptedSynonyms: ["order principle", "molecularity basics"],
          conceptTags: ["order", "molecularity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-2",
            subtopicSlug: "order",
            conceptSlug: "molecularity",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-order",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that order behaves differently than molecularity."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on order and molecularity.",
          "Assertion-Reason based on order properties."
        ],
        masteryCriteria: [
          "Can accurately define order.",
          "Can solve numericals involving molecularity."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "chemical-kinetics-m-3",
      title: "Molecularity and Half life Essentials",
      description: "A comprehensive mission covering molecularity and half life.",
      conceptTags: ["molecularity", "half_life"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "chemical-kinetics-mt-3-0",
        title: "Mastering Molecularity and Half life",
        conceptTags: ["molecularity", "half_life"],
        ncertAnchors: ["NCERT paragraph on molecularity"],
        mustKnowFacts: [
          "The most important fact about molecularity is its relationship with half life.",
          "Always remember the standard unit and formula for molecularity."
        ],
        formulas: [
          {
            name: "Standard equation for molecularity",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing molecularity with half life.",
          "Forgetting the sign convention in molecularity calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-3-0-0",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-0-1",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-0-2",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-0-3",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-0-4",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on molecularity and half life.",
          "Assertion-Reason based on molecularity properties."
        ],
        masteryCriteria: [
          "Can accurately define molecularity.",
          "Can solve numericals involving half life."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-3-1",
        title: "Mastering Molecularity and Half life",
        conceptTags: ["molecularity", "half_life"],
        ncertAnchors: ["NCERT paragraph on molecularity"],
        mustKnowFacts: [
          "The most important fact about molecularity is its relationship with half life.",
          "Always remember the standard unit and formula for molecularity."
        ],
        formulas: [
          {
            name: "Standard equation for molecularity",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing molecularity with half life.",
          "Forgetting the sign convention in molecularity calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-3-1-0",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-1-1",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-1-2",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-1-3",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-1-4",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on molecularity and half life.",
          "Assertion-Reason based on molecularity properties."
        ],
        masteryCriteria: [
          "Can accurately define molecularity.",
          "Can solve numericals involving half life."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-3-2",
        title: "Mastering Molecularity and Half life",
        conceptTags: ["molecularity", "half_life"],
        ncertAnchors: ["NCERT paragraph on molecularity"],
        mustKnowFacts: [
          "The most important fact about molecularity is its relationship with half life.",
          "Always remember the standard unit and formula for molecularity."
        ],
        formulas: [
          {
            name: "Standard equation for molecularity",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing molecularity with half life.",
          "Forgetting the sign convention in molecularity calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-3-2-0",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-2-1",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-2-2",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-2-3",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-2-4",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on molecularity and half life.",
          "Assertion-Reason based on molecularity properties."
        ],
        masteryCriteria: [
          "Can accurately define molecularity.",
          "Can solve numericals involving half life."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-3-3",
        title: "Mastering Molecularity and Half life",
        conceptTags: ["molecularity", "half_life"],
        ncertAnchors: ["NCERT paragraph on molecularity"],
        mustKnowFacts: [
          "The most important fact about molecularity is its relationship with half life.",
          "Always remember the standard unit and formula for molecularity."
        ],
        formulas: [
          {
            name: "Standard equation for molecularity",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing molecularity with half life.",
          "Forgetting the sign convention in molecularity calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-3-3-0",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-3-1",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-3-2",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-3-3",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-3-3-4",
          question: "What is the primary function or definition of molecularity and half life in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of molecularity",
            "It interacts with half life"
          ],
          acceptedSynonyms: ["molecularity principle", "half life basics"],
          conceptTags: ["molecularity", "half_life"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-3",
            subtopicSlug: "molecularity",
            conceptSlug: "half-life",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-molecularity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molecularity behaves differently than half life."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on molecularity and half life.",
          "Assertion-Reason based on molecularity properties."
        ],
        masteryCriteria: [
          "Can accurately define molecularity.",
          "Can solve numericals involving half life."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "chemical-kinetics-m-4",
      title: "Half life and Arrhenius Essentials",
      description: "A comprehensive mission covering half life and arrhenius.",
      conceptTags: ["half_life", "arrhenius"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "chemical-kinetics-mt-4-0",
        title: "Mastering Half life and Arrhenius",
        conceptTags: ["half_life", "arrhenius"],
        ncertAnchors: ["NCERT paragraph on half life"],
        mustKnowFacts: [
          "The most important fact about half life is its relationship with arrhenius.",
          "Always remember the standard unit and formula for half life."
        ],
        formulas: [
          {
            name: "Standard equation for half life",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing half life with arrhenius.",
          "Forgetting the sign convention in half life calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-4-0-0",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-0-1",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-0-2",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-0-3",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-0-4",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on half life and arrhenius.",
          "Assertion-Reason based on half life properties."
        ],
        masteryCriteria: [
          "Can accurately define half life.",
          "Can solve numericals involving arrhenius."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-4-1",
        title: "Mastering Half life and Arrhenius",
        conceptTags: ["half_life", "arrhenius"],
        ncertAnchors: ["NCERT paragraph on half life"],
        mustKnowFacts: [
          "The most important fact about half life is its relationship with arrhenius.",
          "Always remember the standard unit and formula for half life."
        ],
        formulas: [
          {
            name: "Standard equation for half life",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing half life with arrhenius.",
          "Forgetting the sign convention in half life calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-4-1-0",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-1-1",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-1-2",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-1-3",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-1-4",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on half life and arrhenius.",
          "Assertion-Reason based on half life properties."
        ],
        masteryCriteria: [
          "Can accurately define half life.",
          "Can solve numericals involving arrhenius."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-4-2",
        title: "Mastering Half life and Arrhenius",
        conceptTags: ["half_life", "arrhenius"],
        ncertAnchors: ["NCERT paragraph on half life"],
        mustKnowFacts: [
          "The most important fact about half life is its relationship with arrhenius.",
          "Always remember the standard unit and formula for half life."
        ],
        formulas: [
          {
            name: "Standard equation for half life",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing half life with arrhenius.",
          "Forgetting the sign convention in half life calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-4-2-0",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-2-1",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-2-2",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-2-3",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-2-4",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on half life and arrhenius.",
          "Assertion-Reason based on half life properties."
        ],
        masteryCriteria: [
          "Can accurately define half life.",
          "Can solve numericals involving arrhenius."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-4-3",
        title: "Mastering Half life and Arrhenius",
        conceptTags: ["half_life", "arrhenius"],
        ncertAnchors: ["NCERT paragraph on half life"],
        mustKnowFacts: [
          "The most important fact about half life is its relationship with arrhenius.",
          "Always remember the standard unit and formula for half life."
        ],
        formulas: [
          {
            name: "Standard equation for half life",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing half life with arrhenius.",
          "Forgetting the sign convention in half life calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-4-3-0",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-3-1",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-3-2",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-3-3",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-4-3-4",
          question: "What is the primary function or definition of half life and arrhenius in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of half life",
            "It interacts with arrhenius"
          ],
          acceptedSynonyms: ["half life principle", "arrhenius basics"],
          conceptTags: ["half_life", "arrhenius"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-4",
            subtopicSlug: "half-life",
            conceptSlug: "arrhenius",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-half-life",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that half life behaves differently than arrhenius."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on half life and arrhenius.",
          "Assertion-Reason based on half life properties."
        ],
        masteryCriteria: [
          "Can accurately define half life.",
          "Can solve numericals involving arrhenius."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "chemical-kinetics-m-5",
      title: "Arrhenius and Activation energy Essentials",
      description: "A comprehensive mission covering arrhenius and activation energy.",
      conceptTags: ["arrhenius", "activation_energy"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "chemical-kinetics-mt-5-0",
        title: "Mastering Arrhenius and Activation energy",
        conceptTags: ["arrhenius", "activation_energy"],
        ncertAnchors: ["NCERT paragraph on arrhenius"],
        mustKnowFacts: [
          "The most important fact about arrhenius is its relationship with activation energy.",
          "Always remember the standard unit and formula for arrhenius."
        ],
        formulas: [
          {
            name: "Standard equation for arrhenius",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing arrhenius with activation energy.",
          "Forgetting the sign convention in arrhenius calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-5-0-0",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-0-1",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-0-2",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-0-3",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-0-4",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on arrhenius and activation energy.",
          "Assertion-Reason based on arrhenius properties."
        ],
        masteryCriteria: [
          "Can accurately define arrhenius.",
          "Can solve numericals involving activation energy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-5-1",
        title: "Mastering Arrhenius and Activation energy",
        conceptTags: ["arrhenius", "activation_energy"],
        ncertAnchors: ["NCERT paragraph on arrhenius"],
        mustKnowFacts: [
          "The most important fact about arrhenius is its relationship with activation energy.",
          "Always remember the standard unit and formula for arrhenius."
        ],
        formulas: [
          {
            name: "Standard equation for arrhenius",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing arrhenius with activation energy.",
          "Forgetting the sign convention in arrhenius calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-5-1-0",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-1-1",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-1-2",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-1-3",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-1-4",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on arrhenius and activation energy.",
          "Assertion-Reason based on arrhenius properties."
        ],
        masteryCriteria: [
          "Can accurately define arrhenius.",
          "Can solve numericals involving activation energy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-5-2",
        title: "Mastering Arrhenius and Activation energy",
        conceptTags: ["arrhenius", "activation_energy"],
        ncertAnchors: ["NCERT paragraph on arrhenius"],
        mustKnowFacts: [
          "The most important fact about arrhenius is its relationship with activation energy.",
          "Always remember the standard unit and formula for arrhenius."
        ],
        formulas: [
          {
            name: "Standard equation for arrhenius",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing arrhenius with activation energy.",
          "Forgetting the sign convention in arrhenius calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-5-2-0",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-2-1",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-2-2",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-2-3",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-2-4",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on arrhenius and activation energy.",
          "Assertion-Reason based on arrhenius properties."
        ],
        masteryCriteria: [
          "Can accurately define arrhenius.",
          "Can solve numericals involving activation energy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-kinetics-mt-5-3",
        title: "Mastering Arrhenius and Activation energy",
        conceptTags: ["arrhenius", "activation_energy"],
        ncertAnchors: ["NCERT paragraph on arrhenius"],
        mustKnowFacts: [
          "The most important fact about arrhenius is its relationship with activation energy.",
          "Always remember the standard unit and formula for arrhenius."
        ],
        formulas: [
          {
            name: "Standard equation for arrhenius",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing arrhenius with activation energy.",
          "Forgetting the sign convention in arrhenius calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-kinetics-q-5-3-0",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-3-1",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-3-2",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-3-3",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        },
          {
          id: "chemical-kinetics-q-5-3-4",
          question: "What is the primary function or definition of arrhenius and activation energy in the context of Chemical Kinetics?",
          expectedAnswerPoints: [
            "It relates to the core principle of arrhenius",
            "It interacts with activation energy"
          ],
          acceptedSynonyms: ["arrhenius principle", "activation energy basics"],
          conceptTags: ["arrhenius", "activation_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-kinetics",
            chapterSlug: "chemical-kinetics",
            topicSlug: "chemical-kinetics-topic-5",
            subtopicSlug: "arrhenius",
            conceptSlug: "activation-energy",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-arrhenius",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that arrhenius behaves differently than activation energy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on arrhenius and activation energy.",
          "Assertion-Reason based on arrhenius properties."
        ],
        masteryCriteria: [
          "Can accurately define arrhenius.",
          "Can solve numericals involving activation energy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    }
  ]
};
