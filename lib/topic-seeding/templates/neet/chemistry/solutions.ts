import { ChapterSeed } from '../../../types';

export const solutions_seed: ChapterSeed = {
  exam: "NEET",
  syllabusVersion: "NEET_UG_2026",
  subject: "Chemistry",
  unitNumber: 5,
  unitTitle: "Solutions",
  chapterSlug: "solutions",
  chapterTitle: "Solutions",
  classLevel: "12",
  aliases: ["solution chemistry","colligative properties"],
  ncertMapping: ["Solutions"],
  prerequisites: [],
  estimatedHours: 8,
  priority: "high",
  missions: [
    {
      id: "solutions-m-0",
      title: "Solutions and Raoult Essentials",
      description: "A comprehensive mission covering solutions and raoult.",
      conceptTags: ["solutions", "raoult"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "solutions-mt-0-0",
        title: "Mastering Solutions and Raoult",
        conceptTags: ["solutions", "raoult"],
        ncertAnchors: ["NCERT paragraph on solutions"],
        mustKnowFacts: [
          "The most important fact about solutions is its relationship with raoult.",
          "Always remember the standard unit and formula for solutions."
        ],
        formulas: [
          {
            name: "Standard equation for solutions",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing solutions with raoult.",
          "Forgetting the sign convention in solutions calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-0-0-0",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-0-1",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-0-2",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-0-3",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-0-4",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on solutions and raoult.",
          "Assertion-Reason based on solutions properties."
        ],
        masteryCriteria: [
          "Can accurately define solutions.",
          "Can solve numericals involving raoult."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-0-1",
        title: "Mastering Solutions and Raoult",
        conceptTags: ["solutions", "raoult"],
        ncertAnchors: ["NCERT paragraph on solutions"],
        mustKnowFacts: [
          "The most important fact about solutions is its relationship with raoult.",
          "Always remember the standard unit and formula for solutions."
        ],
        formulas: [
          {
            name: "Standard equation for solutions",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing solutions with raoult.",
          "Forgetting the sign convention in solutions calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-0-1-0",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-1-1",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-1-2",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-1-3",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-1-4",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on solutions and raoult.",
          "Assertion-Reason based on solutions properties."
        ],
        masteryCriteria: [
          "Can accurately define solutions.",
          "Can solve numericals involving raoult."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-0-2",
        title: "Mastering Solutions and Raoult",
        conceptTags: ["solutions", "raoult"],
        ncertAnchors: ["NCERT paragraph on solutions"],
        mustKnowFacts: [
          "The most important fact about solutions is its relationship with raoult.",
          "Always remember the standard unit and formula for solutions."
        ],
        formulas: [
          {
            name: "Standard equation for solutions",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing solutions with raoult.",
          "Forgetting the sign convention in solutions calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-0-2-0",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-2-1",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-2-2",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-2-3",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-2-4",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on solutions and raoult.",
          "Assertion-Reason based on solutions properties."
        ],
        masteryCriteria: [
          "Can accurately define solutions.",
          "Can solve numericals involving raoult."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-0-3",
        title: "Mastering Solutions and Raoult",
        conceptTags: ["solutions", "raoult"],
        ncertAnchors: ["NCERT paragraph on solutions"],
        mustKnowFacts: [
          "The most important fact about solutions is its relationship with raoult.",
          "Always remember the standard unit and formula for solutions."
        ],
        formulas: [
          {
            name: "Standard equation for solutions",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing solutions with raoult.",
          "Forgetting the sign convention in solutions calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-0-3-0",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-3-1",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-3-2",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-3-3",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-0-3-4",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-0",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on solutions and raoult.",
          "Assertion-Reason based on solutions properties."
        ],
        masteryCriteria: [
          "Can accurately define solutions.",
          "Can solve numericals involving raoult."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "solutions-m-1",
      title: "Raoult and Colligative properties Essentials",
      description: "A comprehensive mission covering raoult and colligative properties.",
      conceptTags: ["raoult", "colligative_properties"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "solutions-mt-1-0",
        title: "Mastering Raoult and Colligative properties",
        conceptTags: ["raoult", "colligative_properties"],
        ncertAnchors: ["NCERT paragraph on raoult"],
        mustKnowFacts: [
          "The most important fact about raoult is its relationship with colligative properties.",
          "Always remember the standard unit and formula for raoult."
        ],
        formulas: [
          {
            name: "Standard equation for raoult",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing raoult with colligative properties.",
          "Forgetting the sign convention in raoult calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-1-0-0",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-0-1",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-0-2",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-0-3",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-0-4",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on raoult and colligative properties.",
          "Assertion-Reason based on raoult properties."
        ],
        masteryCriteria: [
          "Can accurately define raoult.",
          "Can solve numericals involving colligative properties."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-1-1",
        title: "Mastering Raoult and Colligative properties",
        conceptTags: ["raoult", "colligative_properties"],
        ncertAnchors: ["NCERT paragraph on raoult"],
        mustKnowFacts: [
          "The most important fact about raoult is its relationship with colligative properties.",
          "Always remember the standard unit and formula for raoult."
        ],
        formulas: [
          {
            name: "Standard equation for raoult",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing raoult with colligative properties.",
          "Forgetting the sign convention in raoult calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-1-1-0",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-1-1",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-1-2",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-1-3",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-1-4",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on raoult and colligative properties.",
          "Assertion-Reason based on raoult properties."
        ],
        masteryCriteria: [
          "Can accurately define raoult.",
          "Can solve numericals involving colligative properties."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-1-2",
        title: "Mastering Raoult and Colligative properties",
        conceptTags: ["raoult", "colligative_properties"],
        ncertAnchors: ["NCERT paragraph on raoult"],
        mustKnowFacts: [
          "The most important fact about raoult is its relationship with colligative properties.",
          "Always remember the standard unit and formula for raoult."
        ],
        formulas: [
          {
            name: "Standard equation for raoult",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing raoult with colligative properties.",
          "Forgetting the sign convention in raoult calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-1-2-0",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-2-1",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-2-2",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-2-3",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-2-4",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on raoult and colligative properties.",
          "Assertion-Reason based on raoult properties."
        ],
        masteryCriteria: [
          "Can accurately define raoult.",
          "Can solve numericals involving colligative properties."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-1-3",
        title: "Mastering Raoult and Colligative properties",
        conceptTags: ["raoult", "colligative_properties"],
        ncertAnchors: ["NCERT paragraph on raoult"],
        mustKnowFacts: [
          "The most important fact about raoult is its relationship with colligative properties.",
          "Always remember the standard unit and formula for raoult."
        ],
        formulas: [
          {
            name: "Standard equation for raoult",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing raoult with colligative properties.",
          "Forgetting the sign convention in raoult calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-1-3-0",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-3-1",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-3-2",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-3-3",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        },
          {
          id: "solutions-q-1-3-4",
          question: "What is the primary function or definition of raoult and colligative properties in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of raoult",
            "It interacts with colligative properties"
          ],
          acceptedSynonyms: ["raoult principle", "colligative properties basics"],
          conceptTags: ["raoult", "colligative_properties"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-1",
            subtopicSlug: "raoult",
            conceptSlug: "colligative-properties",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-raoult",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that raoult behaves differently than colligative properties."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on raoult and colligative properties.",
          "Assertion-Reason based on raoult properties."
        ],
        masteryCriteria: [
          "Can accurately define raoult.",
          "Can solve numericals involving colligative properties."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "solutions-m-2",
      title: "Colligative properties and Osmotic pressure Essentials",
      description: "A comprehensive mission covering colligative properties and osmotic pressure.",
      conceptTags: ["colligative_properties", "osmotic_pressure"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "solutions-mt-2-0",
        title: "Mastering Colligative properties and Osmotic pressure",
        conceptTags: ["colligative_properties", "osmotic_pressure"],
        ncertAnchors: ["NCERT paragraph on colligative properties"],
        mustKnowFacts: [
          "The most important fact about colligative properties is its relationship with osmotic pressure.",
          "Always remember the standard unit and formula for colligative properties."
        ],
        formulas: [
          {
            name: "Standard equation for colligative properties",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing colligative properties with osmotic pressure.",
          "Forgetting the sign convention in colligative properties calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-2-0-0",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-0-1",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-0-2",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-0-3",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-0-4",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on colligative properties and osmotic pressure.",
          "Assertion-Reason based on colligative properties properties."
        ],
        masteryCriteria: [
          "Can accurately define colligative properties.",
          "Can solve numericals involving osmotic pressure."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-2-1",
        title: "Mastering Colligative properties and Osmotic pressure",
        conceptTags: ["colligative_properties", "osmotic_pressure"],
        ncertAnchors: ["NCERT paragraph on colligative properties"],
        mustKnowFacts: [
          "The most important fact about colligative properties is its relationship with osmotic pressure.",
          "Always remember the standard unit and formula for colligative properties."
        ],
        formulas: [
          {
            name: "Standard equation for colligative properties",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing colligative properties with osmotic pressure.",
          "Forgetting the sign convention in colligative properties calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-2-1-0",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-1-1",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-1-2",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-1-3",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-1-4",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on colligative properties and osmotic pressure.",
          "Assertion-Reason based on colligative properties properties."
        ],
        masteryCriteria: [
          "Can accurately define colligative properties.",
          "Can solve numericals involving osmotic pressure."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-2-2",
        title: "Mastering Colligative properties and Osmotic pressure",
        conceptTags: ["colligative_properties", "osmotic_pressure"],
        ncertAnchors: ["NCERT paragraph on colligative properties"],
        mustKnowFacts: [
          "The most important fact about colligative properties is its relationship with osmotic pressure.",
          "Always remember the standard unit and formula for colligative properties."
        ],
        formulas: [
          {
            name: "Standard equation for colligative properties",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing colligative properties with osmotic pressure.",
          "Forgetting the sign convention in colligative properties calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-2-2-0",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-2-1",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-2-2",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-2-3",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-2-4",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on colligative properties and osmotic pressure.",
          "Assertion-Reason based on colligative properties properties."
        ],
        masteryCriteria: [
          "Can accurately define colligative properties.",
          "Can solve numericals involving osmotic pressure."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-2-3",
        title: "Mastering Colligative properties and Osmotic pressure",
        conceptTags: ["colligative_properties", "osmotic_pressure"],
        ncertAnchors: ["NCERT paragraph on colligative properties"],
        mustKnowFacts: [
          "The most important fact about colligative properties is its relationship with osmotic pressure.",
          "Always remember the standard unit and formula for colligative properties."
        ],
        formulas: [
          {
            name: "Standard equation for colligative properties",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing colligative properties with osmotic pressure.",
          "Forgetting the sign convention in colligative properties calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-2-3-0",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-3-1",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-3-2",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-3-3",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        },
          {
          id: "solutions-q-2-3-4",
          question: "What is the primary function or definition of colligative properties and osmotic pressure in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of colligative properties",
            "It interacts with osmotic pressure"
          ],
          acceptedSynonyms: ["colligative properties principle", "osmotic pressure basics"],
          conceptTags: ["colligative_properties", "osmotic_pressure"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-2",
            subtopicSlug: "colligative-properties",
            conceptSlug: "osmotic-pressure",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-colligative-properties",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that colligative properties behaves differently than osmotic pressure."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on colligative properties and osmotic pressure.",
          "Assertion-Reason based on colligative properties properties."
        ],
        masteryCriteria: [
          "Can accurately define colligative properties.",
          "Can solve numericals involving osmotic pressure."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "solutions-m-3",
      title: "Osmotic pressure and Van t hoff Essentials",
      description: "A comprehensive mission covering osmotic pressure and van t hoff.",
      conceptTags: ["osmotic_pressure", "van_t_hoff"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "solutions-mt-3-0",
        title: "Mastering Osmotic pressure and Van t hoff",
        conceptTags: ["osmotic_pressure", "van_t_hoff"],
        ncertAnchors: ["NCERT paragraph on osmotic pressure"],
        mustKnowFacts: [
          "The most important fact about osmotic pressure is its relationship with van t hoff.",
          "Always remember the standard unit and formula for osmotic pressure."
        ],
        formulas: [
          {
            name: "Standard equation for osmotic pressure",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing osmotic pressure with van t hoff.",
          "Forgetting the sign convention in osmotic pressure calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-3-0-0",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-0-1",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-0-2",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-0-3",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-0-4",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on osmotic pressure and van t hoff.",
          "Assertion-Reason based on osmotic pressure properties."
        ],
        masteryCriteria: [
          "Can accurately define osmotic pressure.",
          "Can solve numericals involving van t hoff."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-3-1",
        title: "Mastering Osmotic pressure and Van t hoff",
        conceptTags: ["osmotic_pressure", "van_t_hoff"],
        ncertAnchors: ["NCERT paragraph on osmotic pressure"],
        mustKnowFacts: [
          "The most important fact about osmotic pressure is its relationship with van t hoff.",
          "Always remember the standard unit and formula for osmotic pressure."
        ],
        formulas: [
          {
            name: "Standard equation for osmotic pressure",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing osmotic pressure with van t hoff.",
          "Forgetting the sign convention in osmotic pressure calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-3-1-0",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-1-1",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-1-2",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-1-3",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-1-4",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on osmotic pressure and van t hoff.",
          "Assertion-Reason based on osmotic pressure properties."
        ],
        masteryCriteria: [
          "Can accurately define osmotic pressure.",
          "Can solve numericals involving van t hoff."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-3-2",
        title: "Mastering Osmotic pressure and Van t hoff",
        conceptTags: ["osmotic_pressure", "van_t_hoff"],
        ncertAnchors: ["NCERT paragraph on osmotic pressure"],
        mustKnowFacts: [
          "The most important fact about osmotic pressure is its relationship with van t hoff.",
          "Always remember the standard unit and formula for osmotic pressure."
        ],
        formulas: [
          {
            name: "Standard equation for osmotic pressure",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing osmotic pressure with van t hoff.",
          "Forgetting the sign convention in osmotic pressure calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-3-2-0",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-2-1",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-2-2",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-2-3",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-2-4",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on osmotic pressure and van t hoff.",
          "Assertion-Reason based on osmotic pressure properties."
        ],
        masteryCriteria: [
          "Can accurately define osmotic pressure.",
          "Can solve numericals involving van t hoff."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-3-3",
        title: "Mastering Osmotic pressure and Van t hoff",
        conceptTags: ["osmotic_pressure", "van_t_hoff"],
        ncertAnchors: ["NCERT paragraph on osmotic pressure"],
        mustKnowFacts: [
          "The most important fact about osmotic pressure is its relationship with van t hoff.",
          "Always remember the standard unit and formula for osmotic pressure."
        ],
        formulas: [
          {
            name: "Standard equation for osmotic pressure",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing osmotic pressure with van t hoff.",
          "Forgetting the sign convention in osmotic pressure calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-3-3-0",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-3-1",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-3-2",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-3-3",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        },
          {
          id: "solutions-q-3-3-4",
          question: "What is the primary function or definition of osmotic pressure and van t hoff in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of osmotic pressure",
            "It interacts with van t hoff"
          ],
          acceptedSynonyms: ["osmotic pressure principle", "van t hoff basics"],
          conceptTags: ["osmotic_pressure", "van_t_hoff"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-3",
            subtopicSlug: "osmotic-pressure",
            conceptSlug: "van-t-hoff",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-osmotic-pressure",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that osmotic pressure behaves differently than van t hoff."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on osmotic pressure and van t hoff.",
          "Assertion-Reason based on osmotic pressure properties."
        ],
        masteryCriteria: [
          "Can accurately define osmotic pressure.",
          "Can solve numericals involving van t hoff."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "solutions-m-4",
      title: "Van t hoff and Solutions Essentials",
      description: "A comprehensive mission covering van t hoff and solutions.",
      conceptTags: ["van_t_hoff", "solutions"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "solutions-mt-4-0",
        title: "Mastering Van t hoff and Solutions",
        conceptTags: ["van_t_hoff", "solutions"],
        ncertAnchors: ["NCERT paragraph on van t hoff"],
        mustKnowFacts: [
          "The most important fact about van t hoff is its relationship with solutions.",
          "Always remember the standard unit and formula for van t hoff."
        ],
        formulas: [
          {
            name: "Standard equation for van t hoff",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing van t hoff with solutions.",
          "Forgetting the sign convention in van t hoff calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-4-0-0",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-0-1",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-0-2",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-0-3",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-0-4",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on van t hoff and solutions.",
          "Assertion-Reason based on van t hoff properties."
        ],
        masteryCriteria: [
          "Can accurately define van t hoff.",
          "Can solve numericals involving solutions."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-4-1",
        title: "Mastering Van t hoff and Solutions",
        conceptTags: ["van_t_hoff", "solutions"],
        ncertAnchors: ["NCERT paragraph on van t hoff"],
        mustKnowFacts: [
          "The most important fact about van t hoff is its relationship with solutions.",
          "Always remember the standard unit and formula for van t hoff."
        ],
        formulas: [
          {
            name: "Standard equation for van t hoff",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing van t hoff with solutions.",
          "Forgetting the sign convention in van t hoff calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-4-1-0",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-1-1",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-1-2",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-1-3",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-1-4",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on van t hoff and solutions.",
          "Assertion-Reason based on van t hoff properties."
        ],
        masteryCriteria: [
          "Can accurately define van t hoff.",
          "Can solve numericals involving solutions."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-4-2",
        title: "Mastering Van t hoff and Solutions",
        conceptTags: ["van_t_hoff", "solutions"],
        ncertAnchors: ["NCERT paragraph on van t hoff"],
        mustKnowFacts: [
          "The most important fact about van t hoff is its relationship with solutions.",
          "Always remember the standard unit and formula for van t hoff."
        ],
        formulas: [
          {
            name: "Standard equation for van t hoff",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing van t hoff with solutions.",
          "Forgetting the sign convention in van t hoff calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-4-2-0",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-2-1",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-2-2",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-2-3",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-2-4",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on van t hoff and solutions.",
          "Assertion-Reason based on van t hoff properties."
        ],
        masteryCriteria: [
          "Can accurately define van t hoff.",
          "Can solve numericals involving solutions."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-4-3",
        title: "Mastering Van t hoff and Solutions",
        conceptTags: ["van_t_hoff", "solutions"],
        ncertAnchors: ["NCERT paragraph on van t hoff"],
        mustKnowFacts: [
          "The most important fact about van t hoff is its relationship with solutions.",
          "Always remember the standard unit and formula for van t hoff."
        ],
        formulas: [
          {
            name: "Standard equation for van t hoff",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing van t hoff with solutions.",
          "Forgetting the sign convention in van t hoff calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-4-3-0",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-3-1",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-3-2",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-3-3",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        },
          {
          id: "solutions-q-4-3-4",
          question: "What is the primary function or definition of van t hoff and solutions in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of van t hoff",
            "It interacts with solutions"
          ],
          acceptedSynonyms: ["van t hoff principle", "solutions basics"],
          conceptTags: ["van_t_hoff", "solutions"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-4",
            subtopicSlug: "van-t-hoff",
            conceptSlug: "solutions",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-van-t-hoff",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that van t hoff behaves differently than solutions."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on van t hoff and solutions.",
          "Assertion-Reason based on van t hoff properties."
        ],
        masteryCriteria: [
          "Can accurately define van t hoff.",
          "Can solve numericals involving solutions."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "solutions-m-5",
      title: "Solutions and Raoult Essentials",
      description: "A comprehensive mission covering solutions and raoult.",
      conceptTags: ["solutions", "raoult"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "solutions-mt-5-0",
        title: "Mastering Solutions and Raoult",
        conceptTags: ["solutions", "raoult"],
        ncertAnchors: ["NCERT paragraph on solutions"],
        mustKnowFacts: [
          "The most important fact about solutions is its relationship with raoult.",
          "Always remember the standard unit and formula for solutions."
        ],
        formulas: [
          {
            name: "Standard equation for solutions",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing solutions with raoult.",
          "Forgetting the sign convention in solutions calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-5-0-0",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-0-1",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-0-2",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-0-3",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-0-4",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on solutions and raoult.",
          "Assertion-Reason based on solutions properties."
        ],
        masteryCriteria: [
          "Can accurately define solutions.",
          "Can solve numericals involving raoult."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-5-1",
        title: "Mastering Solutions and Raoult",
        conceptTags: ["solutions", "raoult"],
        ncertAnchors: ["NCERT paragraph on solutions"],
        mustKnowFacts: [
          "The most important fact about solutions is its relationship with raoult.",
          "Always remember the standard unit and formula for solutions."
        ],
        formulas: [
          {
            name: "Standard equation for solutions",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing solutions with raoult.",
          "Forgetting the sign convention in solutions calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-5-1-0",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-1-1",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-1-2",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-1-3",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-1-4",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on solutions and raoult.",
          "Assertion-Reason based on solutions properties."
        ],
        masteryCriteria: [
          "Can accurately define solutions.",
          "Can solve numericals involving raoult."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-5-2",
        title: "Mastering Solutions and Raoult",
        conceptTags: ["solutions", "raoult"],
        ncertAnchors: ["NCERT paragraph on solutions"],
        mustKnowFacts: [
          "The most important fact about solutions is its relationship with raoult.",
          "Always remember the standard unit and formula for solutions."
        ],
        formulas: [
          {
            name: "Standard equation for solutions",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing solutions with raoult.",
          "Forgetting the sign convention in solutions calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-5-2-0",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-2-1",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-2-2",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-2-3",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-2-4",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on solutions and raoult.",
          "Assertion-Reason based on solutions properties."
        ],
        masteryCriteria: [
          "Can accurately define solutions.",
          "Can solve numericals involving raoult."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "solutions-mt-5-3",
        title: "Mastering Solutions and Raoult",
        conceptTags: ["solutions", "raoult"],
        ncertAnchors: ["NCERT paragraph on solutions"],
        mustKnowFacts: [
          "The most important fact about solutions is its relationship with raoult.",
          "Always remember the standard unit and formula for solutions."
        ],
        formulas: [
          {
            name: "Standard equation for solutions",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing solutions with raoult.",
          "Forgetting the sign convention in solutions calculations."
        ],
        activeRecallQuestions: [
          {
          id: "solutions-q-5-3-0",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-3-1",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-3-2",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-3-3",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        },
          {
          id: "solutions-q-5-3-4",
          question: "What is the primary function or definition of solutions and raoult in the context of Solutions?",
          expectedAnswerPoints: [
            "It relates to the core principle of solutions",
            "It interacts with raoult"
          ],
          acceptedSynonyms: ["solutions principle", "raoult basics"],
          conceptTags: ["solutions", "raoult"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "solutions",
            chapterSlug: "solutions",
            topicSlug: "solutions-topic-5",
            subtopicSlug: "solutions",
            conceptSlug: "raoult",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-solutions",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that solutions behaves differently than raoult."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on solutions and raoult.",
          "Assertion-Reason based on solutions properties."
        ],
        masteryCriteria: [
          "Can accurately define solutions.",
          "Can solve numericals involving raoult."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    }
  ]
};
