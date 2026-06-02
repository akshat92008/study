'use client';

import { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Upload, Loader2, Activity } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import AutopsyDashboard from '@/components/autopsy/AutopsyDashboard';

export default function TestAnalysisCard({ onUploadSuccess }: { onUploadSuccess?: () => void }) {
  const {
    autopsyResult,
    setAutopsyResult,
    isUploadingMock,
    setIsUploadingMock,
    uploadStatus,
    setUploadStatus,
    addToast,
  } = useAppStore();

  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleMockUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload) return addToast('Please select a mock paper', 'error');

    setIsUploadingMock(true);
    setUploadStatus('Uploading...');

    const statuses = [
      'Upload received. Waiting for the worker queue...',
      'Queued for processing...',
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < statuses.length) setUploadStatus(statuses[i++]);
    }, 2500);

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('testName', fileToUpload.name);

      const res = await fetch('/api/autopsy/ingest', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test Analysis failed');

      if (data.status === 'completed') {
        setAutopsyResult(data);
        addToast('Mock Analysis completed successfully!', 'success');
        if (onUploadSuccess) onUploadSuccess();
      } else {
        // Start polling if pending/processing
        let currentStatus = data.status;
        let elapsed = 0;
        const maxWait = 900000; // 15 min max

        while (currentStatus !== 'completed' && currentStatus !== 'failed' && currentStatus !== 'needs_user_input' && currentStatus !== 'needs_input' && elapsed < maxWait) {
          await new Promise(r => setTimeout(r, 2000));
          elapsed += 2000;
          
          const pollRes = await fetch(`/api/autopsy/jobs/${data.jobId}`);
          if (!pollRes.ok) continue;
          
          const pollData = await pollRes.json();
          currentStatus = pollData.status;

          if (currentStatus === 'processing') {
             setUploadStatus('Processing upload...');
          } else if (currentStatus === 'needs_user_input' || currentStatus === 'needs_input') {
             throw new Error(pollData.error || 'Autopsy needs user input.');
          } else if (currentStatus === 'failed') {
             throw new Error(pollData.error || 'Autopsy analysis failed.');
          } else if (currentStatus === 'completed') {
             const resultRes = await fetch('/api/autopsy');
             if (resultRes.ok) {
               const resultData = await resultRes.json();
               setAutopsyResult(resultData.result);
             } else {
               setAutopsyResult(pollData);
             }
             addToast('Mock Analysis completed successfully!', 'success');
             if (onUploadSuccess) onUploadSuccess();
             break;
          }
        }
        if (elapsed >= maxWait) throw new Error('Analysis timed out');
      }
    } catch (err: any) {
      addToast(err.message, 'error');
    } finally {
      clearInterval(interval);
      setIsUploadingMock(false);
      setUploadStatus('');
    }
  };

  return (
    <Card padding="lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        <Activity size={18} style={{ color: 'var(--danger)' }} />
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'bold' }}>Test Analysis</h3>
      </div>
      
      {!autopsyResult && !isUploadingMock && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) setFileToUpload(file);
          }}
          style={{
            borderStyle: 'dashed', borderWidth: '2px', borderRadius: 'var(--radius-md)',
            borderColor: dragging ? 'var(--accent-cyan)' : 'var(--border-strong)',
            background: dragging ? 'var(--bg-secondary)' : 'var(--bg-primary)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minHeight: '220px', transition: 'all 0.25s', padding: 'var(--sp-4)'
          }}
        >
          <div style={{ background: 'var(--accent-cyan-dim)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-full)', marginBottom: 'var(--sp-3)' }}>
            <Upload color="var(--accent-cyan)" size={24} />
          </div>
          <h4 style={{ fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-semibold)', marginBottom: '4px' }}>
            {dragging ? 'Drop to upload' : 'Drag & Drop Mock Paper'}
          </h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginBottom: 'var(--sp-4)', textAlign: 'center' }}>
            Support PDF, TXT, MD, or Image up to 10MB
          </p>

          <form onSubmit={handleMockUpload} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)', width: '100%', maxWidth: '16rem' }}>
            <input
              type="file"
              accept=".pdf,.txt,.md,image/*"
              onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
              style={{
                width: '100%', padding: '4px var(--sp-2)',
                border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 'var(--fs-xs)'
              }}
            />
            {fileToUpload && (
              <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', textAlign: 'center', background: 'var(--accent-cyan-dim)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', width: '100%' }}>
                Staged: <strong>{fileToUpload.name}</strong>
              </div>
            )}
            <Button type="submit" disabled={!fileToUpload} size="sm" style={{ width: '100%', background: 'var(--accent-cyan)', color: 'var(--text-inverse)' }}>
              Analyze Mock Test
            </Button>
          </form>
        </div>
      )}

      {isUploadingMock && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '220px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)' }}>
          <Loader2 color="var(--accent-cyan)" size={32} className="animate-spin" style={{ marginBottom: 'var(--sp-4)' }} />
          <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)' }}>Extracting Mock Data...</h4>
          <p style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-xs)', marginTop: 8, textAlign: 'center', padding: '0 var(--sp-4)' }}>{uploadStatus}</p>
        </div>
      )}

      {autopsyResult && !isUploadingMock && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)', padding: 'var(--sp-4)' }}>
          <ErrorBoundary fallback={<div className="text-sm text-muted-foreground p-4">Test analyzer unavailable</div>}>
            <AutopsyDashboard result={autopsyResult} />
          </ErrorBoundary>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--sp-4)' }}>
            <Button variant="secondary" size="sm" onClick={() => { setAutopsyResult(null); setFileToUpload(null); }}>
              Analyze Another Mock Test
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
