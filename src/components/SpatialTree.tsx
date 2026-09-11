import { useMemo } from "react";
import type { HTMLAttributes } from "react";
import type { AtlasLayout, AtlasCamera, AtlasViewport } from "../lib/atlas";
import InkWorld from "./InkWorld";
import type { InkItem } from "./InkWorld";
export default function SpatialTree({
  graph,
  view,
  viewport,
  selectedId,
  active,
  onSelect,
  onBranch,
  ...interaction
}: Pick<
  HTMLAttributes<HTMLDivElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onKeyDown"
> & {
  dragging?: boolean;
  graph: AtlasLayout;
  view: AtlasCamera;
  viewport: AtlasViewport;
  selectedId: string;
  active: boolean;
  onSelect: (id: string) => void;
  onBranch: (id: string) => void;
}) {
  const items = useMemo<InkItem[]>(
    () =>
      graph.nodes.map((node) => ({
        id: node.person.id,
        title: node.person.name,
        subtitle: node.person.generation ?? "辈分待考",
        generation: node.person.generation ?? "待考",
        position: [
          (node.x - viewport.width * 0.5) / 70,
          (viewport.height * 0.5 - node.y) / 42,
          -(node.x - viewport.width * 0.5) / 230,
        ],
        branchLabel: node.childCount
          ? node.hiddenChildren
            ? `展开 ${node.hiddenChildren} 位传人`
            : "收起传人"
          : undefined,
      })),
    [graph, viewport.width, viewport.height],
  );
  return (
    <InkWorld
      {...interaction}
      mode="tree"
      items={items}
      links={graph.edges}
      selectedId={selectedId}
      view={view}
      active={active}
      onSelect={onSelect}
      onBranch={onBranch}
    />
  );
}
