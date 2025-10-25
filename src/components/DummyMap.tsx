"use client";

import type { Node, Edge } from '@/lib/graph';

type HighlightedNode = {
  id: string;
  type: 'depot' | 'warehouse' | 'customer';
}

interface DummyMapProps {
  nodes: Node[];
  edges: Edge[];
  highlightedPath?: string[];
  highlightedNodes?: HighlightedNode[];
}

export default function DummyMap({ nodes, edges, highlightedPath = [], highlightedNodes = [] }: DummyMapProps) {
  const pathEdges = new Set<string>();
  const directionalPathEdges = new Set<string>();

  if (highlightedPath.length > 1) {
    for (let i = 0; i < highlightedPath.length - 1; i++) {
      const u = highlightedPath[i];
      const v = highlightedPath[i + 1];
      // For bi-directional matching to find the edge
      pathEdges.add(`${u}-${v}`);
      pathEdges.add(`${v}-${u}`);
      // For directional arrow
      directionalPathEdges.add(`${u}-${v}`);
    }
  }

  const highlightedNodeMap = new Map(highlightedNodes.map(n => [n.id, n.type]));

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
            <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
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
          .map((edge) => {
            const isDirectional = directionalPathEdges.has(`${edge.source}-${edge.target}`);
            const isReversed = directionalPathEdges.has(`${edge.target}-${edge.source}`);
            return (
                <line
                key={`highlight-${edge.source}-${edge.target}`}
                x1={nodes.find((n) => n.id === edge.source)!.x}
                y1={nodes.find((n) => n.id === edge.source)!.y}
                x2={nodes.find((n) => n.id === edge.target)!.x}
                y2={nodes.find((n) => n.id === edge.target)!.y}
                className="stroke-primary"
                strokeWidth="2.5"
                markerEnd={isDirectional ? "url(#arrow)" : undefined}
                markerStart={isReversed ? "url(#arrow)" : undefined}
                />
            )
          })}

        {/* All Nodes */}
        {nodes.map((node) => {
          const isWarehouseNode = node.id.includes('warehouse');
          const highlightType = highlightedNodeMap.get(node.id);
          const onPath = highlightedPath.includes(node.id);

          let fillClass = 'fill-card';
          let strokeClass = 'stroke-muted-foreground';
          let radius = 6;

          if (highlightType === 'depot') {
            fillClass = 'fill-purple-500';
            strokeClass = 'stroke-purple-700';
            radius = 9;
          } else if (highlightType === 'warehouse') {
            fillClass = 'fill-blue-500';
            strokeClass = 'stroke-blue-700';
            radius = 8;
          } else if (highlightType === 'customer') {
            fillClass = 'fill-amber-400';
            strokeClass = 'stroke-amber-600';
            radius = 7;
          }
          
          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              <circle
                r={radius}
                className={`${fillClass} ${strokeClass}`}
                strokeWidth={onPath ? 2.5 : 1.5}
                stroke={onPath ? 'hsl(var(--primary))' : undefined}
              />
              <text
                dy={isWarehouseNode ? -14 : -12}
                textAnchor="middle"
                className="text-[8px] font-sans fill-foreground font-semibold"
              >
                {node.name}
              </text>
              {!isWarehouseNode && (
                 <text
                    dy={16}
                    textAnchor="middle"
                    className="text-[7px] font-code fill-muted-foreground"
                >
                    ({node.x}, {node.y})
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
