"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, type Group } from "three";
import { boxGeometry } from "./geometry";
import { getMaterial } from "./materials";
import type { FurnitureModel, ModelNode, MovingPart } from "./model";
import type { QualitySettings } from "./quality";

function NodeMesh({ node, q, part }: { node: ModelNode; q: QualitySettings; part: string }) {
  const material = getMaterial(node.material, q);
  const shadow = q.shadows && (node.type !== "box" || node.shadow);
  const user = { kind: node.kind, part };
  if (node.type === "box") {
    const geometry = boxGeometry(node.size[0], node.size[1], node.size[2], node.grain, node.id.replace(/-\d+$/, "") + node.pos.map((v) => Math.round(v * 20)).join(","));
    const edge = node.edge ? getMaterial(node.edge, q) : material;
    const mats = node.front || node.edge ? [edge, edge, edge, edge, node.front ? getMaterial(node.front, q) : material, material] : material;
    return <mesh position={node.pos} geometry={geometry} material={mats} castShadow={shadow} receiveShadow={q.shadows} userData={user} dispose={null} />;
  }
  if (node.type === "cylinder") {
    const rotation: [number, number, number] = node.axis === "x" ? [0, 0, Math.PI / 2] : node.axis === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    const seg = q.tier === "low" ? 8 : 16;
    return (
      <mesh position={node.pos} rotation={rotation} material={material} castShadow={q.shadows} receiveShadow={q.shadows} userData={user} dispose={null}>
        <cylinderGeometry args={[node.radius, node.radius, node.length, seg]} />
      </mesh>
    );
  }
  return (
    <mesh position={node.pos} material={material} castShadow={q.shadows} userData={user} dispose={null}>
      <sphereGeometry args={[node.radius, q.tier === "low" ? 10 : 20, q.tier === "low" ? 8 : 14]} />
    </mesh>
  );
}

function Movable({ part, q, open, onToggle }: { part: MovingPart; q: QualitySettings; open: boolean; onToggle: (id: string) => void }) {
  const ref = useRef<Group>(null);
  const amount = useRef(0);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    invalidate();
  }, [open, invalidate]);

  useFrame((state, delta) => {
    const g = ref.current;
    if (!g) return;
    const target = open ? 1 : 0;
    amount.current = MathUtils.damp(amount.current, target, 5.5, delta);
    if (Math.abs(amount.current - target) < 0.002) amount.current = target;
    else state.invalidate();
    const a = amount.current;
    const mo = part.motion;
    g.position.set(part.pivot[0], part.pivot[1], part.pivot[2]);
    g.rotation.set(0, 0, 0);
    if (mo.type === "hinge") {
      if (mo.axis === "y") g.rotation.y = mo.openAngle * a;
      else g.rotation.x = mo.openAngle * a;
    } else if (mo.type === "slide") {
      g.position.x += mo.dx * a;
    } else {
      g.position.z += mo.dz * a;
    }
    g.userData.open = a;
  });

  return (
    <group
      ref={ref}
      position={part.pivot}
      userData={{ movable: part.kind, id: part.id, facadeId: part.facadeId, style: part.look.style, handle: part.look.handle, handleColor: part.look.handleColor, opening: part.look.opening, exposed: part.exposed, open: 0 }}
      onClick={(e) => {
        e.stopPropagation();
        onToggle(part.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      {part.children.map((n) => (
        <NodeMesh key={n.id} node={n} q={q} part={part.kind} />
      ))}
    </group>
  );
}

export function FurnitureMesh({
  model,
  q,
  openIds,
  onToggle,
  groupRef,
}: {
  model: FurnitureModel;
  q: QualitySettings;
  openIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  groupRef: React.RefObject<Group | null>;
}) {
  const fixed = useMemo(() => model.fixed, [model]);
  return (
    <group ref={groupRef} name="furniture">
      {fixed.map((n) => (
        <NodeMesh key={n.id} node={n} q={q} part="fixed" />
      ))}
      {model.moving.map((p) => (
        <Movable key={p.id} part={p} q={q} open={openIds.has(p.id)} onToggle={onToggle} />
      ))}
    </group>
  );
}
