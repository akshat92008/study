import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { generateMentorRecovery } from './mentor-engine';
import { getExamConfig } from '@/lib/utils/constants';

type AutopsyFileData =
  | string
  | { kind: 'text'; text: string }
  | { kind: 'inline'; mimeType: string; data: string };

function extractJSON(text: string) {
  return text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();
}

export async function processMockAutopsy(userId: string, fileData: AutopsyFileData, testName: string, examType: string = 'NEET') {
  const examConfig = getExamConfig(examType);
  // Setup API clients
  const supabase = await createClient();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const subjectList = examConfig.subjects.join('|');
  const plainTextPayload =
    typeof fileData === 'string' ? fileData :
    fileData.kind === 'text' ? fileData.text :
    null;
  
  // 1. Initial Prompt to parse the mock paper
  const parsingPrompt = `
    You are an elite ${examType} exam parsing engine. I have provided a mock test paper, answer key, and possibly student answers/OMR markings.
    For every question, extract the following into a STRICT JSON array format:
    [{
      "questionNumber": 1,
      "subject": "${subjectList}",
      "chapter": "Chapter name",
      "subtopic": "Subtopic if inferable, otherwise null",
      "difficulty": "Easy|Medium|Hard",
      "correctAnswer": "A",
      "studentAnswer": "B", // (If student answers are provided, otherwise null)
      "status": "Correct|Incorrect|Unattempted"
    }]
    Use these exam marking rules: correct = ${examConfig.correctMarks}, incorrect penalty = ${examConfig.negativeMarks}, total marks = ${examConfig.totalMarks}.
    ONLY output valid JSON. No markdown formatting blocks or explanations.
  `;

  const contents = plainTextPayload
    ? `${parsingPrompt}\n\nDocument Data:\n${plainTextPayload}`
    : [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: (fileData as { kind: 'inline'; mimeType: string; data: string }).mimeType,
              data: (fileData as { kind: 'inline'; mimeType: string; data: string }).data,
            },
          },
          { text: parsingPrompt },
        ],
      }];

  const rawParseRes = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
  });
  
  let parsedQuestions = [];
  try {
    const rawText = extractJSON(rawParseRes.text || '');
    parsedQuestions = JSON.parse(rawText);
  } catch (err) {
    console.error("JSON parsing failed on OCR output", err);
    throw new Error('Failed to parse mock paper correctly.');
  }

  // 2. Secondary Prompt: Root Cause Analysis on incorrect questions
  const incorrectQs = parsedQuestions.filter((q: any) => q.status === 'Incorrect');
  
  const rootCausePrompt = `
    Analyze the following incorrectly answered questions. As a master diagnostician, categorize the error for each.
    Assign a 'mistakeCategory' strictly from this list: 
    ['conceptual', 'calculation', 'silly', 'time_pressure', 'misread', 'incomplete_knowledge', 'overconfidence', 'anxiety', 'recall_failure']
    
    Data: ${JSON.stringify(incorrectQs)}
    
    Return a JSON array of objects with fields: { questionNumber, mistakeCategory, suggestedFix }.
    ONLY return valid JSON. No markdown.
  `;

  const rootCauseRes = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: rootCausePrompt,
  });

  let rootCauses = [];
  try {
    const rawText = extractJSON(rootCauseRes.text || '');
    rootCauses = JSON.parse(rawText);
  } catch (err) {
    console.warn("Failed root cause analysis JSON", err);
  }

  // Map root causes back to questions
  const mappedQuestions = parsedQuestions.map((q: any) => {
    const cause = rootCauses.find((rc: any) => rc.questionNumber === q.questionNumber);
    return {
      ...q,
      mistakeCategory: cause ? cause.mistakeCategory : (q.status === 'Incorrect' ? 'conceptual' : null),
      suggestedFix: cause ? cause.suggestedFix : null,
      marksLost: q.status === 'Incorrect' ? (examConfig.correctMarks + Math.abs(examConfig.negativeMarks)) : (q.status === 'Unattempted' ? examConfig.correctMarks : 0)
    };
  });

  // Calculate scores
  const totalCorrect = mappedQuestions.filter((q: any) => q.status === 'Correct').length;
  const totalIncorrect = mappedQuestions.filter((q: any) => q.status === 'Incorrect').length;
  const currentScore = (totalCorrect * examConfig.correctMarks) - (totalIncorrect * Math.abs(examConfig.negativeMarks));
  
  // Potential score ignores 'silly', 'misread', 'time_pressure' errors
  const recoverableQs = mappedQuestions.filter((q: any) => 
    ['silly', 'misread', 'time_pressure', 'recall_failure'].includes(q.mistakeCategory)
  );
  
  const recoverableMarks = recoverableQs.reduce((sum: number, q: any) => sum + q.marksLost, 0);
  const potentialScore = currentScore + recoverableMarks;

  // Insert base autopsy record
  const { data: autopsyData, error: autopsyErr } = await (await supabase).from('mock_autopsies').insert({
    user_id: userId,
    test_name: testName,
    current_score: currentScore,
    potential_score: potentialScore,
    recoverable_marks: recoverableMarks,
    total_questions: mappedQuestions.length,
    exam_type: examType,
    ocr_raw_text: plainTextPayload,
    mentor_insight: "Processing deep mentor insights...",
    confidence_level: 'High'
  }).select().single();

  if (autopsyErr || !autopsyData) throw new Error('Failed to create autopsy record in database.');

  // Insert questions
  const qRows = mappedQuestions.map((q: any) => ({
    autopsy_id: autopsyData.id,
    question_number: q.questionNumber,
    subject: q.subject,
    chapter: q.chapter,
    subtopic: q.subtopic,
    difficulty: q.difficulty,
    status: q.status,
    correct_answer: q.correctAnswer,
    student_answer: q.studentAnswer,
    mistake_category: q.mistakeCategory,
    marks_lost: q.marksLost,
    suggested_fix: q.suggestedFix
  }));

  await (await supabase).from('autopsy_questions').insert(qRows);

  // Trigger Topper Mentor and Recovery Generation
  const incorrectQsWithData = mappedQuestions.filter((q: any) => q.status === 'Incorrect');
  const { mentorQuote, plan } = await generateMentorRecovery(autopsyData.id, currentScore, potentialScore, incorrectQsWithData);

  return { autopsyId: autopsyData.id, currentScore, potentialScore, recoverableMarks, mentorQuote, plan };
}
