class Graph {
  _nodes = new Map<string, any>();
  _edges = new Set<string>();
  _graphOpts = {};

  setDefaultEdgeLabel(labelFn?: any) {}
  setGraph(opts: any) {
    this._graphOpts = opts;
  }
  setNode(id: string, opts: any) {
    this._nodes.set(id, { id, ...opts, x: 0, y: 0 });
  }
  setEdge(source: string, target: string) {
    this._edges.add(`${source}->${target}`);
  }
  node(id: string) {
    return this._nodes.get(id) || { x: 0, y: 0 };
  }
}

const dagre = {
  graphlib: {
    Graph
  },
  layout(g: Graph) {
    const nodes = Array.from(g._nodes.values());
    const count = nodes.length;
    if (count === 0) return;

    // Simple top-down tree layout based on edge dependencies or simple levels
    const inDegrees = new Map<string, number>();
    nodes.forEach(n => inDegrees.set(n.id, 0));
    
    const adj = new Map<string, string[]>();
    nodes.forEach(n => adj.set(n.id, []));

    g._edges.forEach(e => {
      const [src, dst] = e.split('->');
      if (inDegrees.has(dst)) {
        inDegrees.set(dst, (inDegrees.get(dst) || 0) + 1);
      }
      if (adj.has(src)) {
        adj.get(src)!.push(dst);
      }
    });

    const levels = new Map<string, number>();
    const queue: string[] = [];
    nodes.forEach(n => {
      if (inDegrees.get(n.id) === 0) {
        levels.set(n.id, 0);
        queue.push(n.id);
      }
    });

    while (queue.length > 0) {
      const u = queue.shift()!;
      const uLevel = levels.get(u) || 0;
      const neighbors = adj.get(u) || [];
      neighbors.forEach(v => {
        const currentVLevel = levels.get(v) || 0;
        levels.set(v, Math.max(currentVLevel, uLevel + 1));
        queue.push(v);
      });
    }

    nodes.forEach(n => {
      if (!levels.has(n.id)) {
        levels.set(n.id, 0);
      }
    });

    const levelGroups = new Map<number, any[]>();
    nodes.forEach(n => {
      const lvl = levels.get(n.id) || 0;
      if (!levelGroups.has(lvl)) {
        levelGroups.set(lvl, []);
      }
      levelGroups.get(lvl)!.push(n);
    });

    const startY = 100;
    const rankSep = 180;
    const nodeSep = 220;

    levelGroups.forEach((group, lvl) => {
      const y = startY + lvl * rankSep;
      const totalWidth = (group.length - 1) * nodeSep;
      const startX = 500 - totalWidth / 2;

      group.forEach((node, idx) => {
        const x = startX + idx * nodeSep;
        const n = g._nodes.get(node.id);
        if (n) {
          n.x = x;
          n.y = y;
        }
      });
    });
  }
};

export default dagre;
export const graphlib = dagre.graphlib;
export const layout = dagre.layout;
