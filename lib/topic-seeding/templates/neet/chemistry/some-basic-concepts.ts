import { ChapterSeed } from '../../../types';

export const some_basic_concepts_seed: ChapterSeed = {
  exam: "NEET",
  syllabusVersion: "NEET_UG_2026",
  subject: "Chemistry",
  unitNumber: 1,
  unitTitle: "Some Basic Concepts in Chemistry",
  chapterSlug: "some-basic-concepts",
  chapterTitle: "Some Basic Concepts in Chemistry",
  classLevel: "11",
  aliases: ["mole concept","stoichiometry"],
  ncertMapping: ["Some Basic Concepts of Chemistry"],
  prerequisites: [],
  estimatedHours: 8,
  priority: "high",
  missions: [
    {
      id: "some-basic-concepts-m-0",
      title: "Basic concepts and Mole Essentials",
      description: "A comprehensive mission covering basic concepts and mole.",
      conceptTags: ["basic_concepts", "mole"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "some-basic-concepts-mt-0-0",
        title: "Mastering Basic concepts and Mole",
        conceptTags: ["basic_concepts", "mole"],
        ncertAnchors: ["NCERT paragraph on basic concepts"],
        mustKnowFacts: [
          "The most important fact about basic concepts is its relationship with mole.",
          "Always remember the standard unit and formula for basic concepts."
        ],
        formulas: [
          {
            name: "Standard equation for basic concepts",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing basic concepts with mole.",
          "Forgetting the sign convention in basic concepts calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-0-0-0",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-0-1",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-0-2",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-0-3",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-0-4",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on basic concepts and mole.",
          "Assertion-Reason based on basic concepts properties."
        ],
        masteryCriteria: [
          "Can accurately define basic concepts.",
          "Can solve numericals involving mole."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-0-1",
        title: "Mastering Basic concepts and Mole",
        conceptTags: ["basic_concepts", "mole"],
        ncertAnchors: ["NCERT paragraph on basic concepts"],
        mustKnowFacts: [
          "The most important fact about basic concepts is its relationship with mole.",
          "Always remember the standard unit and formula for basic concepts."
        ],
        formulas: [
          {
            name: "Standard equation for basic concepts",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing basic concepts with mole.",
          "Forgetting the sign convention in basic concepts calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-0-1-0",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-1-1",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-1-2",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-1-3",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-1-4",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on basic concepts and mole.",
          "Assertion-Reason based on basic concepts properties."
        ],
        masteryCriteria: [
          "Can accurately define basic concepts.",
          "Can solve numericals involving mole."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-0-2",
        title: "Mastering Basic concepts and Mole",
        conceptTags: ["basic_concepts", "mole"],
        ncertAnchors: ["NCERT paragraph on basic concepts"],
        mustKnowFacts: [
          "The most important fact about basic concepts is its relationship with mole.",
          "Always remember the standard unit and formula for basic concepts."
        ],
        formulas: [
          {
            name: "Standard equation for basic concepts",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing basic concepts with mole.",
          "Forgetting the sign convention in basic concepts calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-0-2-0",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-2-1",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-2-2",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-2-3",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-2-4",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on basic concepts and mole.",
          "Assertion-Reason based on basic concepts properties."
        ],
        masteryCriteria: [
          "Can accurately define basic concepts.",
          "Can solve numericals involving mole."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-0-3",
        title: "Mastering Basic concepts and Mole",
        conceptTags: ["basic_concepts", "mole"],
        ncertAnchors: ["NCERT paragraph on basic concepts"],
        mustKnowFacts: [
          "The most important fact about basic concepts is its relationship with mole.",
          "Always remember the standard unit and formula for basic concepts."
        ],
        formulas: [
          {
            name: "Standard equation for basic concepts",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing basic concepts with mole.",
          "Forgetting the sign convention in basic concepts calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-0-3-0",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-3-1",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-3-2",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-3-3",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-0-3-4",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-0",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on basic concepts and mole.",
          "Assertion-Reason based on basic concepts properties."
        ],
        masteryCriteria: [
          "Can accurately define basic concepts.",
          "Can solve numericals involving mole."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "some-basic-concepts-m-1",
      title: "Mole and Stoichiometry Essentials",
      description: "A comprehensive mission covering mole and stoichiometry.",
      conceptTags: ["mole", "stoichiometry"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "some-basic-concepts-mt-1-0",
        title: "Mastering Mole and Stoichiometry",
        conceptTags: ["mole", "stoichiometry"],
        ncertAnchors: ["NCERT paragraph on mole"],
        mustKnowFacts: [
          "The most important fact about mole is its relationship with stoichiometry.",
          "Always remember the standard unit and formula for mole."
        ],
        formulas: [
          {
            name: "Standard equation for mole",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing mole with stoichiometry.",
          "Forgetting the sign convention in mole calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-1-0-0",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-0-1",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-0-2",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-0-3",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-0-4",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on mole and stoichiometry.",
          "Assertion-Reason based on mole properties."
        ],
        masteryCriteria: [
          "Can accurately define mole.",
          "Can solve numericals involving stoichiometry."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-1-1",
        title: "Mastering Mole and Stoichiometry",
        conceptTags: ["mole", "stoichiometry"],
        ncertAnchors: ["NCERT paragraph on mole"],
        mustKnowFacts: [
          "The most important fact about mole is its relationship with stoichiometry.",
          "Always remember the standard unit and formula for mole."
        ],
        formulas: [
          {
            name: "Standard equation for mole",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing mole with stoichiometry.",
          "Forgetting the sign convention in mole calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-1-1-0",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-1-1",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-1-2",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-1-3",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-1-4",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on mole and stoichiometry.",
          "Assertion-Reason based on mole properties."
        ],
        masteryCriteria: [
          "Can accurately define mole.",
          "Can solve numericals involving stoichiometry."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-1-2",
        title: "Mastering Mole and Stoichiometry",
        conceptTags: ["mole", "stoichiometry"],
        ncertAnchors: ["NCERT paragraph on mole"],
        mustKnowFacts: [
          "The most important fact about mole is its relationship with stoichiometry.",
          "Always remember the standard unit and formula for mole."
        ],
        formulas: [
          {
            name: "Standard equation for mole",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing mole with stoichiometry.",
          "Forgetting the sign convention in mole calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-1-2-0",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-2-1",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-2-2",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-2-3",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-2-4",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on mole and stoichiometry.",
          "Assertion-Reason based on mole properties."
        ],
        masteryCriteria: [
          "Can accurately define mole.",
          "Can solve numericals involving stoichiometry."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-1-3",
        title: "Mastering Mole and Stoichiometry",
        conceptTags: ["mole", "stoichiometry"],
        ncertAnchors: ["NCERT paragraph on mole"],
        mustKnowFacts: [
          "The most important fact about mole is its relationship with stoichiometry.",
          "Always remember the standard unit and formula for mole."
        ],
        formulas: [
          {
            name: "Standard equation for mole",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing mole with stoichiometry.",
          "Forgetting the sign convention in mole calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-1-3-0",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-3-1",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-3-2",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-3-3",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-1-3-4",
          question: "What is the primary function or definition of mole and stoichiometry in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of mole",
            "It interacts with stoichiometry"
          ],
          acceptedSynonyms: ["mole principle", "stoichiometry basics"],
          conceptTags: ["mole", "stoichiometry"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-1",
            subtopicSlug: "mole",
            conceptSlug: "stoichiometry",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-mole",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that mole behaves differently than stoichiometry."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on mole and stoichiometry.",
          "Assertion-Reason based on mole properties."
        ],
        masteryCriteria: [
          "Can accurately define mole.",
          "Can solve numericals involving stoichiometry."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "some-basic-concepts-m-2",
      title: "Stoichiometry and Molarity Essentials",
      description: "A comprehensive mission covering stoichiometry and molarity.",
      conceptTags: ["stoichiometry", "molarity"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "some-basic-concepts-mt-2-0",
        title: "Mastering Stoichiometry and Molarity",
        conceptTags: ["stoichiometry", "molarity"],
        ncertAnchors: ["NCERT paragraph on stoichiometry"],
        mustKnowFacts: [
          "The most important fact about stoichiometry is its relationship with molarity.",
          "Always remember the standard unit and formula for stoichiometry."
        ],
        formulas: [
          {
            name: "Standard equation for stoichiometry",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing stoichiometry with molarity.",
          "Forgetting the sign convention in stoichiometry calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-2-0-0",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-0-1",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-0-2",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-0-3",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-0-4",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on stoichiometry and molarity.",
          "Assertion-Reason based on stoichiometry properties."
        ],
        masteryCriteria: [
          "Can accurately define stoichiometry.",
          "Can solve numericals involving molarity."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-2-1",
        title: "Mastering Stoichiometry and Molarity",
        conceptTags: ["stoichiometry", "molarity"],
        ncertAnchors: ["NCERT paragraph on stoichiometry"],
        mustKnowFacts: [
          "The most important fact about stoichiometry is its relationship with molarity.",
          "Always remember the standard unit and formula for stoichiometry."
        ],
        formulas: [
          {
            name: "Standard equation for stoichiometry",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing stoichiometry with molarity.",
          "Forgetting the sign convention in stoichiometry calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-2-1-0",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-1-1",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-1-2",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-1-3",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-1-4",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on stoichiometry and molarity.",
          "Assertion-Reason based on stoichiometry properties."
        ],
        masteryCriteria: [
          "Can accurately define stoichiometry.",
          "Can solve numericals involving molarity."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-2-2",
        title: "Mastering Stoichiometry and Molarity",
        conceptTags: ["stoichiometry", "molarity"],
        ncertAnchors: ["NCERT paragraph on stoichiometry"],
        mustKnowFacts: [
          "The most important fact about stoichiometry is its relationship with molarity.",
          "Always remember the standard unit and formula for stoichiometry."
        ],
        formulas: [
          {
            name: "Standard equation for stoichiometry",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing stoichiometry with molarity.",
          "Forgetting the sign convention in stoichiometry calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-2-2-0",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-2-1",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-2-2",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-2-3",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-2-4",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on stoichiometry and molarity.",
          "Assertion-Reason based on stoichiometry properties."
        ],
        masteryCriteria: [
          "Can accurately define stoichiometry.",
          "Can solve numericals involving molarity."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-2-3",
        title: "Mastering Stoichiometry and Molarity",
        conceptTags: ["stoichiometry", "molarity"],
        ncertAnchors: ["NCERT paragraph on stoichiometry"],
        mustKnowFacts: [
          "The most important fact about stoichiometry is its relationship with molarity.",
          "Always remember the standard unit and formula for stoichiometry."
        ],
        formulas: [
          {
            name: "Standard equation for stoichiometry",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing stoichiometry with molarity.",
          "Forgetting the sign convention in stoichiometry calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-2-3-0",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-3-1",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-3-2",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-3-3",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-2-3-4",
          question: "What is the primary function or definition of stoichiometry and molarity in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of stoichiometry",
            "It interacts with molarity"
          ],
          acceptedSynonyms: ["stoichiometry principle", "molarity basics"],
          conceptTags: ["stoichiometry", "molarity"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-2",
            subtopicSlug: "stoichiometry",
            conceptSlug: "molarity",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-stoichiometry",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that stoichiometry behaves differently than molarity."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on stoichiometry and molarity.",
          "Assertion-Reason based on stoichiometry properties."
        ],
        masteryCriteria: [
          "Can accurately define stoichiometry.",
          "Can solve numericals involving molarity."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "some-basic-concepts-m-3",
      title: "Molarity and Empirical formula Essentials",
      description: "A comprehensive mission covering molarity and empirical formula.",
      conceptTags: ["molarity", "empirical_formula"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "some-basic-concepts-mt-3-0",
        title: "Mastering Molarity and Empirical formula",
        conceptTags: ["molarity", "empirical_formula"],
        ncertAnchors: ["NCERT paragraph on molarity"],
        mustKnowFacts: [
          "The most important fact about molarity is its relationship with empirical formula.",
          "Always remember the standard unit and formula for molarity."
        ],
        formulas: [
          {
            name: "Standard equation for molarity",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing molarity with empirical formula.",
          "Forgetting the sign convention in molarity calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-3-0-0",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-0-1",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-0-2",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-0-3",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-0-4",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on molarity and empirical formula.",
          "Assertion-Reason based on molarity properties."
        ],
        masteryCriteria: [
          "Can accurately define molarity.",
          "Can solve numericals involving empirical formula."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-3-1",
        title: "Mastering Molarity and Empirical formula",
        conceptTags: ["molarity", "empirical_formula"],
        ncertAnchors: ["NCERT paragraph on molarity"],
        mustKnowFacts: [
          "The most important fact about molarity is its relationship with empirical formula.",
          "Always remember the standard unit and formula for molarity."
        ],
        formulas: [
          {
            name: "Standard equation for molarity",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing molarity with empirical formula.",
          "Forgetting the sign convention in molarity calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-3-1-0",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-1-1",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-1-2",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-1-3",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-1-4",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on molarity and empirical formula.",
          "Assertion-Reason based on molarity properties."
        ],
        masteryCriteria: [
          "Can accurately define molarity.",
          "Can solve numericals involving empirical formula."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-3-2",
        title: "Mastering Molarity and Empirical formula",
        conceptTags: ["molarity", "empirical_formula"],
        ncertAnchors: ["NCERT paragraph on molarity"],
        mustKnowFacts: [
          "The most important fact about molarity is its relationship with empirical formula.",
          "Always remember the standard unit and formula for molarity."
        ],
        formulas: [
          {
            name: "Standard equation for molarity",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing molarity with empirical formula.",
          "Forgetting the sign convention in molarity calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-3-2-0",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-2-1",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-2-2",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-2-3",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-2-4",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on molarity and empirical formula.",
          "Assertion-Reason based on molarity properties."
        ],
        masteryCriteria: [
          "Can accurately define molarity.",
          "Can solve numericals involving empirical formula."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-3-3",
        title: "Mastering Molarity and Empirical formula",
        conceptTags: ["molarity", "empirical_formula"],
        ncertAnchors: ["NCERT paragraph on molarity"],
        mustKnowFacts: [
          "The most important fact about molarity is its relationship with empirical formula.",
          "Always remember the standard unit and formula for molarity."
        ],
        formulas: [
          {
            name: "Standard equation for molarity",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing molarity with empirical formula.",
          "Forgetting the sign convention in molarity calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-3-3-0",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-3-1",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-3-2",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-3-3",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-3-3-4",
          question: "What is the primary function or definition of molarity and empirical formula in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of molarity",
            "It interacts with empirical formula"
          ],
          acceptedSynonyms: ["molarity principle", "empirical formula basics"],
          conceptTags: ["molarity", "empirical_formula"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-3",
            subtopicSlug: "molarity",
            conceptSlug: "empirical-formula",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-molarity",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that molarity behaves differently than empirical formula."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on molarity and empirical formula.",
          "Assertion-Reason based on molarity properties."
        ],
        masteryCriteria: [
          "Can accurately define molarity.",
          "Can solve numericals involving empirical formula."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "some-basic-concepts-m-4",
      title: "Empirical formula and Basic concepts Essentials",
      description: "A comprehensive mission covering empirical formula and basic concepts.",
      conceptTags: ["empirical_formula", "basic_concepts"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "some-basic-concepts-mt-4-0",
        title: "Mastering Empirical formula and Basic concepts",
        conceptTags: ["empirical_formula", "basic_concepts"],
        ncertAnchors: ["NCERT paragraph on empirical formula"],
        mustKnowFacts: [
          "The most important fact about empirical formula is its relationship with basic concepts.",
          "Always remember the standard unit and formula for empirical formula."
        ],
        formulas: [
          {
            name: "Standard equation for empirical formula",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing empirical formula with basic concepts.",
          "Forgetting the sign convention in empirical formula calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-4-0-0",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-0-1",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-0-2",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-0-3",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-0-4",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on empirical formula and basic concepts.",
          "Assertion-Reason based on empirical formula properties."
        ],
        masteryCriteria: [
          "Can accurately define empirical formula.",
          "Can solve numericals involving basic concepts."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-4-1",
        title: "Mastering Empirical formula and Basic concepts",
        conceptTags: ["empirical_formula", "basic_concepts"],
        ncertAnchors: ["NCERT paragraph on empirical formula"],
        mustKnowFacts: [
          "The most important fact about empirical formula is its relationship with basic concepts.",
          "Always remember the standard unit and formula for empirical formula."
        ],
        formulas: [
          {
            name: "Standard equation for empirical formula",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing empirical formula with basic concepts.",
          "Forgetting the sign convention in empirical formula calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-4-1-0",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-1-1",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-1-2",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-1-3",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-1-4",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on empirical formula and basic concepts.",
          "Assertion-Reason based on empirical formula properties."
        ],
        masteryCriteria: [
          "Can accurately define empirical formula.",
          "Can solve numericals involving basic concepts."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-4-2",
        title: "Mastering Empirical formula and Basic concepts",
        conceptTags: ["empirical_formula", "basic_concepts"],
        ncertAnchors: ["NCERT paragraph on empirical formula"],
        mustKnowFacts: [
          "The most important fact about empirical formula is its relationship with basic concepts.",
          "Always remember the standard unit and formula for empirical formula."
        ],
        formulas: [
          {
            name: "Standard equation for empirical formula",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing empirical formula with basic concepts.",
          "Forgetting the sign convention in empirical formula calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-4-2-0",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-2-1",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-2-2",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-2-3",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-2-4",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on empirical formula and basic concepts.",
          "Assertion-Reason based on empirical formula properties."
        ],
        masteryCriteria: [
          "Can accurately define empirical formula.",
          "Can solve numericals involving basic concepts."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-4-3",
        title: "Mastering Empirical formula and Basic concepts",
        conceptTags: ["empirical_formula", "basic_concepts"],
        ncertAnchors: ["NCERT paragraph on empirical formula"],
        mustKnowFacts: [
          "The most important fact about empirical formula is its relationship with basic concepts.",
          "Always remember the standard unit and formula for empirical formula."
        ],
        formulas: [
          {
            name: "Standard equation for empirical formula",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing empirical formula with basic concepts.",
          "Forgetting the sign convention in empirical formula calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-4-3-0",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-3-1",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-3-2",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-3-3",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-4-3-4",
          question: "What is the primary function or definition of empirical formula and basic concepts in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of empirical formula",
            "It interacts with basic concepts"
          ],
          acceptedSynonyms: ["empirical formula principle", "basic concepts basics"],
          conceptTags: ["empirical_formula", "basic_concepts"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-4",
            subtopicSlug: "empirical-formula",
            conceptSlug: "basic-concepts",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-empirical-formula",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that empirical formula behaves differently than basic concepts."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on empirical formula and basic concepts.",
          "Assertion-Reason based on empirical formula properties."
        ],
        masteryCriteria: [
          "Can accurately define empirical formula.",
          "Can solve numericals involving basic concepts."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "some-basic-concepts-m-5",
      title: "Basic concepts and Mole Essentials",
      description: "A comprehensive mission covering basic concepts and mole.",
      conceptTags: ["basic_concepts", "mole"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "some-basic-concepts-mt-5-0",
        title: "Mastering Basic concepts and Mole",
        conceptTags: ["basic_concepts", "mole"],
        ncertAnchors: ["NCERT paragraph on basic concepts"],
        mustKnowFacts: [
          "The most important fact about basic concepts is its relationship with mole.",
          "Always remember the standard unit and formula for basic concepts."
        ],
        formulas: [
          {
            name: "Standard equation for basic concepts",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing basic concepts with mole.",
          "Forgetting the sign convention in basic concepts calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-5-0-0",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-0-1",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-0-2",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-0-3",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-0-4",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on basic concepts and mole.",
          "Assertion-Reason based on basic concepts properties."
        ],
        masteryCriteria: [
          "Can accurately define basic concepts.",
          "Can solve numericals involving mole."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-5-1",
        title: "Mastering Basic concepts and Mole",
        conceptTags: ["basic_concepts", "mole"],
        ncertAnchors: ["NCERT paragraph on basic concepts"],
        mustKnowFacts: [
          "The most important fact about basic concepts is its relationship with mole.",
          "Always remember the standard unit and formula for basic concepts."
        ],
        formulas: [
          {
            name: "Standard equation for basic concepts",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing basic concepts with mole.",
          "Forgetting the sign convention in basic concepts calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-5-1-0",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-1-1",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-1-2",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-1-3",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-1-4",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on basic concepts and mole.",
          "Assertion-Reason based on basic concepts properties."
        ],
        masteryCriteria: [
          "Can accurately define basic concepts.",
          "Can solve numericals involving mole."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-5-2",
        title: "Mastering Basic concepts and Mole",
        conceptTags: ["basic_concepts", "mole"],
        ncertAnchors: ["NCERT paragraph on basic concepts"],
        mustKnowFacts: [
          "The most important fact about basic concepts is its relationship with mole.",
          "Always remember the standard unit and formula for basic concepts."
        ],
        formulas: [
          {
            name: "Standard equation for basic concepts",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing basic concepts with mole.",
          "Forgetting the sign convention in basic concepts calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-5-2-0",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-2-1",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-2-2",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-2-3",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-2-4",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on basic concepts and mole.",
          "Assertion-Reason based on basic concepts properties."
        ],
        masteryCriteria: [
          "Can accurately define basic concepts.",
          "Can solve numericals involving mole."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "some-basic-concepts-mt-5-3",
        title: "Mastering Basic concepts and Mole",
        conceptTags: ["basic_concepts", "mole"],
        ncertAnchors: ["NCERT paragraph on basic concepts"],
        mustKnowFacts: [
          "The most important fact about basic concepts is its relationship with mole.",
          "Always remember the standard unit and formula for basic concepts."
        ],
        formulas: [
          {
            name: "Standard equation for basic concepts",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing basic concepts with mole.",
          "Forgetting the sign convention in basic concepts calculations."
        ],
        activeRecallQuestions: [
          {
          id: "some-basic-concepts-q-5-3-0",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-3-1",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-3-2",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-3-3",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        },
          {
          id: "some-basic-concepts-q-5-3-4",
          question: "What is the primary function or definition of basic concepts and mole in the context of Some Basic Concepts in Chemistry?",
          expectedAnswerPoints: [
            "It relates to the core principle of basic concepts",
            "It interacts with mole"
          ],
          acceptedSynonyms: ["basic concepts principle", "mole basics"],
          conceptTags: ["basic_concepts", "mole"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "some-basic-concepts",
            chapterSlug: "some-basic-concepts",
            topicSlug: "some-basic-concepts-topic-5",
            subtopicSlug: "basic-concepts",
            conceptSlug: "mole",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-basic-concepts",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that basic concepts behaves differently than mole."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on basic concepts and mole.",
          "Assertion-Reason based on basic concepts properties."
        ],
        masteryCriteria: [
          "Can accurately define basic concepts.",
          "Can solve numericals involving mole."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    }
  ]
};
