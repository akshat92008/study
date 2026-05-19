'use client';

import React, { useState } from 'react';

export const MarkerType = {
  Arrow: 'arrow',
  ArrowClosed: 'arrowclosed',
};

export function useNodesState(initialNodes: any[]) {
  const [nodes, setNodes] = useState(initialNodes);
  const onNodesChange = () => {};
  return [nodes, setNodes, onNodesChange] as const;
}

export function useEdgesState(initialEdges: any[]) {
  const [edges, setEdges] = useState(initialEdges);
  const onEdgesChange = () => {};
  return [edges, setEdges, onEdgesChange] as const;
}

export function Background({ color, gap }: any) {
  return null;
}

export function Controls({ style }: any) {
  return null;
}

export function ReactFlow({ nodes = [], edges = [], children, fitView, colorMode }: any) {
  const nodeMap = new Map<string, any>(nodes.map((n: any) => [n.id, n]));

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', userSelect: 'none', background: 'var(--bg-primary)' }}>
      {/* SVG Canvas for Edges */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
        }}
        viewBox="0 0 1000 800"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker
            id="arrowclosed"
            viewBox="0 0 10 10"
            refX="20"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--text-tertiary)" />
          </marker>
        </defs>

        {/* Connections */}
        {edges.map((edge: any) => {
          const sourceNode = nodeMap.get(edge.source);
          const targetNode = nodeMap.get(edge.target);
          if (!sourceNode || !targetNode) return null;

          const x1 = sourceNode.position.x;
          const y1 = sourceNode.position.y;
          const x2 = targetNode.position.x;
          const y2 = targetNode.position.y;

          return (
            <line
              key={edge.id}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={edge.style?.stroke || 'var(--text-tertiary)'}
              strokeWidth={edge.style?.strokeWidth || 2}
              strokeDasharray={edge.animated ? '5,5' : undefined}
              markerEnd="url(#arrowclosed)"
              opacity={0.5}
            />
          );
        })}
      </svg>

      {/* HTML Layer for Nodes */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 2,
        }}
      >
        {/* Scale container to ensure it fits responsiveness */}
        <div style={{
          position: 'relative',
          width: '1000px',
          height: '800px',
          transform: 'scale(0.65) translate(-250px, -180px)',
          transformOrigin: 'top left',
        }}>
          {nodes.map((node: any) => {
            const left = node.position.x - 75; // Center horizontally
            const top = node.position.y - 20;  // Center vertically
            return (
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '40px',
                  ...node.style,
                }}
              >
                {node.data?.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
