'use client';

import { FileUp, Loader2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

export default function UploadAssessmentStep({
  uploading,
  message,
  onUpload,
}: {
  uploading: boolean;
  message: string;
  onUpload: (file: File) => void;
}) {
  return (
    <Card padding="lg" style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        <Badge color="purple">Step 2</Badge>
        <FileUp size={18} color="var(--accent-blue)" />
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 800, margin: 0 }}>PDF Upload</h3>
      </div>
      <label style={{
        border: '1px dashed var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--sp-5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 96,
        cursor: uploading ? 'not-allowed' : 'pointer',
        color: 'var(--text-secondary)',
      }}>
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.currentTarget.value = '';
          }}
          style={{ display: 'none' }}
        />
        {uploading ? <Loader2 className="animate-spin" size={20} /> : 'Select PDF'}
      </label>
      {message && <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', margin: 0 }}>{message}</p>}
    </Card>
  );
}
