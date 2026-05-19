'use client';

import React, { useMemo, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState, 
  MarkerType, 
  Position,
  Panel,
  Node,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

const MASTERY_COLORS: Record<string, string> = {
  not_started: 'var(--text-tertiary)', 
  exposed: 'var(--danger)', 
  developing: 'var(--warning)',
  proficient: 'var(--info)', 
  mastered: 'var(--success)', 
  automated: 'var(--accent-cyan)',
};

// Dagre Auto-Layout Engine
const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Set layout configuration (Node dimensions + spacing)
  dagreGraph.setGraph({ rankdir: direction, ranker: 'longest-path', nodesep: 80, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 180, height: 60 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: direction === 'TB' ? Position.Top : Position.Left,
      sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
      position: {
        x: nodeWithPosition.x - 90, // shift by half width
        y: nodeWithPosition.y - 30, // shift by half height
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export default function InteractiveGraph({ concepts = [], links = [] }: { concepts: any[], links: any[] }) {
  
  // 1. Format Nodes & Edges for React Flow
  const initialNodes = useMemo(() => {
    return concepts.map((c) => ({
      id: c.id,
      data: { 
        label: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{c.name}</span>
            <span style={{ fontSize: '9px', opacity: 0.7, textTransform: 'uppercase' }}>
              {c.mastery.replace('_', ' ')}
            </span>
          </div>
        ) 
      },
      style: {
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        border: `2px solid ${MASTERY_COLORS[c.mastery] || 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '10px',
        width: 180,
        boxShadow: c.mastery === 'automated' ? '0 0 15px var(--accent-cyan-dim)' : 'var(--shadow-sm)',
      }
    }));
  }, [concepts]);

  const initialEdges = useMemo(() => {
    return links.map(l => ({
      id: l.id,
      source: l.source_concept_id,
      target: l.target_concept_id,
      animated: l.link_type === 'prerequisite', // Animate prerequisite flows
      style: { 
        stroke: MASTERY_COLORS[concepts.find(c => c.id === l.source_concept_id)?.mastery || 'not_started'], 
        strokeWidth: Math.max(1, (l.strength || 0.5) * 4) // Edge thickness based on strength
      },
      markerEnd: { 
        type: MarkerType.ArrowClosed, 
        color: MASTERY_COLORS[concepts.find(c => c.id === l.source_concept_id)?.mastery || 'not_started'] 
      },
    }));
  }, [links, concepts]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 2. Apply Auto-Layout on Mount
  useEffect(() => {
    if (initialNodes.length > 0) {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <div style={{ width: '100%', height: '600px', background: 'var(--bg-root)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border-default)' }}>
      <ReactFlow 
        nodes={nodes} 
        edges={edges} 
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        colorMode="dark"
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        attributionPosition="bottom-right"
      >
        <Background color="var(--border-strong)" gap={20} size={2} />
        <Controls style={{ background: 'var(--bg-secondary)', fill: 'var(--text-primary)', border: '1px solid var(--border-default)' }} />
        <Panel position="top-left" style={{ background: 'var(--bg-glass)', padding: 'var(--sp-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backdropFilter: 'blur(8px)', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
          Scroll to zoom • Click & Drag to pan
        </Panel>
      </ReactFlow>
    </div>
  );
}
