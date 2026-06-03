'use client';

import AutopsyDashboard from './AutopsyDashboard';
import { Upload, FileText } from 'lucide-react';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';

interface Props {
  result: any;
}

export default function AutopsyPageClient({ result: initialResult }: Props) {
  const { activeGoalId, chatId, learningGoals } = useAppStore();
  const [result, setResult] = useState(initialResult);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  
  // Manual entry state
  const [question, setQuestion] = useState('');
  const [myAnswer, setMyAnswer] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const activeGoal = learningGoals.find(goal => goal.id === activeGoalId);

  const latestResultUrl = useCallback(() => {
    const query = activeGoalId ? `?goalId=${encodeURIComponent(activeGoalId)}` : '';
    return `/api/autopsy${query}`;
  }, [activeGoalId]);

  const loadLatestResult = useCallback(async () => {
    const response = await fetch(latestResultUrl());
    if (!response.ok) return;
    const data = await response.json();
    setResult(data.result ?? null);
  }, [latestResultUrl]);

  useEffect(() => {
    loadLatestResult().catch(() => {});
  }, [loadLatestResult]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setStatus('Uploading and preparing file...');

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('testName', file.name);
      form.append('async', 'true');
      if (activeGoalId) form.append('goalId', activeGoalId);
      if (chatId) form.append('chatSessionId', chatId);
      
      const res = await fetch('/api/autopsy/ingest', { method: 'POST', body: form });
      const data = await res.json();
      
      if (!res.ok && res.status !== 202) {
        setStatus('Upload failed. Please try again with a clearer file.');
        setUploading(false);
        return;
      }
      
      // If synchronous fallback (unlikely with async=true but safe to check)
      if (data.autopsyId && !data.jobId) {
        setResult(data);
        setUploading(false);
        return;
      }
      
      if (!data.jobId) {
        setStatus('Upload failed — missing job ID');
        setUploading(false);
        return;
      }

      setStatus('Queued for processing...');
      
      // Poll for job completion
      const pollJob = async () => {
        try {
          const pollRes = await fetch(`/api/autopsy/jobs/${data.jobId}`);
          const jobData = await pollRes.json();
          
          if (jobData.status === 'completed') {
            const finalRes = await fetch(latestResultUrl());
            const finalData = await finalRes.json();
            setResult(finalData.result);
            setUploading(false);
            return;
          } else if (jobData.status === 'failed') {
            setStatus('Mistake Review failed. Please try again with a clearer file.');
            setUploading(false);
            return;
          } else if (jobData.status === 'processing') {
            setStatus('Processing upload...');
          } else if (jobData.status === 'needs_input') {
            setStatus('Needs input');
            setUploading(false);
            return;
          } else {
            setStatus('Queued for processing...');
          }
          
          setTimeout(pollJob, 2000);
        } catch {
            setStatus('Mistake Review polling failed. Please refresh the page.');
          setUploading(false);
        }
      };
      
      setTimeout(pollJob, 2000);
      
    } catch {
      setStatus('Upload failed. Try again.');
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question || !myAnswer || !correctAnswer) return;
    setManualLoading(true);
    setStatus('Logging mistake and diagnosing...');
    try {
      const res = await fetch('/api/autopsy/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: activeGoalId,
          chatSessionId: chatId,
          question,
          myAnswer,
          correctAnswer,
          explanation
        })
      });
      if (!res.ok) throw new Error('Failed');
      
      const data = await res.json();
      
      setQuestion('');
      setMyAnswer('');
      setCorrectAnswer('');
      setExplanation('');
      
      if (data.cardsCreated) {
        setStatus(`Logged! Generated ${data.cardsCreated} cards. Next: ${data.nextAction || 'Continue your mission.'}`);
      } else {
        setStatus('Logged and diagnosed successfully.');
      }
      
      // Reload result to show any updates if necessary, or just show a toast.
      await loadLatestResult();
    } catch {
      setStatus('Failed to log mistake. Try again.');
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div style={{ padding: 'var(--sp-6)', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', marginBottom: 4 }}>
          Mistake Review
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
          {activeGoal
            ? `Upload a mock test or mistake sheet for ${activeGoal.title}.`
            : 'Upload a mock test or mistake sheet to find patterns and improve your weak areas, review queue, and next mission when verified.'}
        </p>
      </div>

      <form onSubmit={handleManualSubmit} style={{
        background: 'var(--bg-secondary)',
        padding: 'var(--sp-6)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 'var(--sp-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-4)'
      }}>
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', marginBottom: 0 }}>Paste a missed question</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 'var(--fw-bold)' }}>Question *</label>
          <textarea required value={question} onChange={e => setQuestion(e.target.value)} rows={2} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 8, color: 'var(--text-primary)' }} />
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 'var(--fw-bold)' }}>Your Answer *</label>
            <input required value={myAnswer} onChange={e => setMyAnswer(e.target.value)} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 8, color: 'var(--text-primary)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 'var(--fw-bold)' }}>Correct Answer *</label>
            <input required value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 8, color: 'var(--text-primary)' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 'var(--fw-bold)' }}>Explanation (Optional)</label>
          <textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: 8, color: 'var(--text-primary)' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--success)', fontWeight: 'var(--fw-medium)' }}>
            {status && !uploading && status}
          </div>
          <button type="submit" disabled={manualLoading} style={{
            background: 'var(--accent-purple)',
            color: 'white',
            border: 'none',
            padding: 'var(--sp-2) var(--sp-6)',
            borderRadius: 'var(--radius-md)',
            cursor: manualLoading ? 'not-allowed' : 'pointer',
            fontWeight: 'var(--fw-bold)'
          }}>
            {manualLoading ? 'Diagnosing...' : 'Diagnose Mistake'}
          </button>
        </div>
      </form>

      {/* Upload zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          border: '2px dashed var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--sp-8)',
          textAlign: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          marginBottom: 'var(--sp-6)',
          background: 'var(--bg-secondary)',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-purple)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.txt"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
        />
        {uploading ? (
          <>
            <div style={{ width: 32, height: 32, border: '3px solid var(--accent-purple)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>{status}</p>
          </>
        ) : (
          <>
            <Upload size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 12 }} />
            <p style={{ fontWeight: 'bold', marginBottom: 4 }}>Or upload a full mock test here</p>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>PDF · JPG · PNG · TXT</p>
          </>
        )}
      </div>

      {/* Results */}
      {result ? (
        <AutopsyDashboard result={result} />
      ) : (
        <div style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-tertiary)' }}>
          <FileText size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p>No mistake review results yet. Upload a mock test above.</p>
        </div>
      )}
    </div>
  );
}
