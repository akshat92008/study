declare module '@xyflow/react' {
  import type * as React from 'react';

  export type Node = any;
  export type Edge = any;

  export const ReactFlow: React.FC<any>;
  export const Background: React.FC<any>;
  export const Controls: React.FC<any>;
  export const Panel: React.FC<any>;
  export const MarkerType: Record<string, string>;
  export const Position: Record<string, string>;

  export function useNodesState<T = any>(initialNodes: T[]): [T[], (nodes: T[]) => void, (...args: any[]) => void];
  export function useEdgesState<T = any>(initialEdges: T[]): [T[], (edges: T[]) => void, (...args: any[]) => void];
}

declare module '@xyflow/react/dist/style.css';
