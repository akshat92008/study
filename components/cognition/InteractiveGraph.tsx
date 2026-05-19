'use client';

import React, { useState, useMemo } from 'react';
import Card from '@/components/ui/Card';

const MASTERY_COLORS: Record<string, string> = {
  not_started: 'var(--text-tertiary)', exposed: 'var(--danger)',
  developing: 'var(--warning)', proficient: 'var(--info)',
  mastered: 'var(--success)', automated: 'var(--accent-cyan)',
};

export default function InteractiveGraph({ concepts = [], links = [] }: { concepts: any[], links: any[] }) {
  const [selectedNode, setSelectedNode] = useState<any>(null);

  // Position nodes dynamically in a circular pattern
  const nodesWithPositions = useMemo(() => {
    return concepts.map((c, i) => {
      const angle = (i / Math.max(1, concepts.length)) * 2 * Math.PI;
      let radius = c.mastery === 'mastered' || c.mastery === 'automated' ? 80 : 
                   c.mastery === 'exposed' || c.mastery === 'not_started' ? 240 : 160;
      return { ...c, x: 400 + radius * Math.cos(angle), y: 225 + radius * Math.sin(angle) * 0.8 };
    });
  }, [concepts]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      {/* SVG Network Canvas */}
      <div style={{ position: 'relative', width: '100%', height: '450px', background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        <svg width="100%" height="100%" viewBox="0 0 800 450">
          {/* Nodes */}
          {nodesWithPositions.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const color = MASTERY_COLORS[node.mastery] || 'var(--text-tertiary)';
            return (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`} onClick={() => setSelectedNode(node)} style={{ cursor: 'pointer' }}>
                {isSelected && <circle r={24} fill={color} opacity="0.2" className="animate-pulse" />}
                <circle r={10} fill="var(--bg-secondary)" stroke={color} strokeWidth={isSelected ? 3 : 2} />
                <circle r={4} fill={color} />
                <text y={20} textAnchor="middle" fill={isSelected ? 'white' : 'var(--text-secondary)'} fontSize="10">{node.name.substring(0, 15)}</text>
              </g>
            );
          })}
        </svg>
        {!selectedNode && <div style={{ position: 'absolute', bottom: 16, left: 16, color: 'var(--text-tertiary)', fontSize: '12px' }}>Click a node to inspect</div>}
      </div>

      {/* Selected Node HUD */}
      {selectedNode && (
        <Card padding="md" style={{ borderLeft: `3px solid ${MASTERY_COLORS[selectedNode.mastery]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{selectedNode.subject} • {selectedNode.chapter}</div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>{selectedNode.name}</h3>
            </div>
            <button onClick={() => setSelectedNode(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>Close</button>
          </div>
        </Card>
      )}
    </div>
  );
}
