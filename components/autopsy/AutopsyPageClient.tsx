'use client';

import AutopsyDashboard from './AutopsyDashboard';
import { Upload, FileText } from 'lucide-react';
import { useState, useRef } from 'react';

interface Props {
  result: any;
}

export default function AutopsyPageClient({ result: initialResult }: Props) {
  const [result, setResult] = useState(initialResult);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const statuses = [
      'Running OCR on your test...',
      'Mapping mistakes to syllabus chapters...',
      'Diagnosing root causes...',
      'Building your recovery sprint...',
    ];
    let i = 0;
    setStatus(statuses[0]);
    const interval = setInterval(() => {
      i = Math.min(i + 1, statuses.length - 1);
      setStatus(statuses[i]);
    }, 3500);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('testName', file.name);
      const res = await fetch('/api/autopsy/ingest', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) setResult(data);
      else setStatus('Upload failed — ' + (data.error || 'unknown error'));
    } catch {
      setStatus('Upload failed. Try again.');
    } finally {
      clearInterval(interval);
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  return (
    <div style={{ padding: 'var(--sp-6)', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-black)', marginBottom: 4 }}>
          AUTOPSY
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
          Upload any mock test — PDF, photo, scanned paper. Full cognitive diagnosis in 30 seconds.
        </p>
      </div>

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
            <p style={{ fontWeight: 'bold', marginBottom: 4 }}>Drop your mock test here</p>
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
          <p>No autopsy results yet. Upload a mock test above.</p>
        </div>
      )}
    </div>
  );
}
