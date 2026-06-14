import { ChapterSeed } from '../../../types';

export const chemical_thermodynamics_seed: ChapterSeed = {
  exam: "NEET",
  syllabusVersion: "NEET_UG_2026",
  subject: "Chemistry",
  unitNumber: 4,
  unitTitle: "Chemical Thermodynamics",
  chapterSlug: "chemical-thermodynamics",
  chapterTitle: "Chemical Thermodynamics",
  classLevel: "11",
  aliases: ["thermodynamics"],
  ncertMapping: ["Thermodynamics"],
  prerequisites: [],
  estimatedHours: 8,
  priority: "high",
  missions: [
    {
      id: "chemical-thermodynamics-m-0",
      title: "Thermodynamics and Enthalpy Essentials",
      description: "A comprehensive mission covering thermodynamics and enthalpy.",
      conceptTags: ["thermodynamics", "enthalpy"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "chemical-thermodynamics-mt-0-0",
        title: "Mastering Thermodynamics and Enthalpy",
        conceptTags: ["thermodynamics", "enthalpy"],
        ncertAnchors: ["NCERT paragraph on thermodynamics"],
        mustKnowFacts: [
          "The most important fact about thermodynamics is its relationship with enthalpy.",
          "Always remember the standard unit and formula for thermodynamics."
        ],
        formulas: [
          {
            name: "Standard equation for thermodynamics",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing thermodynamics with enthalpy.",
          "Forgetting the sign convention in thermodynamics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-0-0-0",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-0-1",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-0-2",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-0-3",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-0-4",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on thermodynamics and enthalpy.",
          "Assertion-Reason based on thermodynamics properties."
        ],
        masteryCriteria: [
          "Can accurately define thermodynamics.",
          "Can solve numericals involving enthalpy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-0-1",
        title: "Mastering Thermodynamics and Enthalpy",
        conceptTags: ["thermodynamics", "enthalpy"],
        ncertAnchors: ["NCERT paragraph on thermodynamics"],
        mustKnowFacts: [
          "The most important fact about thermodynamics is its relationship with enthalpy.",
          "Always remember the standard unit and formula for thermodynamics."
        ],
        formulas: [
          {
            name: "Standard equation for thermodynamics",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing thermodynamics with enthalpy.",
          "Forgetting the sign convention in thermodynamics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-0-1-0",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-1-1",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-1-2",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-1-3",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-1-4",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on thermodynamics and enthalpy.",
          "Assertion-Reason based on thermodynamics properties."
        ],
        masteryCriteria: [
          "Can accurately define thermodynamics.",
          "Can solve numericals involving enthalpy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-0-2",
        title: "Mastering Thermodynamics and Enthalpy",
        conceptTags: ["thermodynamics", "enthalpy"],
        ncertAnchors: ["NCERT paragraph on thermodynamics"],
        mustKnowFacts: [
          "The most important fact about thermodynamics is its relationship with enthalpy.",
          "Always remember the standard unit and formula for thermodynamics."
        ],
        formulas: [
          {
            name: "Standard equation for thermodynamics",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing thermodynamics with enthalpy.",
          "Forgetting the sign convention in thermodynamics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-0-2-0",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-2-1",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-2-2",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-2-3",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-2-4",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on thermodynamics and enthalpy.",
          "Assertion-Reason based on thermodynamics properties."
        ],
        masteryCriteria: [
          "Can accurately define thermodynamics.",
          "Can solve numericals involving enthalpy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-0-3",
        title: "Mastering Thermodynamics and Enthalpy",
        conceptTags: ["thermodynamics", "enthalpy"],
        ncertAnchors: ["NCERT paragraph on thermodynamics"],
        mustKnowFacts: [
          "The most important fact about thermodynamics is its relationship with enthalpy.",
          "Always remember the standard unit and formula for thermodynamics."
        ],
        formulas: [
          {
            name: "Standard equation for thermodynamics",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing thermodynamics with enthalpy.",
          "Forgetting the sign convention in thermodynamics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-0-3-0",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-3-1",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-3-2",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-3-3",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-0-3-4",
          question: "What is the primary function or definition of thermodynamics and enthalpy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with enthalpy"
          ],
          acceptedSynonyms: ["thermodynamics principle", "enthalpy basics"],
          conceptTags: ["thermodynamics", "enthalpy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "enthalpy",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than enthalpy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on thermodynamics and enthalpy.",
          "Assertion-Reason based on thermodynamics properties."
        ],
        masteryCriteria: [
          "Can accurately define thermodynamics.",
          "Can solve numericals involving enthalpy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "chemical-thermodynamics-m-1",
      title: "Enthalpy and Entropy Essentials",
      description: "A comprehensive mission covering enthalpy and entropy.",
      conceptTags: ["enthalpy", "entropy"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "chemical-thermodynamics-mt-1-0",
        title: "Mastering Enthalpy and Entropy",
        conceptTags: ["enthalpy", "entropy"],
        ncertAnchors: ["NCERT paragraph on enthalpy"],
        mustKnowFacts: [
          "The most important fact about enthalpy is its relationship with entropy.",
          "Always remember the standard unit and formula for enthalpy."
        ],
        formulas: [
          {
            name: "Standard equation for enthalpy",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing enthalpy with entropy.",
          "Forgetting the sign convention in enthalpy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-1-0-0",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-0-1",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-0-2",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-0-3",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-0-4",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on enthalpy and entropy.",
          "Assertion-Reason based on enthalpy properties."
        ],
        masteryCriteria: [
          "Can accurately define enthalpy.",
          "Can solve numericals involving entropy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-1-1",
        title: "Mastering Enthalpy and Entropy",
        conceptTags: ["enthalpy", "entropy"],
        ncertAnchors: ["NCERT paragraph on enthalpy"],
        mustKnowFacts: [
          "The most important fact about enthalpy is its relationship with entropy.",
          "Always remember the standard unit and formula for enthalpy."
        ],
        formulas: [
          {
            name: "Standard equation for enthalpy",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing enthalpy with entropy.",
          "Forgetting the sign convention in enthalpy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-1-1-0",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-1-1",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-1-2",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-1-3",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-1-4",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on enthalpy and entropy.",
          "Assertion-Reason based on enthalpy properties."
        ],
        masteryCriteria: [
          "Can accurately define enthalpy.",
          "Can solve numericals involving entropy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-1-2",
        title: "Mastering Enthalpy and Entropy",
        conceptTags: ["enthalpy", "entropy"],
        ncertAnchors: ["NCERT paragraph on enthalpy"],
        mustKnowFacts: [
          "The most important fact about enthalpy is its relationship with entropy.",
          "Always remember the standard unit and formula for enthalpy."
        ],
        formulas: [
          {
            name: "Standard equation for enthalpy",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing enthalpy with entropy.",
          "Forgetting the sign convention in enthalpy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-1-2-0",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-2-1",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-2-2",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-2-3",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-2-4",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on enthalpy and entropy.",
          "Assertion-Reason based on enthalpy properties."
        ],
        masteryCriteria: [
          "Can accurately define enthalpy.",
          "Can solve numericals involving entropy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-1-3",
        title: "Mastering Enthalpy and Entropy",
        conceptTags: ["enthalpy", "entropy"],
        ncertAnchors: ["NCERT paragraph on enthalpy"],
        mustKnowFacts: [
          "The most important fact about enthalpy is its relationship with entropy.",
          "Always remember the standard unit and formula for enthalpy."
        ],
        formulas: [
          {
            name: "Standard equation for enthalpy",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing enthalpy with entropy.",
          "Forgetting the sign convention in enthalpy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-1-3-0",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-3-1",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-3-2",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-3-3",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-1-3-4",
          question: "What is the primary function or definition of enthalpy and entropy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of enthalpy",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["enthalpy principle", "entropy basics"],
          conceptTags: ["enthalpy", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-1",
            subtopicSlug: "enthalpy",
            conceptSlug: "entropy",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-enthalpy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that enthalpy behaves differently than entropy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on enthalpy and entropy.",
          "Assertion-Reason based on enthalpy properties."
        ],
        masteryCriteria: [
          "Can accurately define enthalpy.",
          "Can solve numericals involving entropy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "chemical-thermodynamics-m-2",
      title: "Entropy and Gibbs free energy Essentials",
      description: "A comprehensive mission covering entropy and gibbs free energy.",
      conceptTags: ["entropy", "gibbs_free_energy"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "chemical-thermodynamics-mt-2-0",
        title: "Mastering Entropy and Gibbs free energy",
        conceptTags: ["entropy", "gibbs_free_energy"],
        ncertAnchors: ["NCERT paragraph on entropy"],
        mustKnowFacts: [
          "The most important fact about entropy is its relationship with gibbs free energy.",
          "Always remember the standard unit and formula for entropy."
        ],
        formulas: [
          {
            name: "Standard equation for entropy",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing entropy with gibbs free energy.",
          "Forgetting the sign convention in entropy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-2-0-0",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-0-1",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-0-2",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-0-3",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-0-4",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on entropy and gibbs free energy.",
          "Assertion-Reason based on entropy properties."
        ],
        masteryCriteria: [
          "Can accurately define entropy.",
          "Can solve numericals involving gibbs free energy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-2-1",
        title: "Mastering Entropy and Gibbs free energy",
        conceptTags: ["entropy", "gibbs_free_energy"],
        ncertAnchors: ["NCERT paragraph on entropy"],
        mustKnowFacts: [
          "The most important fact about entropy is its relationship with gibbs free energy.",
          "Always remember the standard unit and formula for entropy."
        ],
        formulas: [
          {
            name: "Standard equation for entropy",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing entropy with gibbs free energy.",
          "Forgetting the sign convention in entropy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-2-1-0",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-1-1",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-1-2",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-1-3",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-1-4",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on entropy and gibbs free energy.",
          "Assertion-Reason based on entropy properties."
        ],
        masteryCriteria: [
          "Can accurately define entropy.",
          "Can solve numericals involving gibbs free energy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-2-2",
        title: "Mastering Entropy and Gibbs free energy",
        conceptTags: ["entropy", "gibbs_free_energy"],
        ncertAnchors: ["NCERT paragraph on entropy"],
        mustKnowFacts: [
          "The most important fact about entropy is its relationship with gibbs free energy.",
          "Always remember the standard unit and formula for entropy."
        ],
        formulas: [
          {
            name: "Standard equation for entropy",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing entropy with gibbs free energy.",
          "Forgetting the sign convention in entropy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-2-2-0",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-2-1",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-2-2",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-2-3",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-2-4",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on entropy and gibbs free energy.",
          "Assertion-Reason based on entropy properties."
        ],
        masteryCriteria: [
          "Can accurately define entropy.",
          "Can solve numericals involving gibbs free energy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-2-3",
        title: "Mastering Entropy and Gibbs free energy",
        conceptTags: ["entropy", "gibbs_free_energy"],
        ncertAnchors: ["NCERT paragraph on entropy"],
        mustKnowFacts: [
          "The most important fact about entropy is its relationship with gibbs free energy.",
          "Always remember the standard unit and formula for entropy."
        ],
        formulas: [
          {
            name: "Standard equation for entropy",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing entropy with gibbs free energy.",
          "Forgetting the sign convention in entropy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-2-3-0",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-3-1",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-3-2",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-3-3",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-2-3-4",
          question: "What is the primary function or definition of entropy and gibbs free energy in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with gibbs free energy"
          ],
          acceptedSynonyms: ["entropy principle", "gibbs free energy basics"],
          conceptTags: ["entropy", "gibbs_free_energy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-2",
            subtopicSlug: "entropy",
            conceptSlug: "gibbs-free-energy",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than gibbs free energy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on entropy and gibbs free energy.",
          "Assertion-Reason based on entropy properties."
        ],
        masteryCriteria: [
          "Can accurately define entropy.",
          "Can solve numericals involving gibbs free energy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "chemical-thermodynamics-m-3",
      title: "Gibbs free energy and Hess law Essentials",
      description: "A comprehensive mission covering gibbs free energy and hess law.",
      conceptTags: ["gibbs_free_energy", "hess_law"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "chemical-thermodynamics-mt-3-0",
        title: "Mastering Gibbs free energy and Hess law",
        conceptTags: ["gibbs_free_energy", "hess_law"],
        ncertAnchors: ["NCERT paragraph on gibbs free energy"],
        mustKnowFacts: [
          "The most important fact about gibbs free energy is its relationship with hess law.",
          "Always remember the standard unit and formula for gibbs free energy."
        ],
        formulas: [
          {
            name: "Standard equation for gibbs free energy",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing gibbs free energy with hess law.",
          "Forgetting the sign convention in gibbs free energy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-3-0-0",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-0-1",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-0-2",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-0-3",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-0-4",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on gibbs free energy and hess law.",
          "Assertion-Reason based on gibbs free energy properties."
        ],
        masteryCriteria: [
          "Can accurately define gibbs free energy.",
          "Can solve numericals involving hess law."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-3-1",
        title: "Mastering Gibbs free energy and Hess law",
        conceptTags: ["gibbs_free_energy", "hess_law"],
        ncertAnchors: ["NCERT paragraph on gibbs free energy"],
        mustKnowFacts: [
          "The most important fact about gibbs free energy is its relationship with hess law.",
          "Always remember the standard unit and formula for gibbs free energy."
        ],
        formulas: [
          {
            name: "Standard equation for gibbs free energy",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing gibbs free energy with hess law.",
          "Forgetting the sign convention in gibbs free energy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-3-1-0",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-1-1",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-1-2",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-1-3",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-1-4",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on gibbs free energy and hess law.",
          "Assertion-Reason based on gibbs free energy properties."
        ],
        masteryCriteria: [
          "Can accurately define gibbs free energy.",
          "Can solve numericals involving hess law."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-3-2",
        title: "Mastering Gibbs free energy and Hess law",
        conceptTags: ["gibbs_free_energy", "hess_law"],
        ncertAnchors: ["NCERT paragraph on gibbs free energy"],
        mustKnowFacts: [
          "The most important fact about gibbs free energy is its relationship with hess law.",
          "Always remember the standard unit and formula for gibbs free energy."
        ],
        formulas: [
          {
            name: "Standard equation for gibbs free energy",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing gibbs free energy with hess law.",
          "Forgetting the sign convention in gibbs free energy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-3-2-0",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-2-1",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-2-2",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-2-3",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-2-4",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on gibbs free energy and hess law.",
          "Assertion-Reason based on gibbs free energy properties."
        ],
        masteryCriteria: [
          "Can accurately define gibbs free energy.",
          "Can solve numericals involving hess law."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-3-3",
        title: "Mastering Gibbs free energy and Hess law",
        conceptTags: ["gibbs_free_energy", "hess_law"],
        ncertAnchors: ["NCERT paragraph on gibbs free energy"],
        mustKnowFacts: [
          "The most important fact about gibbs free energy is its relationship with hess law.",
          "Always remember the standard unit and formula for gibbs free energy."
        ],
        formulas: [
          {
            name: "Standard equation for gibbs free energy",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing gibbs free energy with hess law.",
          "Forgetting the sign convention in gibbs free energy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-3-3-0",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-3-1",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-3-2",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-3-3",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-3-3-4",
          question: "What is the primary function or definition of gibbs free energy and hess law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of gibbs free energy",
            "It interacts with hess law"
          ],
          acceptedSynonyms: ["gibbs free energy principle", "hess law basics"],
          conceptTags: ["gibbs_free_energy", "hess_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-3",
            subtopicSlug: "gibbs-free-energy",
            conceptSlug: "hess-law",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-gibbs-free-energy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that gibbs free energy behaves differently than hess law."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on gibbs free energy and hess law.",
          "Assertion-Reason based on gibbs free energy properties."
        ],
        masteryCriteria: [
          "Can accurately define gibbs free energy.",
          "Can solve numericals involving hess law."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "chemical-thermodynamics-m-4",
      title: "Hess law and First law Essentials",
      description: "A comprehensive mission covering hess law and first law.",
      conceptTags: ["hess_law", "first_law"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "chemical-thermodynamics-mt-4-0",
        title: "Mastering Hess law and First law",
        conceptTags: ["hess_law", "first_law"],
        ncertAnchors: ["NCERT paragraph on hess law"],
        mustKnowFacts: [
          "The most important fact about hess law is its relationship with first law.",
          "Always remember the standard unit and formula for hess law."
        ],
        formulas: [
          {
            name: "Standard equation for hess law",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing hess law with first law.",
          "Forgetting the sign convention in hess law calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-4-0-0",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-0-1",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-0-2",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-0-3",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-0-4",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on hess law and first law.",
          "Assertion-Reason based on hess law properties."
        ],
        masteryCriteria: [
          "Can accurately define hess law.",
          "Can solve numericals involving first law."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-4-1",
        title: "Mastering Hess law and First law",
        conceptTags: ["hess_law", "first_law"],
        ncertAnchors: ["NCERT paragraph on hess law"],
        mustKnowFacts: [
          "The most important fact about hess law is its relationship with first law.",
          "Always remember the standard unit and formula for hess law."
        ],
        formulas: [
          {
            name: "Standard equation for hess law",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing hess law with first law.",
          "Forgetting the sign convention in hess law calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-4-1-0",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-1-1",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-1-2",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-1-3",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-1-4",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on hess law and first law.",
          "Assertion-Reason based on hess law properties."
        ],
        masteryCriteria: [
          "Can accurately define hess law.",
          "Can solve numericals involving first law."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-4-2",
        title: "Mastering Hess law and First law",
        conceptTags: ["hess_law", "first_law"],
        ncertAnchors: ["NCERT paragraph on hess law"],
        mustKnowFacts: [
          "The most important fact about hess law is its relationship with first law.",
          "Always remember the standard unit and formula for hess law."
        ],
        formulas: [
          {
            name: "Standard equation for hess law",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing hess law with first law.",
          "Forgetting the sign convention in hess law calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-4-2-0",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-2-1",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-2-2",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-2-3",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-2-4",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on hess law and first law.",
          "Assertion-Reason based on hess law properties."
        ],
        masteryCriteria: [
          "Can accurately define hess law.",
          "Can solve numericals involving first law."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-4-3",
        title: "Mastering Hess law and First law",
        conceptTags: ["hess_law", "first_law"],
        ncertAnchors: ["NCERT paragraph on hess law"],
        mustKnowFacts: [
          "The most important fact about hess law is its relationship with first law.",
          "Always remember the standard unit and formula for hess law."
        ],
        formulas: [
          {
            name: "Standard equation for hess law",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing hess law with first law.",
          "Forgetting the sign convention in hess law calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-4-3-0",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-3-1",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-3-2",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-3-3",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-4-3-4",
          question: "What is the primary function or definition of hess law and first law in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of hess law",
            "It interacts with first law"
          ],
          acceptedSynonyms: ["hess law principle", "first law basics"],
          conceptTags: ["hess_law", "first_law"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-4",
            subtopicSlug: "hess-law",
            conceptSlug: "first-law",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-hess-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that hess law behaves differently than first law."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on hess law and first law.",
          "Assertion-Reason based on hess law properties."
        ],
        masteryCriteria: [
          "Can accurately define hess law.",
          "Can solve numericals involving first law."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "chemical-thermodynamics-m-5",
      title: "First law and Thermodynamics Essentials",
      description: "A comprehensive mission covering first law and thermodynamics.",
      conceptTags: ["first_law", "thermodynamics"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "chemical-thermodynamics-mt-5-0",
        title: "Mastering First law and Thermodynamics",
        conceptTags: ["first_law", "thermodynamics"],
        ncertAnchors: ["NCERT paragraph on first law"],
        mustKnowFacts: [
          "The most important fact about first law is its relationship with thermodynamics.",
          "Always remember the standard unit and formula for first law."
        ],
        formulas: [
          {
            name: "Standard equation for first law",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing first law with thermodynamics.",
          "Forgetting the sign convention in first law calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-5-0-0",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-0-1",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-0-2",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-0-3",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-0-4",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on first law and thermodynamics.",
          "Assertion-Reason based on first law properties."
        ],
        masteryCriteria: [
          "Can accurately define first law.",
          "Can solve numericals involving thermodynamics."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-5-1",
        title: "Mastering First law and Thermodynamics",
        conceptTags: ["first_law", "thermodynamics"],
        ncertAnchors: ["NCERT paragraph on first law"],
        mustKnowFacts: [
          "The most important fact about first law is its relationship with thermodynamics.",
          "Always remember the standard unit and formula for first law."
        ],
        formulas: [
          {
            name: "Standard equation for first law",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing first law with thermodynamics.",
          "Forgetting the sign convention in first law calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-5-1-0",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-1-1",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-1-2",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-1-3",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-1-4",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on first law and thermodynamics.",
          "Assertion-Reason based on first law properties."
        ],
        masteryCriteria: [
          "Can accurately define first law.",
          "Can solve numericals involving thermodynamics."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-5-2",
        title: "Mastering First law and Thermodynamics",
        conceptTags: ["first_law", "thermodynamics"],
        ncertAnchors: ["NCERT paragraph on first law"],
        mustKnowFacts: [
          "The most important fact about first law is its relationship with thermodynamics.",
          "Always remember the standard unit and formula for first law."
        ],
        formulas: [
          {
            name: "Standard equation for first law",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing first law with thermodynamics.",
          "Forgetting the sign convention in first law calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-5-2-0",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-2-1",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-2-2",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-2-3",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-2-4",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on first law and thermodynamics.",
          "Assertion-Reason based on first law properties."
        ],
        masteryCriteria: [
          "Can accurately define first law.",
          "Can solve numericals involving thermodynamics."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "chemical-thermodynamics-mt-5-3",
        title: "Mastering First law and Thermodynamics",
        conceptTags: ["first_law", "thermodynamics"],
        ncertAnchors: ["NCERT paragraph on first law"],
        mustKnowFacts: [
          "The most important fact about first law is its relationship with thermodynamics.",
          "Always remember the standard unit and formula for first law."
        ],
        formulas: [
          {
            name: "Standard equation for first law",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing first law with thermodynamics.",
          "Forgetting the sign convention in first law calculations."
        ],
        activeRecallQuestions: [
          {
          id: "chemical-thermodynamics-q-5-3-0",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-3-1",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-3-2",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-3-3",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "chemical-thermodynamics-q-5-3-4",
          question: "What is the primary function or definition of first law and thermodynamics in the context of Chemical Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of first law",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["first law principle", "thermodynamics basics"],
          conceptTags: ["first_law", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Chemistry",
            unitSlug: "chemical-thermodynamics",
            chapterSlug: "chemical-thermodynamics",
            topicSlug: "chemical-thermodynamics-topic-5",
            subtopicSlug: "first-law",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-first-law",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that first law behaves differently than thermodynamics."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on first law and thermodynamics.",
          "Assertion-Reason based on first law properties."
        ],
        masteryCriteria: [
          "Can accurately define first law.",
          "Can solve numericals involving thermodynamics."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    }
  ]
};
