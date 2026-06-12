'use client';

import { ArrowRight, FileText, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import AssessmentCreateStep from './AssessmentCreateStep';
import UploadAssessmentStep from './UploadAssessmentStep';
import QuestionTableEditor from './QuestionTableEditor';
import AnswerKeyInput from './AnswerKeyInput';
import UserReasonStep from './UserReasonStep';
import AutopsyReportView from './AutopsyReportView';
import ManualEntryFallback from './ManualEntryFallback';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { useAppStore } from '@/stores/appStore';
import { useMemo, useState } from 'react';

const DEFAULT_ROWS = [
  'question_number,subject,topic,correct_answer,user_answer',
  '1,Physics,Ray Optics,A,B',
  '2,Chemistry,Chemical Bonding,C,C',
  '3,Biology,Plant Physiology,D,',
].join('\n');

export default function DeepAutopsyShell() {
  const { activeGoalId } = useAppStore();
  const [title, setTitle] = useState('Deep Autopsy');
  const [assessmentType, setAssessmentType] = useState('custom');
  const [assessment, setAssessment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [reasons, setReasons] = useState<Record<string, { userReasonCategory: string; userReason: string }>>({});
  const [csvText, setCsvText] = useState(DEFAULT_ROWS);
  const [answerKeyText, setAnswerKeyText] = useState('');
  const [report, setReport] = useState<any>(null);
  const [memories, setMemories] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reflection, setReflection] = useState('');
  const [manualFallback, setManualFallback] = useState('');

  const wrongCount = useMemo(
    () => questions.filter((question) => ['incorrect', 'skipped', 'unattempted'].includes(question.status)).length,
    [questions]
  );

  async function ensureAssessment(source: 'manual' | 'pdf' | 'csv' = 'manual') {
    if (assessment?.id) return assessment;
    const response = await fetch('/api/autopsy/v3/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goalId: activeGoalId,
        title,
        assessmentType: assessmentType === 'self_reflection' ? 'custom' : assessmentType,
        source,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Assessment could not be created.');
    setAssessment(data.assessment);
    return data.assessment;
  }

  async function handleSaveQuestions() {
    setSaving(true);
    setStatus('Saving questions...');
    try {
      const currentAssessment = await ensureAssessment('csv');
      const parsedRows = parseQuestionRows(csvText);
      if (parsedRows.length === 0) throw new Error('No question rows found.');
      const response = await fetch(`/api/autopsy/v3/assessments/${currentAssessment.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: parsedRows }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Questions could not be saved.');
      setQuestions(data.questions ?? []);
      setStatus(`${data.questions?.length ?? 0} questions saved. ${wrongCountLabel(data.questions ?? [])}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Question save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setManualFallback('');
    setStatus('Reading PDF...');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('title', title || file.name);
      if (activeGoalId) form.append('goalId', activeGoalId);
      const response = await fetch('/api/autopsy/v3/upload', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'PDF upload failed.');
      setAssessment(data.assessment);
      setStatus(data.message || 'PDF extracted.');
      if (data.extraction?.manualEntryRequired) setManualFallback(data.message);
      if (data.extraction?.rawTextPreview) {
        setCsvText((current) => current === DEFAULT_ROWS ? data.extraction.rawTextPreview : current);
      }
    } catch (error) {
      setManualFallback('We could not reliably read this PDF. You can still continue with manual entry.');
      setStatus(error instanceof Error ? error.message : 'PDF upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleAnswerKey() {
    if (!answerKeyText.trim()) return;
    setStatus('Applying answer key...');
    const response = await fetch('/api/autopsy/v3/answer-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assessmentId: assessment?.id, text: answerKeyText }),
    });
    const data = await response.json();
    if (response.ok) {
      setStatus(`Parsed ${data.answers?.length ?? 0} answers.`);
    } else {
      setStatus(data.message || 'Answer key parse failed.');
      // Add format examples from backend if available
      if (data.details?.formatExamples?.length) {
        setAnswerKeyText((prev) => `${prev}\n\n// Format examples:\n// ${data.details.formatExamples.join('\n// ')}`);
      }
    }
  }

  function handleReasonChange(id: string, value: { userReasonCategory?: string; userReason?: string }) {
    setReasons((current) => ({
      ...current,
      [id]: {
        userReasonCategory: value.userReasonCategory ?? current[id]?.userReasonCategory ?? 'unknown',
        userReason: value.userReason ?? current[id]?.userReason ?? '',
      },
    }));
  }

  async function handleSaveReasons() {
    if (!assessment?.id) return;
    setSaving(true);
    setStatus('Saving reasons...');
    try {
      const payload = questions
        .filter((question) => ['incorrect', 'skipped', 'unattempted'].includes(question.status))
        .map((question) => ({
          questionId: question.id,
          userReasonCategory: reasons[question.id]?.userReasonCategory ?? 'unknown',
          userReason: reasons[question.id]?.userReason ?? '',
        }));
      const response = await fetch(`/api/autopsy/v3/assessments/${assessment.id}/reasons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasons: payload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Reasons could not be saved.');
      setStatus(`${data.diagnoses?.length ?? 0} diagnoses ready.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Reason save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateReport() {
    if (!assessment?.id) return;
    const wrongCount = questions.filter((q) => ['incorrect', 'skipped', 'unattempted'].includes(q.status)).length;
    if (wrongCount === 0) {
      if (!window.confirm('No wrong answers detected. Are you sure you want to generate a report?')) return;
    }
    setSaving(true);
    setStatus('Generating report...');
    try {
      const response = await fetch(`/api/autopsy/v3/assessments/${assessment.id}/generate-report`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Report generation failed.');
      setReport(data.report);
      setMemories(data.memoryRows ?? []);
      setStatus('Report ready.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Report generation failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleReflection() {
    setSaving(true);
    setStatus('Saving reflection...');
    try {
      const response = await fetch('/api/autopsy/v3/reflection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId: activeGoalId, reflection }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Reflection could not be saved.');
      setStatus('Reflection saved.');
      setReflection('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Reflection save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: 'var(--sp-6)', maxWidth: 1120, margin: '0 auto', display: 'grid', gap: 'var(--sp-5)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 900, margin: 0 }}>Deep Autopsy</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', maxWidth: 680 }}>
            Diagnose missed marks, store durable mistake memory, and turn the report into today&apos;s recovery loop.
          </p>
        </div>
        <button onClick={() => window.location.reload()} title="Reset" style={iconButtonStyle}>
          <RefreshCw size={18} />
        </button>
      </header>

      <AssessmentCreateStep
        title={title}
        assessmentType={assessmentType}
        onTitleChange={setTitle}
        onTypeChange={setAssessmentType}
      />

      {assessmentType === 'self_reflection' ? (
        <Card padding="lg" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, margin: 0 }}>Self-Reflection</h2>
          <textarea
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            rows={5}
            placeholder="I keep forgetting formulas in..."
            style={textareaStyle}
          />
          <button onClick={handleReflection} disabled={saving || reflection.trim().length < 4} style={primaryButtonStyle}>
            <Sparkles size={16} />
            Save Reflection
          </button>
        </Card>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.9fr) minmax(280px, 1.1fr)', gap: 'var(--sp-4)' }} className="responsive-workspace-grid">
            <UploadAssessmentStep uploading={uploading} message={status} onUpload={handleUpload} />
            <QuestionTableEditor csvText={csvText} onChange={setCsvText} onSave={handleSaveQuestions} saving={saving} />
          </div>

          {manualFallback && <ManualEntryFallback message={manualFallback} />}

          <AnswerKeyInput value={answerKeyText} onChange={setAnswerKeyText} onParse={handleAnswerKey} />

          {questions.length > 0 && (
            <Card padding="lg" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <FileText size={18} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 900, margin: 0 }}>Review</h3>
                {assessment && (
                  <>
                    <Badge color="gray">{assessment.source?.toUpperCase() || 'MANUAL'}</Badge>
                    {assessment.metadata?.originalFilename && (
                      <Badge color="blue">{assessment.metadata.originalFilename}</Badge>
                    )}
                  </>
                )}
              </div>
              <div style={{ display: 'grid', gap: 8 }}>
                {questions.slice(0, 12).map((question) => (
                  <div key={question.id} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 96px', gap: 10, alignItems: 'center', fontSize: 'var(--fs-sm)' }}>
                    <strong>Q{question.question_number}</strong>
                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[question.subject, question.topic].filter(Boolean).join(' / ') || 'General'}
                    </span>
                    <span style={{ color: statusColor(question.status), fontWeight: 800 }}>{question.status}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {questions.length > 0 && (
            <UserReasonStep
              questions={questions}
              reasons={reasons}
              onReasonChange={handleReasonChange}
              onSave={handleSaveReasons}
              saving={saving}
            />
          )}

          {assessment?.id && (
            <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={handleGenerateReport} disabled={saving || questions.length === 0} style={primaryButtonStyle}>
                {saving && status === 'Generating report...' ? (
                  <><Loader2 className="animate-spin" size={16} /> Generating...</>
                ) : (
                  <>Generate Report <ArrowRight size={16} /></>
                )}
              </button>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
                {wrongCount} wrong or skipped
              </span>
            </div>
          )}
        </>
      )}

      {status && <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', margin: 0 }}>{status}</p>}

      {report && <AutopsyReportView report={report} memories={memories} />}
    </main>
  );
}

function parseQuestionRows(input: string) {
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) return [];
  const headers = splitCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i] ?? '']));
    return {
      questionNumber: Number(row.question_number || row.questionnumber || row.q || index + 1),
      subject: row.subject || null,
      topic: row.topic || row.chapter || null,
      subtopic: row.subtopic || null,
      questionText: row.question_text || row.question || null,
      correctAnswer: row.correct_answer || row.correctanswer || row.answer || null,
      userAnswer: row.user_answer || row.useranswer || row.my_answer || row.student_answer || null,
      difficulty: ['easy', 'medium', 'hard'].includes(row.difficulty) ? row.difficulty : null,
      userReviewed: true,
      metadata: { totalMarks: Number(row.total_marks || row.marks || 1) || 1 },
    };
  }).filter((row) => Number.isFinite(row.questionNumber) && row.questionNumber > 0);
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function wrongCountLabel(items: any[]) {
  const wrong = items.filter((item) => ['incorrect', 'skipped', 'unattempted'].includes(item.status)).length;
  return `${wrong} need reasons.`;
}

function statusColor(status: string) {
  if (status === 'correct') return 'var(--success)';
  if (status === 'incorrect') return 'var(--danger)';
  if (status === 'skipped' || status === 'unattempted') return 'var(--warning)';
  return 'var(--text-tertiary)';
}

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  border: 'none',
  borderRadius: 'var(--radius-md)',
  background: 'var(--accent-cyan)',
  color: 'var(--text-inverse)',
  padding: '12px 16px',
  fontWeight: 900,
  cursor: 'pointer',
};

const iconButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
};

const textareaStyle: React.CSSProperties = {
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 12,
  fontSize: 'var(--fs-sm)',
};
