'use client';

import React, { useState, useMemo } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { Target, Info, GitCommit, Compass } from 'lucide-react';

const MASTERY_COLORS: Record<string, string> = {
  not_started: 'var(--text-tertiary)',
  exposed: 'var(--danger)',
  developing: 'var(--warning)',
  proficient: 'var(--info)',
  mastered: 'var(--success)',
  automated: 'var(--accent-cyan)',
};

interface InteractiveGraphProps {
  concepts: any[];
  links: any[];
}

export default function InteractiveGraph({ concepts = [], links = [] }: InteractiveGraphProps) {
  const [selectedNode, setSelectedNode] = useState<any>(null);

  // Position nodes dynamically in an aesthetic SVG viewport (800x450)
  const nodesWithPositions = useMemo(() => {
    return concepts.map((c, i) => {
      const angle = (i / Math.max(1, concepts.length)) * 2 * Math.PI;
      // Distribute in concentric circles based on mastery
      let radius = 160;
      if (c.mastery === 'mastered' || c.mastery === 'automated') radius = 80;
      else if (c.mastery === 'exposed' || c.mastery === 'not_started') radius = 240;

      const x = 400 + radius * Math.cos(angle);
      const y = 225 + radius * Math.sin(angle) * 0.8; // slightly flat ellipse
      return { ...c, x, y };
    });
  }, [concepts]);

  const nodeMap = useMemo(() => {
    const map: Record<string, any> = {};
    nodesWithPositions.forEach(n => {
      map[n.id] = n;
    });
    return map;
  }, [nodesWithPositions]);

  // Construct links with coordinates
  const svgLinks = useMemo(() => {
    return links.map((l, i) => {
      const source = nodeMap[l.source_concept_id];
      const target = nodeMap[l.target_concept_id];
      if (!source || !target) return null;
      return {
        id: l.id || i,
        source,
        target,
        linkType: l.link_type || 'prerequisite',
        strength: l.strength || 0.5,
      };
    }).filter(Boolean);
  }, [links, nodeMap]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {/* SVG Network Canvas */}
      <div style={{
        position: 'relative', width: '100%', height: '450px',
        background: 'var(--bg-primary)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)', overflow: 'hidden',
      }}>
        <svg width="100%" height="100%" viewBox="0 0 800 450" style={{ display: 'block' }}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-strong)" />
            </marker>
          </defs>

          {/* Grid Background pattern */}
          <g opacity="0.15">
            {Array.from({ length: 9 }).map((_, i) => (
              <line key={`x-${i}`} x1={i * 100} y1={0} x2={i * 100} y2={450} stroke="var(--text-ter)" strokeWidth="0.5" />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <line key={`y-${i}`} x1={0} y1={i * 90} x2={800} y2={i * 90} stroke="var(--text-ter)" strokeWidth="0.5" />
            ))}
          </g>

          {/* Connection Links */}
          {svgLinks.map((link: any) => {
            const dx = link.target.x - link.source.x;
            const dy = link.target.y - link.source.y;
            const dr = Math.sqrt(dx * dx + dy * dy);
            // Draw slightly curved paths
            const pathData = `M${link.source.x},${link.source.y} A${dr},${dr} 0 0,1 ${link.target.x},${link.target.y}`;

            return (
              <path
                key={link.id}
                d={pathData}
                fill="none"
                stroke={selectedNode && (selectedNode.id === link.source.id || selectedNode.id === link.target.id) ? 'var(--accent-cyan)' : 'var(--border-default)'}
                strokeWidth={Math.max(1.5, link.strength * 4)}
                strokeDasharray={link.linkType === 'prerequisite' ? '4,4' : undefined}
                markerEnd="url(#arrow)"
                opacity={selectedNode && !(selectedNode.id === link.source.id || selectedNode.id === link.target.id) ? 0.25 : 0.6}
                style={{ transition: 'stroke 0.3s, stroke-width 0.3s, opacity 0.3s' }}
              />
            );
          })}

          {/* Nodes */}
          {nodesWithPositions.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const color = MASTERY_COLORS[node.mastery] || 'var(--text-tertiary)';

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => setSelectedNode(node)}
                style={{ cursor: 'pointer' }}
              >
                {/* Glow behind selected node */}
                {isSelected && (
                  <circle r={24} fill={color} opacity="0.25" className="animate-pulse" />
                )}

                {/* Outer Ring */}
                <circle
                  r={14}
                  fill="var(--bg-secondary)"
                  stroke={color}
                  strokeWidth={isSelected ? 3 : 2}
                  style={{ transition: 'stroke-width 0.2s, stroke 0.2s' }}
                />

                {/* Inner dot */}
                <circle
                  r={6}
                  fill={color}
                />

                {/* Label text */}
                <text
                  y={24}
                  textAnchor="middle"
                  fill={isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'}
                  fontSize="10"
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  style={{ userSelect: 'none', transition: 'fill 0.2s' }}
                >
                  {node.name.length > 20 ? `${node.name.substring(0, 18)}...` : node.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover / Select Quick HUD */}
        {!selectedNode && (
          <div style={{
            position: 'absolute', bottom: 'var(--sp-4)', left: 'var(--sp-4)',
            display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
            background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
            padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--radius-md)',
            fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)',
            backdropFilter: 'blur(4px)'
          }}>
            <Compass size={12} />
            Click any concept node to explore its mastery links and dependencies.
          </div>
        )}
      </div>

      {/* Selected Node HUD detail card */}
      {selectedNode && (
        <Card padding="md" style={{ borderLeft: `3px solid ${MASTERY_COLORS[selectedNode.mastery] || 'var(--border-default)'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--sp-2)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                  {selectedNode.subject} &bull; {selectedNode.chapter}
                </span>
                <Badge color={selectedNode.mastery === 'mastered' || selectedNode.mastery === 'automated' ? 'cyan' : selectedNode.mastery === 'proficient' ? 'blue' : 'gray'}>
                  {selectedNode.mastery.replace('_', ' ')}
                </Badge>
              </div>
              <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', marginTop: 4 }}>
                {selectedNode.name}
              </h3>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
                cursor: 'pointer', fontSize: 'var(--fs-xs)'
              }}
            >
              Clear Focus
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Times Reviewed</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginTop: 2 }}>
                {selectedNode.times_reviewed || 0}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Stability strength</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginTop: 2 }}>
                {(selectedNode.retention_strength || 0).toFixed(2)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Accuracy</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', marginTop: 2 }}>
                {selectedNode.times_reviewed > 0
                  ? `${Math.round(((selectedNode.times_correct || 0) / selectedNode.times_reviewed) * 100)}%`
                  : 'N/A'}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
