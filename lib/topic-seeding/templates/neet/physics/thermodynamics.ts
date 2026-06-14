import { ChapterSeed } from '../../../types';

export const thermodynamics_seed: ChapterSeed = {
  exam: "NEET",
  syllabusVersion: "NEET_UG_2026",
  subject: "Physics",
  unitNumber: 8,
  unitTitle: "Thermodynamics",
  chapterSlug: "thermodynamics",
  chapterTitle: "Thermodynamics",
  classLevel: "11",
  aliases: ["thermal physics","heat transfer"],
  ncertMapping: ["Thermodynamics","Thermal Properties of Matter"],
  prerequisites: [],
  estimatedHours: 8,
  priority: "high",
  missions: [
    {
      id: "thermodynamics-m-0",
      title: "Thermodynamics and Heat Essentials",
      description: "A comprehensive mission covering thermodynamics and heat.",
      conceptTags: ["thermodynamics", "heat"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "thermodynamics-mt-0-0",
        title: "Mastering Thermodynamics and Heat",
        conceptTags: ["thermodynamics", "heat"],
        ncertAnchors: ["NCERT paragraph on thermodynamics"],
        mustKnowFacts: [
          "The most important fact about thermodynamics is its relationship with heat.",
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
          "Confusing thermodynamics with heat.",
          "Forgetting the sign convention in thermodynamics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-0-0-0",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-0-1",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-0-2",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-0-3",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-0-4",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on thermodynamics and heat.",
          "Assertion-Reason based on thermodynamics properties."
        ],
        masteryCriteria: [
          "Can accurately define thermodynamics.",
          "Can solve numericals involving heat."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-0-1",
        title: "Mastering Thermodynamics and Heat",
        conceptTags: ["thermodynamics", "heat"],
        ncertAnchors: ["NCERT paragraph on thermodynamics"],
        mustKnowFacts: [
          "The most important fact about thermodynamics is its relationship with heat.",
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
          "Confusing thermodynamics with heat.",
          "Forgetting the sign convention in thermodynamics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-0-1-0",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-1-1",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-1-2",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-1-3",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-1-4",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on thermodynamics and heat.",
          "Assertion-Reason based on thermodynamics properties."
        ],
        masteryCriteria: [
          "Can accurately define thermodynamics.",
          "Can solve numericals involving heat."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-0-2",
        title: "Mastering Thermodynamics and Heat",
        conceptTags: ["thermodynamics", "heat"],
        ncertAnchors: ["NCERT paragraph on thermodynamics"],
        mustKnowFacts: [
          "The most important fact about thermodynamics is its relationship with heat.",
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
          "Confusing thermodynamics with heat.",
          "Forgetting the sign convention in thermodynamics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-0-2-0",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-2-1",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-2-2",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-2-3",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-2-4",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on thermodynamics and heat.",
          "Assertion-Reason based on thermodynamics properties."
        ],
        masteryCriteria: [
          "Can accurately define thermodynamics.",
          "Can solve numericals involving heat."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-0-3",
        title: "Mastering Thermodynamics and Heat",
        conceptTags: ["thermodynamics", "heat"],
        ncertAnchors: ["NCERT paragraph on thermodynamics"],
        mustKnowFacts: [
          "The most important fact about thermodynamics is its relationship with heat.",
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
          "Confusing thermodynamics with heat.",
          "Forgetting the sign convention in thermodynamics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-0-3-0",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-3-1",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-3-2",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-3-3",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-0-3-4",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-0",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on thermodynamics and heat.",
          "Assertion-Reason based on thermodynamics properties."
        ],
        masteryCriteria: [
          "Can accurately define thermodynamics.",
          "Can solve numericals involving heat."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "thermodynamics-m-1",
      title: "Heat and Temperature Essentials",
      description: "A comprehensive mission covering heat and temperature.",
      conceptTags: ["heat", "temperature"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "thermodynamics-mt-1-0",
        title: "Mastering Heat and Temperature",
        conceptTags: ["heat", "temperature"],
        ncertAnchors: ["NCERT paragraph on heat"],
        mustKnowFacts: [
          "The most important fact about heat is its relationship with temperature.",
          "Always remember the standard unit and formula for heat."
        ],
        formulas: [
          {
            name: "Standard equation for heat",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing heat with temperature.",
          "Forgetting the sign convention in heat calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-1-0-0",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-0-1",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-0-2",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-0-3",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-0-4",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on heat and temperature.",
          "Assertion-Reason based on heat properties."
        ],
        masteryCriteria: [
          "Can accurately define heat.",
          "Can solve numericals involving temperature."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-1-1",
        title: "Mastering Heat and Temperature",
        conceptTags: ["heat", "temperature"],
        ncertAnchors: ["NCERT paragraph on heat"],
        mustKnowFacts: [
          "The most important fact about heat is its relationship with temperature.",
          "Always remember the standard unit and formula for heat."
        ],
        formulas: [
          {
            name: "Standard equation for heat",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing heat with temperature.",
          "Forgetting the sign convention in heat calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-1-1-0",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-1-1",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-1-2",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-1-3",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-1-4",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on heat and temperature.",
          "Assertion-Reason based on heat properties."
        ],
        masteryCriteria: [
          "Can accurately define heat.",
          "Can solve numericals involving temperature."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-1-2",
        title: "Mastering Heat and Temperature",
        conceptTags: ["heat", "temperature"],
        ncertAnchors: ["NCERT paragraph on heat"],
        mustKnowFacts: [
          "The most important fact about heat is its relationship with temperature.",
          "Always remember the standard unit and formula for heat."
        ],
        formulas: [
          {
            name: "Standard equation for heat",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing heat with temperature.",
          "Forgetting the sign convention in heat calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-1-2-0",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-2-1",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-2-2",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-2-3",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-2-4",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on heat and temperature.",
          "Assertion-Reason based on heat properties."
        ],
        masteryCriteria: [
          "Can accurately define heat.",
          "Can solve numericals involving temperature."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-1-3",
        title: "Mastering Heat and Temperature",
        conceptTags: ["heat", "temperature"],
        ncertAnchors: ["NCERT paragraph on heat"],
        mustKnowFacts: [
          "The most important fact about heat is its relationship with temperature.",
          "Always remember the standard unit and formula for heat."
        ],
        formulas: [
          {
            name: "Standard equation for heat",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing heat with temperature.",
          "Forgetting the sign convention in heat calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-1-3-0",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-3-1",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-3-2",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-3-3",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        },
          {
          id: "thermodynamics-q-1-3-4",
          question: "What is the primary function or definition of heat and temperature in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of heat",
            "It interacts with temperature"
          ],
          acceptedSynonyms: ["heat principle", "temperature basics"],
          conceptTags: ["heat", "temperature"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-1",
            subtopicSlug: "heat",
            conceptSlug: "temperature",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-heat",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that heat behaves differently than temperature."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on heat and temperature.",
          "Assertion-Reason based on heat properties."
        ],
        masteryCriteria: [
          "Can accurately define heat.",
          "Can solve numericals involving temperature."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "thermodynamics-m-2",
      title: "Temperature and Carnot Essentials",
      description: "A comprehensive mission covering temperature and carnot.",
      conceptTags: ["temperature", "carnot"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "thermodynamics-mt-2-0",
        title: "Mastering Temperature and Carnot",
        conceptTags: ["temperature", "carnot"],
        ncertAnchors: ["NCERT paragraph on temperature"],
        mustKnowFacts: [
          "The most important fact about temperature is its relationship with carnot.",
          "Always remember the standard unit and formula for temperature."
        ],
        formulas: [
          {
            name: "Standard equation for temperature",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing temperature with carnot.",
          "Forgetting the sign convention in temperature calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-2-0-0",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-0-1",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-0-2",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-0-3",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-0-4",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on temperature and carnot.",
          "Assertion-Reason based on temperature properties."
        ],
        masteryCriteria: [
          "Can accurately define temperature.",
          "Can solve numericals involving carnot."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-2-1",
        title: "Mastering Temperature and Carnot",
        conceptTags: ["temperature", "carnot"],
        ncertAnchors: ["NCERT paragraph on temperature"],
        mustKnowFacts: [
          "The most important fact about temperature is its relationship with carnot.",
          "Always remember the standard unit and formula for temperature."
        ],
        formulas: [
          {
            name: "Standard equation for temperature",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing temperature with carnot.",
          "Forgetting the sign convention in temperature calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-2-1-0",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-1-1",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-1-2",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-1-3",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-1-4",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on temperature and carnot.",
          "Assertion-Reason based on temperature properties."
        ],
        masteryCriteria: [
          "Can accurately define temperature.",
          "Can solve numericals involving carnot."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-2-2",
        title: "Mastering Temperature and Carnot",
        conceptTags: ["temperature", "carnot"],
        ncertAnchors: ["NCERT paragraph on temperature"],
        mustKnowFacts: [
          "The most important fact about temperature is its relationship with carnot.",
          "Always remember the standard unit and formula for temperature."
        ],
        formulas: [
          {
            name: "Standard equation for temperature",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing temperature with carnot.",
          "Forgetting the sign convention in temperature calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-2-2-0",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-2-1",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-2-2",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-2-3",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-2-4",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on temperature and carnot.",
          "Assertion-Reason based on temperature properties."
        ],
        masteryCriteria: [
          "Can accurately define temperature.",
          "Can solve numericals involving carnot."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-2-3",
        title: "Mastering Temperature and Carnot",
        conceptTags: ["temperature", "carnot"],
        ncertAnchors: ["NCERT paragraph on temperature"],
        mustKnowFacts: [
          "The most important fact about temperature is its relationship with carnot.",
          "Always remember the standard unit and formula for temperature."
        ],
        formulas: [
          {
            name: "Standard equation for temperature",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing temperature with carnot.",
          "Forgetting the sign convention in temperature calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-2-3-0",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-3-1",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-3-2",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-3-3",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        },
          {
          id: "thermodynamics-q-2-3-4",
          question: "What is the primary function or definition of temperature and carnot in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of temperature",
            "It interacts with carnot"
          ],
          acceptedSynonyms: ["temperature principle", "carnot basics"],
          conceptTags: ["temperature", "carnot"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-2",
            subtopicSlug: "temperature",
            conceptSlug: "carnot",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-temperature",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that temperature behaves differently than carnot."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on temperature and carnot.",
          "Assertion-Reason based on temperature properties."
        ],
        masteryCriteria: [
          "Can accurately define temperature.",
          "Can solve numericals involving carnot."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "thermodynamics-m-3",
      title: "Carnot and Entropy Essentials",
      description: "A comprehensive mission covering carnot and entropy.",
      conceptTags: ["carnot", "entropy"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "thermodynamics-mt-3-0",
        title: "Mastering Carnot and Entropy",
        conceptTags: ["carnot", "entropy"],
        ncertAnchors: ["NCERT paragraph on carnot"],
        mustKnowFacts: [
          "The most important fact about carnot is its relationship with entropy.",
          "Always remember the standard unit and formula for carnot."
        ],
        formulas: [
          {
            name: "Standard equation for carnot",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing carnot with entropy.",
          "Forgetting the sign convention in carnot calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-3-0-0",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-0-1",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-0-2",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-0-3",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-0-4",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on carnot and entropy.",
          "Assertion-Reason based on carnot properties."
        ],
        masteryCriteria: [
          "Can accurately define carnot.",
          "Can solve numericals involving entropy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-3-1",
        title: "Mastering Carnot and Entropy",
        conceptTags: ["carnot", "entropy"],
        ncertAnchors: ["NCERT paragraph on carnot"],
        mustKnowFacts: [
          "The most important fact about carnot is its relationship with entropy.",
          "Always remember the standard unit and formula for carnot."
        ],
        formulas: [
          {
            name: "Standard equation for carnot",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing carnot with entropy.",
          "Forgetting the sign convention in carnot calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-3-1-0",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-1-1",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-1-2",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-1-3",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-1-4",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on carnot and entropy.",
          "Assertion-Reason based on carnot properties."
        ],
        masteryCriteria: [
          "Can accurately define carnot.",
          "Can solve numericals involving entropy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-3-2",
        title: "Mastering Carnot and Entropy",
        conceptTags: ["carnot", "entropy"],
        ncertAnchors: ["NCERT paragraph on carnot"],
        mustKnowFacts: [
          "The most important fact about carnot is its relationship with entropy.",
          "Always remember the standard unit and formula for carnot."
        ],
        formulas: [
          {
            name: "Standard equation for carnot",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing carnot with entropy.",
          "Forgetting the sign convention in carnot calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-3-2-0",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-2-1",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-2-2",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-2-3",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-2-4",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on carnot and entropy.",
          "Assertion-Reason based on carnot properties."
        ],
        masteryCriteria: [
          "Can accurately define carnot.",
          "Can solve numericals involving entropy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-3-3",
        title: "Mastering Carnot and Entropy",
        conceptTags: ["carnot", "entropy"],
        ncertAnchors: ["NCERT paragraph on carnot"],
        mustKnowFacts: [
          "The most important fact about carnot is its relationship with entropy.",
          "Always remember the standard unit and formula for carnot."
        ],
        formulas: [
          {
            name: "Standard equation for carnot",
            expression: "X = Y + Z",
            variables: ["X", "Y", "Z"],
            conditions: ["Standard temperature and pressure"]
          }
        ],
        commonTraps: [
          "Confusing carnot with entropy.",
          "Forgetting the sign convention in carnot calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-3-3-0",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-3-1",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-3-2",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-3-3",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        },
          {
          id: "thermodynamics-q-3-3-4",
          question: "What is the primary function or definition of carnot and entropy in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of carnot",
            "It interacts with entropy"
          ],
          acceptedSynonyms: ["carnot principle", "entropy basics"],
          conceptTags: ["carnot", "entropy"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-3",
            subtopicSlug: "carnot",
            conceptSlug: "entropy",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-carnot",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that carnot behaves differently than entropy."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on carnot and entropy.",
          "Assertion-Reason based on carnot properties."
        ],
        masteryCriteria: [
          "Can accurately define carnot.",
          "Can solve numericals involving entropy."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "thermodynamics-m-4",
      title: "Entropy and Thermodynamics Essentials",
      description: "A comprehensive mission covering entropy and thermodynamics.",
      conceptTags: ["entropy", "thermodynamics"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "thermodynamics-mt-4-0",
        title: "Mastering Entropy and Thermodynamics",
        conceptTags: ["entropy", "thermodynamics"],
        ncertAnchors: ["NCERT paragraph on entropy"],
        mustKnowFacts: [
          "The most important fact about entropy is its relationship with thermodynamics.",
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
          "Confusing entropy with thermodynamics.",
          "Forgetting the sign convention in entropy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-4-0-0",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-0-1",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-0-2",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-0-3",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-0-4",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on entropy and thermodynamics.",
          "Assertion-Reason based on entropy properties."
        ],
        masteryCriteria: [
          "Can accurately define entropy.",
          "Can solve numericals involving thermodynamics."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-4-1",
        title: "Mastering Entropy and Thermodynamics",
        conceptTags: ["entropy", "thermodynamics"],
        ncertAnchors: ["NCERT paragraph on entropy"],
        mustKnowFacts: [
          "The most important fact about entropy is its relationship with thermodynamics.",
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
          "Confusing entropy with thermodynamics.",
          "Forgetting the sign convention in entropy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-4-1-0",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-1-1",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-1-2",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-1-3",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-1-4",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on entropy and thermodynamics.",
          "Assertion-Reason based on entropy properties."
        ],
        masteryCriteria: [
          "Can accurately define entropy.",
          "Can solve numericals involving thermodynamics."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-4-2",
        title: "Mastering Entropy and Thermodynamics",
        conceptTags: ["entropy", "thermodynamics"],
        ncertAnchors: ["NCERT paragraph on entropy"],
        mustKnowFacts: [
          "The most important fact about entropy is its relationship with thermodynamics.",
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
          "Confusing entropy with thermodynamics.",
          "Forgetting the sign convention in entropy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-4-2-0",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-2-1",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-2-2",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-2-3",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-2-4",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on entropy and thermodynamics.",
          "Assertion-Reason based on entropy properties."
        ],
        masteryCriteria: [
          "Can accurately define entropy.",
          "Can solve numericals involving thermodynamics."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-4-3",
        title: "Mastering Entropy and Thermodynamics",
        conceptTags: ["entropy", "thermodynamics"],
        ncertAnchors: ["NCERT paragraph on entropy"],
        mustKnowFacts: [
          "The most important fact about entropy is its relationship with thermodynamics.",
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
          "Confusing entropy with thermodynamics.",
          "Forgetting the sign convention in entropy calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-4-3-0",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-3-1",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-3-2",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-3-3",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        },
          {
          id: "thermodynamics-q-4-3-4",
          question: "What is the primary function or definition of entropy and thermodynamics in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of entropy",
            "It interacts with thermodynamics"
          ],
          acceptedSynonyms: ["entropy principle", "thermodynamics basics"],
          conceptTags: ["entropy", "thermodynamics"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-4",
            subtopicSlug: "entropy",
            conceptSlug: "thermodynamics",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-entropy",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that entropy behaves differently than thermodynamics."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on entropy and thermodynamics.",
          "Assertion-Reason based on entropy properties."
        ],
        masteryCriteria: [
          "Can accurately define entropy.",
          "Can solve numericals involving thermodynamics."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    },
    {
      id: "thermodynamics-m-5",
      title: "Thermodynamics and Heat Essentials",
      description: "A comprehensive mission covering thermodynamics and heat.",
      conceptTags: ["thermodynamics", "heat"],
      estimatedMinutes: 120,
      difficulty: "medium" as const,
      microtargets: [
        {
        id: "thermodynamics-mt-5-0",
        title: "Mastering Thermodynamics and Heat",
        conceptTags: ["thermodynamics", "heat"],
        ncertAnchors: ["NCERT paragraph on thermodynamics"],
        mustKnowFacts: [
          "The most important fact about thermodynamics is its relationship with heat.",
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
          "Confusing thermodynamics with heat.",
          "Forgetting the sign convention in thermodynamics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-5-0-0",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-0-0"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-0-1",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-0-1"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-0-2",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-0-2"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-0-3",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-0-3"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-0-4",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-0-4"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on thermodynamics and heat.",
          "Assertion-Reason based on thermodynamics properties."
        ],
        masteryCriteria: [
          "Can accurately define thermodynamics.",
          "Can solve numericals involving heat."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-5-1",
        title: "Mastering Thermodynamics and Heat",
        conceptTags: ["thermodynamics", "heat"],
        ncertAnchors: ["NCERT paragraph on thermodynamics"],
        mustKnowFacts: [
          "The most important fact about thermodynamics is its relationship with heat.",
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
          "Confusing thermodynamics with heat.",
          "Forgetting the sign convention in thermodynamics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-5-1-0",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-1-0"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-1-1",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-1-1"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-1-2",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-1-2"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-1-3",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-1-3"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-1-4",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-1-4"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on thermodynamics and heat.",
          "Assertion-Reason based on thermodynamics properties."
        ],
        masteryCriteria: [
          "Can accurately define thermodynamics.",
          "Can solve numericals involving heat."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-5-2",
        title: "Mastering Thermodynamics and Heat",
        conceptTags: ["thermodynamics", "heat"],
        ncertAnchors: ["NCERT paragraph on thermodynamics"],
        mustKnowFacts: [
          "The most important fact about thermodynamics is its relationship with heat.",
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
          "Confusing thermodynamics with heat.",
          "Forgetting the sign convention in thermodynamics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-5-2-0",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-2-0"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-2-1",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-2-1"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-2-2",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-2-2"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-2-3",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-2-3"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-2-4",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-2-4"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on thermodynamics and heat.",
          "Assertion-Reason based on thermodynamics properties."
        ],
        masteryCriteria: [
          "Can accurately define thermodynamics.",
          "Can solve numericals involving heat."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      },
        {
        id: "thermodynamics-mt-5-3",
        title: "Mastering Thermodynamics and Heat",
        conceptTags: ["thermodynamics", "heat"],
        ncertAnchors: ["NCERT paragraph on thermodynamics"],
        mustKnowFacts: [
          "The most important fact about thermodynamics is its relationship with heat.",
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
          "Confusing thermodynamics with heat.",
          "Forgetting the sign convention in thermodynamics calculations."
        ],
        activeRecallQuestions: [
          {
          id: "thermodynamics-q-5-3-0",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-3-0"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-3-1",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-3-1"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-3-2",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-3-2"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-3-3",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-3-3"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        },
          {
          id: "thermodynamics-q-5-3-4",
          question: "What is the primary function or definition of thermodynamics and heat in the context of Thermodynamics?",
          expectedAnswerPoints: [
            "It relates to the core principle of thermodynamics",
            "It interacts with heat"
          ],
          acceptedSynonyms: ["thermodynamics principle", "heat basics"],
          conceptTags: ["thermodynamics", "heat"],
          difficulty: "medium" as const,
          taxonomyPath: {
            subject: "Physics",
            unitSlug: "thermodynamics",
            chapterSlug: "thermodynamics",
            topicSlug: "thermodynamics-topic-5",
            subtopicSlug: "thermodynamics",
            conceptSlug: "heat",
            microskillSlug: "skill-3-4"
          },
          errorPatterns: [
            {
              slug: "confuses-thermodynamics",
              trigger: "user swaps the definitions",
              severity: "medium",
              feedback: "Remember that thermodynamics behaves differently than heat."
            }
          ]
        }
        ],
        pyqPatterns: [
          "Numerical on thermodynamics and heat.",
          "Assertion-Reason based on thermodynamics properties."
        ],
        masteryCriteria: [
          "Can accurately define thermodynamics.",
          "Can solve numericals involving heat."
        ],
        estimatedMinutes: 30,
        difficulty: "medium" as const
      }
      ]
    }
  ]
};
