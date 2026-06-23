import type { CSSProperties } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { materialStudyStats } from '@/lib/materials/study-room-analysis';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [materialsRes, weakAreasRes, dueCardsRes] = await Promise.all([
    supabase
      .from('study_materials')
      .select('id, title, original_filename, source_type, status, subject, chapter, topic, chunk_count, material_analysis, source_guide, updated_at, created_at, study_material_chunks(count)')
      .eq('user_id', user.id)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(6),
    supabase
      .from('weak_area_events')
      .select('id, concept_tag, display_path, weakness_description, evidence_text, recommended_action, repair_suggestion, severity, last_seen_at, created_at')
      .eq('user_id', user.id)
      .is('resolved_at', null)
      .order('last_seen_at', { ascending: false })
      .limit(3),
    supabase
      .from('revision_cards')
      .select('id, subject, chapter, topic, front, due')
      .eq('user_id', user.id)
      .lte('due', new Date().toISOString())
      .order('due', { ascending: true })
      .limit(4),
  ]);

  const materials = materialsRes.data ?? [];
  const readyMaterials = materials.filter((material: any) => material.status === 'ready');
  const latestMaterial = materials[0] ?? null;
  const weakAreas = weakAreasRes.data ?? [];
  const dueCards = dueCardsRes.data ?? [];

  return (
    <main style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)', maxWidth: 1120, margin: '0 auto', width: '100%' }}>
      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(260px, 0.6fr)', gap: 'var(--sp-5)' }}>
        <div>
          <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>
            Home
          </p>
          <h1 style={{ margin: 'var(--sp-2) 0', fontSize: 'var(--fs-3xl)', fontWeight: 900, letterSpacing: 0 }}>
            What should you continue learning?
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--fs-md)', lineHeight: 1.6, maxWidth: 720 }}>
            Upload your notes, PDFs, slides, or question banks, then study with an AI tutor that uses your exact material.
          </p>
        </div>
        <Card padding="md" style={{ alignSelf: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <Link href="/materials" style={primaryActionStyle}>Upload Material</Link>
            <Link href="/study-room" style={secondaryActionStyle}>Open Study Room</Link>
            <Link href="/review" style={plainActionStyle}>Review Weak Areas</Link>
          </div>
        </Card>
      </section>

      <section style={gridStyle}>
        <Card padding="lg">
          <h2 style={sectionTitleStyle}>Continue studying</h2>
          {latestMaterial ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-lg)' }}>{latestMaterial.original_filename || latestMaterial.title}</h3>
                <p style={{ margin: 'var(--sp-1) 0 0', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
                  Last updated {formatDate(latestMaterial.updated_at ?? latestMaterial.created_at)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
                <Badge color={latestMaterial.status === 'ready' ? 'cyan' : latestMaterial.status === 'failed' ? 'red' : 'yellow'}>{latestMaterial.status}</Badge>
                <Badge color="gray">{materialStudyStats(latestMaterial).sourceType.replaceAll('_', ' ')}</Badge>
              </div>
              <Link href={`/study-room?materialId=${latestMaterial.id}`} style={primaryActionStyle}>Open Study Room</Link>
            </div>
          ) : (
            <EmptyState title="No material yet" body="Upload a PDF, notes file, slide deck, or question bank to start." actionHref="/materials" action="Upload Material" />
          )}
        </Card>

        <Card padding="lg">
          <h2 style={sectionTitleStyle}>Materials ready</h2>
          {readyMaterials.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {readyMaterials.slice(0, 3).map((material: any) => {
                const stats = materialStudyStats(material);
                return (
                  <div key={material.id} style={listItemStyle}>
                    <strong>{material.original_filename || material.title}</strong>
                    <span style={mutedStyle}>
                      {stats.counts.topics} topics · {stats.counts.questions} questions · {stats.counts.formulas} formulas
                    </span>
                  </div>
                );
              })}
              <Link href="/materials" style={plainActionStyle}>Manage Materials</Link>
            </div>
          ) : (
            <EmptyState title="Nothing ready yet" body="Queued uploads will appear here after text and chunks are extracted." actionHref="/materials" action="View Materials" />
          )}
        </Card>

        <Card padding="lg">
          <h2 style={sectionTitleStyle}>Weak areas to review</h2>
          {weakAreas.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {weakAreas.map((area: any) => (
                <div key={area.id} style={listItemStyle}>
                  <strong>{formatWeakAreaTitle(area)}</strong>
                  <span style={mutedStyle}>{area.repair_suggestion || area.recommended_action || 'Do one targeted repair question.'}</span>
                </div>
              ))}
              <Link href="/review" style={plainActionStyle}>Open Review</Link>
            </div>
          ) : (
            <EmptyState title="No weak areas yet" body="They will appear when the Study Room catches a misconception or wrong answer." actionHref="/study-room" action="Start Studying" />
          )}
        </Card>

        <Card padding="lg">
          <h2 style={sectionTitleStyle}>Due for review</h2>
          {dueCards.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {dueCards.map((card: any) => (
                <div key={card.id} style={listItemStyle}>
                  <strong>{card.topic || card.chapter || card.subject || 'Review card'}</strong>
                  <span style={mutedStyle}>{card.front || 'Recall this from your material.'}</span>
                </div>
              ))}
              <Link href="/review" style={plainActionStyle}>Review Today</Link>
            </div>
          ) : (
            <p style={{ ...mutedStyle, margin: 0 }}>No review cards due right now.</p>
          )}
        </Card>
      </section>
    </main>
  );
}

function EmptyState({ title, body, actionHref, action }: { title: string; body: string; actionHref: string; action: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
      <strong>{title}</strong>
      <p style={{ ...mutedStyle, margin: 0 }}>{body}</p>
      <Link href={actionHref} style={plainActionStyle}>{action}</Link>
    </div>
  );
}

function formatWeakAreaTitle(area: any) {
  if (area.weakness_description) return area.weakness_description;
  if (Array.isArray(area.display_path) && area.display_path.length > 0) return area.display_path.join(' - ');
  return area.concept_tag || 'Weak area';
}

function formatDate(value?: string | null) {
  if (!value) return 'recently';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(value));
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 'var(--sp-5)',
};

const sectionTitleStyle: CSSProperties = {
  margin: '0 0 var(--sp-4)',
  fontSize: 'var(--fs-lg)',
  fontWeight: 800,
};

const listItemStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 'var(--sp-3)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-subtle)',
};

const mutedStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 'var(--fs-sm)',
  lineHeight: 1.5,
};

const primaryActionStyle: CSSProperties = {
  display: 'inline-flex',
  justifyContent: 'center',
  padding: '0.7rem 1rem',
  borderRadius: 'var(--radius-md)',
  background: 'var(--accent-blue)',
  color: 'white',
  fontWeight: 800,
  textDecoration: 'none',
};

const secondaryActionStyle: CSSProperties = {
  ...primaryActionStyle,
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)',
};

const plainActionStyle: CSSProperties = {
  color: 'var(--accent-blue)',
  fontWeight: 800,
  textDecoration: 'none',
  fontSize: 'var(--fs-sm)',
};
