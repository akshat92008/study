'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateDynamicCurriculum } from '@/lib/actions/curriculum';
import { Brain, ArrowRight, Loader2 } from 'lucide-react';

export default function DynamicCurriculumGenerator() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [academicLevel, setAcademicLevel] = useState('University');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic) return;

    setLoading(true);
    setError(null);

    try {
      const res = await generateDynamicCurriculum(topic, academicLevel);
      if (res.error) {
        setError(res.error);
      } else {
        router.push('/');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 64, height: 64, borderRadius: 'var(--radius-full)',
        background: 'rgba(168, 85, 247, 0.1)', color: 'var(--accent-purple)',
        marginBottom: 'var(--sp-6)'
      }}>
        <Brain size={32} />
      </div>
      <h2 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, marginBottom: 'var(--sp-2)' }}>
        Design Your Curriculum
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-8)' }}>
        Tell us what you want to master. Our AI will instantly build a comprehensive syllabus tailored for you.
      </p>

      <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', textAlign: 'left' }}>
        <div>
          <label style={{ display: 'block', marginBottom: 'var(--sp-2)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            What do you want to learn?
          </label>
          <input
            type="text"
            placeholder="e.g. Quantum Physics, CFA Level 1, React Native"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{
              width: '100%', padding: 'var(--sp-3)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              outline: 'none', transition: 'border-color 0.2s'
            }}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: 'var(--sp-2)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Academic Level
          </label>
          <select
            value={academicLevel}
            onChange={(e) => setAcademicLevel(e.target.value)}
            style={{
              width: '100%', padding: 'var(--sp-3)',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
              outline: 'none', transition: 'border-color 0.2s',
              appearance: 'none'
            }}
          >
            <option value="High School">High School</option>
            <option value="University">Undergraduate / University</option>
            <option value="Graduate">Masters / Ph.D. / Graduate</option>
            <option value="Professional">Professional Certification</option>
            <option value="Hobbyist">Hobbyist / Self-Taught</option>
          </select>
        </div>

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)', marginTop: 'var(--sp-2)' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !topic}
          style={{
            marginTop: 'var(--sp-4)', width: '100%', padding: 'var(--sp-3)',
            background: 'var(--accent-purple)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-md)',
            fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 'var(--sp-2)', cursor: loading ? 'wait' : 'pointer',
            opacity: (loading || !topic) ? 0.7 : 1, transition: 'opacity 0.2s'
          }}
        >
          {loading ? (
            <>
              <Loader2 size={20} className="spin" />
              Generating Curriculum...
            </>
          ) : (
            <>
              Build My Learning Engine
              <ArrowRight size={20} />
            </>
          )}
        </button>
      </form>
      <style dangerouslySetInnerHTML={{__html: `
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}
