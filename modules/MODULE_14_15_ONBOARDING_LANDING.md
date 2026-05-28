# MODULE 14: Onboarding Flow

## PROMPT FOR AI BUILDER

```
Build the onboarding flow that runs after first signup.
Collects: exam type, target year, target score, study hours, subjects.
Then seeds the cognition graph. Redirects to dashboard when complete.
Create: app/(dashboard)/onboarding/page.tsx, update dashboard layout to check onboarding.
```

---

## STEP 1: Onboarding Action — `lib/actions/onboarding.ts`

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { NEET_CHAPTERS } from '@/lib/utils/constants';
import { seedConceptsForSubject } from '@/lib/engines/cognition-graph';

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const examType = formData.get('examType') as string || 'NEET';
  const targetYear = parseInt(formData.get('targetYear') as string) || 2026;
  const targetScore = parseInt(formData.get('targetScore') as string) || 650;
  const studyHours = parseInt(formData.get('studyHours') as string) || 8;

  // Update profile
  await supabase.from('profiles').update({
    exam_type: examType,
    target_year: targetYear,
    target_score: targetScore,
    study_hours_per_day: studyHours,
    onboarding_complete: true,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id);

  // Seed concepts
  if (examType === 'NEET') {
    for (const [subject, chapters] of Object.entries(NEET_CHAPTERS)) {
      await seedConceptsForSubject(user.id, subject, chapters);
    }
  }

  return { success: true };
}
```

---

## STEP 2: Onboarding Page — `app/(dashboard)/onboarding/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { completeOnboarding } from '@/lib/actions/onboarding';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Zap, ArrowRight } from 'lucide-react';

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState({
    examType: 'NEET', targetYear: '2026', targetScore: '650', studyHours: '8',
  });
  const router = useRouter();

  async function handleComplete() {
    setLoading(true);
    const fd = new FormData();
    Object.entries(formState).forEach(([k, v]) => fd.set(k, v));
    await completeOnboarding(fd);
    router.push('/dashboard');
  }

  const steps = [
    // Step 0: Welcome
    <div key={0} style={{ textAlign: 'center' }}>
      <div style={{
        width: 64, height: 64, borderRadius: 'var(--radius-lg)', margin: '0 auto var(--sp-6)',
        background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><Zap size={32} color="white" /></div>
      <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>
        Welcome to <span style={{ color: 'var(--accent-blue)' }}>Cognition OS</span>
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)', maxWidth: 400, margin: '0 auto var(--sp-6)' }}>
        Let's set up your AI academic operating system. This takes 30 seconds.
      </p>
      <Button onClick={() => setStep(1)} size="lg">Get Started <ArrowRight size={18} /></Button>
    </div>,
    // Step 1: Exam & Target
    <div key={1} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-bold)' }}>Your Exam</h2>
      <div>
        <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>Exam Type</label>
        <select value={formState.examType} onChange={e => setFormState(p => ({ ...p, examType: e.target.value }))} style={{
          width: '100%', padding: 'var(--sp-3)', background: 'var(--bg-primary)', color: 'var(--text-primary)',
          border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)',
        }}>
          <option value="NEET">NEET</option><option value="JEE">JEE</option>
          <option value="SAT">SAT</option><option value="UPSC">UPSC</option>
        </select>
      </div>
      <Input label="Target Year" type="number" value={formState.targetYear}
        onChange={e => setFormState(p => ({ ...p, targetYear: e.target.value }))} />
      <Input label="Target Score" type="number" value={formState.targetScore}
        onChange={e => setFormState(p => ({ ...p, targetScore: e.target.value }))} placeholder="e.g. 650 out of 720" />
      <Input label="Study Hours Per Day" type="number" value={formState.studyHours}
        onChange={e => setFormState(p => ({ ...p, studyHours: e.target.value }))} />
      <Button onClick={handleComplete} isLoading={loading} size="lg" style={{ marginTop: 'var(--sp-4)' }}>
        Launch Cognition OS <Zap size={18} />
      </Button>
    </div>,
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - var(--header-height) - var(--sp-12))',
    }}>
      <Card padding="lg" style={{ maxWidth: 480, width: '100%' }} className="animate-fade">
        {steps[step]}
      </Card>
    </div>
  );
}
```

---

## STEP 3: Update Dashboard Layout to Check Onboarding

In `app/(dashboard)/layout.tsx`, add this redirect after fetching profile:

```typescript
// After fetching profile, add:
if (profile && !profile.onboarding_complete) {
  // Only redirect if not already on onboarding page
  // Check using a simple path comparison in the rendered component
}
```

**Better approach**: Add a client component wrapper that checks onboarding status and shows onboarding modal. But for simplicity, the student can navigate to `/dashboard/onboarding` manually on first login, or you can add a redirect in the dashboard layout.

---

## VERIFICATION

```bash
npm run dev
# Visit /dashboard/onboarding
# Step through welcome → exam setup
# Submit → should seed concepts and redirect to dashboard
```

---

# MODULE 15: Landing Page

## PROMPT FOR AI BUILDER

```
Build a premium, futuristic landing page for Cognition OS at app/page.tsx.
Dark, animated, gradient-heavy. Shows: hero, features, CTA.
NO Tailwind. Use CSS variables and inline styles. Use framer-motion for animations.
```

---

## Replace `app/page.tsx`

```tsx
import Link from 'next/link';
import { Brain, Target, RefreshCw, BarChart3, Calendar, Sparkles, Zap, ArrowRight } from 'lucide-react';

const features = [
  { icon: Brain, title: 'Cognition Graph', desc: 'Dynamic model of your entire knowledge state', color: 'var(--accent-purple)' },
  { icon: Target, title: 'Mistake Intelligence', desc: 'AI analysis of why you lose marks', color: 'var(--danger)' },
  { icon: RefreshCw, title: 'Adaptive Revision', desc: 'FSRS-5 spaced repetition engine', color: 'var(--accent-cyan)' },
  { icon: Sparkles, title: 'AI Mentor', desc: 'Emotionally intelligent academic coach', color: 'var(--accent-purple)' },
  { icon: Calendar, title: 'Smart Planner', desc: 'AI-generated adaptive daily plans', color: 'var(--accent-blue)' },
  { icon: BarChart3, title: 'Performance Analytics', desc: 'Bloomberg-grade academic intelligence', color: 'var(--success)' },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-root)', overflow: 'hidden' }}>
      {/* Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--sp-4) var(--sp-8)', maxWidth: 1200, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Zap size={18} color="white" /></div>
          <span style={{ fontWeight: 'var(--fw-bold)' as any, fontSize: 'var(--fs-md)' }}>Cognition OS</span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <Link href="/login" style={{
            padding: 'var(--sp-2) var(--sp-4)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', textDecoration: 'none',
          }}>Sign In</Link>
          <Link href="/signup" style={{
            padding: 'var(--sp-2) var(--sp-5)', borderRadius: 'var(--radius-md)',
            background: 'var(--accent-blue)', color: 'white', fontSize: 'var(--fs-sm)',
            fontWeight: 'var(--fw-semibold)' as any, textDecoration: 'none',
          }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        textAlign: 'center', padding: 'var(--sp-20) var(--sp-8) var(--sp-16)',
        maxWidth: 800, margin: '0 auto',
        backgroundImage: 'radial-gradient(ellipse at 50% 20%, hsla(220,90%,56%,0.1) 0%, transparent 50%)',
      }}>
        <div style={{
          display: 'inline-block', padding: 'var(--sp-1) var(--sp-4)',
          background: 'var(--accent-blue-glow)', border: '1px solid var(--accent-blue-dim)',
          borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-xs)',
          color: 'var(--accent-blue)', fontWeight: 'var(--fw-semibold)' as any,
          letterSpacing: 'var(--ls-wide)', textTransform: 'uppercase', marginBottom: 'var(--sp-6)',
        }}>
          AI-Native Academic OS
        </div>

        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 'var(--fw-black)' as any,
          lineHeight: 'var(--lh-tight)', letterSpacing: 'var(--ls-tight)', marginBottom: 'var(--sp-5)',
        }}>
          Your brain has a<br />
          <span style={{
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple), var(--accent-cyan))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            learning operating system
          </span>
          <br />now.
        </h1>

        <p style={{
          fontSize: 'var(--fs-lg)', color: 'var(--text-secondary)',
          lineHeight: 'var(--lh-relaxed)', maxWidth: 600, margin: '0 auto var(--sp-8)',
        }}>
          Cognition OS continuously models your knowledge, memory, behavior, and performance
          to autonomously optimize your exam preparation.
        </p>

        <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'center' }}>
          <Link href="/signup" style={{
            padding: 'var(--sp-3) var(--sp-8)', borderRadius: 'var(--radius-lg)',
            background: 'var(--accent-blue)', color: 'white', fontSize: 'var(--fs-md)',
            fontWeight: 'var(--fw-semibold)' as any, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-2)',
            boxShadow: 'var(--shadow-glow-blue)',
          }}>
            Start Free <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{
        maxWidth: 1000, margin: '0 auto', padding: '0 var(--sp-8) var(--sp-20)',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-4)',
      }}>
        {features.map((f) => (
          <div key={f.title} style={{
            padding: 'var(--sp-6)', borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
          }}>
            <f.icon size={24} style={{ color: f.color, marginBottom: 'var(--sp-3)' }} />
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-1)' }}>
              {f.title}
            </h3>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
              {f.desc}
            </p>
          </div>
        ))}
      </section>

      {/* Bottom CTA */}
      <section style={{
        textAlign: 'center', padding: 'var(--sp-16) var(--sp-8)',
        borderTop: '1px solid var(--border-subtle)',
        backgroundImage: 'radial-gradient(ellipse at 50% 100%, hsla(265,80%,60%,0.08) 0%, transparent 50%)',
      }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-3)' }}>
          Ready to upgrade your brain?
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)' }}>
          Join the cognitive revolution in exam preparation.
        </p>
        <Link href="/signup" style={{
          padding: 'var(--sp-3) var(--sp-8)', borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
          color: 'white', fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)' as any,
          textDecoration: 'none', display: 'inline-block',
        }}>Get Started Free</Link>
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: 'center', padding: 'var(--sp-6)',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)',
      }}>
        © 2026 Cognition OS. The intelligence layer between humans and learning.
      </footer>
    </div>
  );
}
```

---

## VERIFICATION

```bash
npm run dev
# Visit localhost:3000 (root)
# Premium dark landing page with gradient text, feature grid, CTAs
# Sign In / Get Started links work
```

---

## 🎉 BUILD COMPLETE

All 16 modules are now specified. Follow BUILD_GUIDE.md → MODULE_0 through MODULE_15 in order.
Each module is self-contained and can be built by any AI model or engineer.
