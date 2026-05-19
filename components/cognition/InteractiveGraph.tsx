'use client';

import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const MASTERY_COLORS: Record<string, string> = {
  not_started: '#475569', exposed: '#ef4444', developing: '#f59e0b',
  proficient: '#0ea5e9', mastered: '#22c55e', automated: '#06b6d4',
};

export default function InteractiveGraph({ concepts = [], links = [] }: { concepts: any[], links: any[] }) {
  // Generate a circular/force layout dynamically
  const initialNodes = useMemo(() => {
    return concepts.map((c, i) => {
      const angle = (i / Math.max(1, concepts.length)) * 2 * Math.PI;
      const radius = c.mastery === 'mastered' || c.mastery === 'automated' ? 100 : c.mastery === 'exposed' || c.mastery === 'not_started' ? 350 : 220;
      
      return {
        id: c.id,
        position: { x: 400 + radius * Math.cos(angle), y: 300 + radius * Math.sin(angle) },
        data: { label: c.name },
        style: {
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          border: `2px solid ${MASTERY_COLORS[c.mastery] || '#475569'}`,
          borderRadius: '8px',
          padding: '10px',
          fontSize: '12px',
          fontWeight: 'bold',
          width: 150,
          boxShadow: c.mastery === 'automated' ? '0 0 15px rgba(6, 182, 212, 0.4)' : 'none'
        }
      };
    });
  }, [concepts]);

  const initialEdges = useMemo(() => {
    return links.map(l => ({
      id: l.id,
      source: l.source_concept_id,
      target: l.target_concept_id,
      animated: l.link_type === 'prerequisite',
      style: { stroke: 'var(--text-tertiary)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-tertiary)' },
    }));
  }, [links]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div style={{ width: '100%', height: '500px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
      <ReactFlow 
        nodes={nodes} 
        edges={edges} 
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        colorMode="dark"
      >
        <Background color="var(--border-strong)" gap={16} />
        <Controls style={{ background: 'var(--bg-secondary)', fill: 'var(--text-primary)' }} />
      </ReactFlow>
    </div>
  );
}
