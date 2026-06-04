'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

export default function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        marginTop: 'var(--sp-2)',
        padding: '14px 16px',
        borderRadius: 8,
        border: 'none',
        background: 'var(--accent-blue)',
        color: 'white',
        fontWeight: 700,
        cursor: pending ? 'not-allowed' : 'pointer',
        fontSize: 'var(--fs-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? <Loader2 className="animate-spin" size={20} /> : null}
      {pending ? 'Building...' : 'Build My Learning OS →'}
    </button>
  );
}
