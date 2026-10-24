"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useImperativeHandle, useMemo, type Ref } from "react";
import { HalfFloatType, Vector2, WebGLRenderTarget } from "three";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";

export interface PostHandle {
  /** מרנדר פריים אחד ברזולוציה מוגברת (עם עומק שדה עדין) ומחזיר את הקנבס. */
  renderHiRes: (opts: { pixelRatio: number; focus: number }) => HTMLCanvasElement;
}

interface Props {
  handleRef?: Ref<PostHandle>;
  /** רדיוס AO במטרים. */
  aoRadius?: number;
}

/**
 * מעבד תמונה לאיכות גבוהה: MSAA, חסימת אור סביבתית (GTAO) ומיפוי גוונים בסוף.
 * כל עוד הרכיב קיים, הוא מחליף את הרינדור האוטומטי. ברינדור ״צור הדמיה״ מתווסף עומק שדה עדין.
 */
export function PostFX({ handleRef, aoRadius = 0.45 }: Props) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const parts = useMemo(() => {
    const dpr = gl.getPixelRatio();
    const w = Math.max(2, Math.floor(size.width * dpr));
    const h = Math.max(2, Math.floor(size.height * dpr));
    const target = new WebGLRenderTarget(w, h, { type: HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    const ao = new GTAOPass(scene, camera, w, h);
    ao.output = GTAOPass.OUTPUT.Default;
    ao.blendIntensity = 1;
    ao.updateGtaoMaterial({ radius: aoRadius, distanceExponent: 1.4, thickness: 1.5, scale: 1.5, samples: 16, distanceFallOff: 1, screenSpaceRadius: false });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1, rings: 2, samples: 16 });
    composer.addPass(ao);
    const bokeh = new BokehPass(scene, camera, { focus: 5, aperture: 0.0012, maxblur: 0.0045 });
    bokeh.enabled = false;
    composer.addPass(bokeh);
    composer.addPass(new OutputPass());
    return { composer, ao, bokeh, target };
    // מידות הקנבס מתעדכנות בנפרד (setSize), בלי לבנות מחדש
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, aoRadius]);

  useEffect(() => {
    parts.composer.setPixelRatio(gl.getPixelRatio());
    parts.composer.setSize(size.width, size.height);
  }, [parts, gl, size.width, size.height]);

  useEffect(
    () => () => {
      parts.composer.dispose();
      parts.ao.dispose();
      parts.bokeh.dispose();
      parts.target.dispose();
    },
    [parts],
  );

  useFrame(() => {
    parts.composer.render();
  }, 1);

  useImperativeHandle(
    handleRef,
    () => ({
      renderHiRes: ({ pixelRatio, focus }) => {
        const prev = gl.getPixelRatio();
        const css = new Vector2();
        gl.getSize(css);
        gl.setPixelRatio(pixelRatio);
        parts.composer.setPixelRatio(pixelRatio);
        parts.composer.setSize(css.x, css.y);
        const uniforms = (parts.bokeh as unknown as { uniforms: { focus: { value: number } } }).uniforms;
        uniforms.focus.value = focus;
        parts.bokeh.enabled = true;
        parts.composer.render();
        parts.bokeh.enabled = false;
        const canvas = gl.domElement;
        const copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        copy.getContext("2d")!.drawImage(canvas, 0, 0);
        gl.setPixelRatio(prev);
        parts.composer.setPixelRatio(prev);
        parts.composer.setSize(css.x, css.y);
        parts.composer.render();
        return copy;
      },
    }),
    [gl, parts],
  );

  return null;
}
