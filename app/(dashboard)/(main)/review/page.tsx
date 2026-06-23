import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Card from '@/components/ui/Card';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [weakAreasRes, dueCardsRes] = await Promise.all([
    supabase
      .from('weak_area_events')
      .select('id, concept_tag, display_path, weakness_description, evidence_text, recommended_action, repair_suggestion, severity, last_seen_at, created_at')
      .eq('user_id', user.id)
      .is('resolved_at', null)
      .order('last_seen_at', { ascending: false }),
    supabase
      .from('revision_cards')
      .select('id, subject, chapter, topic, front, due')
      .eq('user_id', user.id)
      .lte('due', new Date().toISOString())
      .order('due', { ascending: true })
  ]);

  const weakAreas = weakAreasRes.data ?? [];
  const dueCards = dueCardsRes.data ?? [];

  return (
    <main style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', maxWidth: 800, margin: '0 auto', width: '100%', paddingBottom: 'var(--sp-8)' }}>
      <header>
        <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>
          Review
        </p>
        <h1 style={{ margin: 'var(--sp-2) 0', fontSize: 'var(--fs-2xl)', fontWeight: 900 }}>
          Weak areas to fix
        </h1>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--fs-md)' }}>
          These are the concepts you recently struggled with in the Study Room.
        </p>
      </header>

      {weakAreas.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          {weakAreas.map((area: any, index: number) => (
            <Card key={area.id} padding="lg" style={{ borderLeft: '4px solid var(--accent-red)' }}>
              <h2 style={{ margin: '0 0 var(--sp-2)', fontSize: 'var(--fs-lg)', fontWeight: 800 }}>
                {index + 1}. {formatWeakAreaTitle(area)}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', fontSize: 'var(--fs-sm)' }}>
                {area.evidence_text && (
                  <p style={{ margin: 0 }}>
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Evidence:</span> <span style={{ color: 'var(--text-secondary)' }}>{area.evidence_text}</span>
                  </p>
                )}
                <p style={{ margin: 0 }}>
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Next:</span> <span style={{ color: 'var(--text-primary)' }}>{area.repair_suggestion || area.recommended_action || 'Solve 3 targeted questions'}</span>
                </p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card padding="lg" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          You have no active weak areas. Great job!
        </Card>
      )}

      {dueCards.length > 0 && (
        <section style={{ marginTop: 'var(--sp-8)' }}>
          <h2 style={{ margin: '0 0 var(--sp-4)', fontSize: 'var(--fs-xl)', fontWeight: 800 }}>
            Due for review today
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {dueCards.map((card: any) => (
              <li key={card.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-blue)' }} />
                <span style={{ fontWeight: 600 }}>{card.topic || card.chapter || card.subject || 'Review topic'}</span>
                {card.front && <span style={{ color: 'var(--text-secondary)' }}>— {card.front}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function formatWeakAreaTitle(area: any) {
  if (area.weakness_description) return area.weakness_description;
  if (Array.isArray(area.display_path) && area.display_path.length > 0) return area.display_path.join(' — ');
  return area.concept_tag || 'Unknown Concept';
}
