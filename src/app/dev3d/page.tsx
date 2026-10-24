"use client";

import { useEffect, useState } from "react";
import { categoryDefaults, setDimensions, setStructure } from "@/domain/edit";
import type { FurnitureDesign } from "@/domain/design";
import { seedLibrary } from "@/domain/materials";
import { LazyViewer } from "@/components/viewer/viewer-lazy";

const lib = seedLibrary();

export default function Page() {
  const [design, setDesign] = useState<FurnitureDesign | null>(null);
  useEffect(() => {
    let d: FurnitureDesign = { schemaVersion: 1, category: "wardrobes" };
    d = { ...d, ...categoryDefaults("wardrobes", lib) } as FurnitureDesign;
    d = { ...d, ...setDimensions(d, { widthMm: 3000, heightMm: 2400, depthMm: 600 }) } as FurnitureDesign;
    d = { ...d, ...setStructure(d, { doorCount: 7 }) } as FurnitureDesign;
    d = { ...d, materials: { ...d.materials, bodyColorId: "col-white", bodyFinishId: "fin-melamine", bodyMaterialId: "board-melamine", facadeColorId: "col-white", facadeFinishId: "fin-laminate", facadeMaterialId: "fac-mdf" }, facades: { ...d.facades, defaults: { handle: "long", handleColor: "black" } } };
    setDesign(d);
  }, []);
  if (!design) return null;
  return (
    <div className="mx-auto h-dvh max-w-5xl p-4">
      <LazyViewer design={design} library={lib} name="בדיקה" className="h-full" />
    </div>
  );
}
