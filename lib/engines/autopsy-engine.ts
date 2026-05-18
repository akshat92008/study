import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { generateMentorRecovery } from './mentor-engine';

export async function processMockAutopsy(userId: string, fileData: string, testName: string) {
  // Setup API clients
  const supabase = await createClient();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  // 1. Initial Prompt to parse the mock paper
  const parsingPrompt = `
    You are an elite exam parsing engine. I have provided the raw text/content of a mock test paper (which includes questions, options, and an answer key).
    For every question, extract the following into a STRICT JSON array format:
    [{
      "questionNumber": 1,
      "subject": "Physics|Chemistry|Biology",
      "chapter": "Chapter name",
      "difficulty": "Easy|Medium|Hard",
      "correctAnswer": "A",
      "studentAnswer": "B", // (If student answers are provided, otherwise null)
      "status": "Correct|Incorrect|Unattempted"
    }]
    ONLY output valid JSON. No markdown formatting blocks or explanations.
  `;
  
  const rawParseRes = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `${parsingPrompt}\n\nDocument Data:\n${fileData}`,
  });
  
  let parsedQuestions = [];
  try {
    const rawText = (rawParseRes.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
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
    const rawText = (rootCauseRes.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
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
      marksLost: q.status === 'Incorrect' ? 5 : (q.status === 'Unattempted' ? 4 : 0) // Example 4-mark questions, 1 neg
    };
  });

  // Calculate scores
  const totalCorrect = mappedQuestions.filter((q: any) => q.status === 'Correct').length;
  const totalIncorrect = mappedQuestions.filter((q: any) => q.status === 'Incorrect').length;
  const currentScore = (totalCorrect * 4) - (totalIncorrect * 1);
  
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
