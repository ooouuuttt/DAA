"use client";

import type { Node, Edge } from '@/lib/graph';

interface DummyMapProps {
  nodes: Node[];
  edges: Edge[];
  highlightedPath?: string[];
}

export default function DummyMap({ nodes, edges, highlightedPath = [] }: DummyMapProps) {
  const pathEdges = new Set<string>();
  if (highlightedPath.length > 1) {
    for (let i = 0; i < highlightedPath.length - 1; i++) {
      const u = highlightedPath[i];
      const v = highlightedPath[i + 1];
      pathEdges.add(`${u}-${v}`);
      pathEdges.add(`${v}-${u}`);
    }
  }

  return (
    <div className="w-full aspect-video bg-card rounded-lg p-4 border relative">
      <svg viewBox="0 0 500 350" width="100%" height="100%">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--accent))" />
          </marker>
        </defs>

        {/* All Edges */}
        {edges.map((edge) => (
          <line
            key={`${edge.source}-${edge.target}`}
            x1={nodes.find((n) => n.id === edge.source)!.x}
            y1={nodes.find((n) => n.id === edge.source)!.y}
            x2={nodes.find((n) => n.id === edge.target)!.x}
            y2={nodes.find((n) => n.id === edge.target)!.y}
            className="stroke-border"
            strokeWidth="1"
          />
        ))}

        {/* Highlighted Path Edges */}
        {edges
          .filter(
            (edge) =>
              pathEdges.has(`${edge.source}-${edge.target}`) ||
              pathEdges.has(`${edge.target}-${edge.source}`)
          )
          .map((edge) => (
            <line
              key={`highlight-${edge.source}-${edge.target}`}
              x1={nodes.find((n) => n.id === edge.source)!.x}
              y1={nodes.find((n) => n.id === edge.source)!.y}
              x2={nodes.find((n) => n.id === edge.target)!.x}
              y2={nodes.find((n) => n.id === edge.target)!.y}
              className="stroke-accent"
              strokeWidth="2.5"
              markerEnd="url(#arrow)"
            />
          ))}

        {/* All Nodes */}
        {nodes.map((node) => {
          const isWarehouse = node.id === 'warehouse';
          const onPath = highlightedPath.includes(node.id);
          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              <circle
                r={isWarehouse ? 8 : 6}
                className={`${isWarehouse ? 'fill-primary' : 'fill-card'} stroke-primary`}
                strokeWidth={onPath ? 2 : 1}
              />
              <text
                dy={isWarehouse ? -12 : -10}
                textAnchor="middle"
                className="text-[8px] font-sans fill-foreground font-semibold"
              >
                {node.name}
              </text>
              <text
                dy={isWarehouse ? 20 : 16}
                textAnchor="middle"
                className="text-[7px] font-code fill-muted-foreground"
              >
                ({node.x}, {node.y})
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
