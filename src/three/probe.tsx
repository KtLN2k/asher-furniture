"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useImperativeHandle, useMemo, type RefObject, type Ref } from "react";
import { CubeCamera, HalfFloatType, PMREMGenerator, WebGLCubeRenderTarget, type Group, type Scene, type WebGLRenderer, type WebGLRenderTarget } from "three";
import { setReflectionEnv } from "./materials";

/** שכבה שרואה רק מצלמת הבדיקה: קיר וחלון תאורה מאחורי המצלמה, שמופיעים רק בהשתקפויות. */
export const PROBE_LAYER = 1;

export interface ProbeHandle {
  update: () => void;
}

/** מחזיק את משאבי הצילום (קובייה ו-PMREM) ומבצע את הצילום עצמו, מחוץ למחזור הרינדור של React. */
class ProbeRig {
  private readonly target: WebGLCubeRenderTarget;
  private readonly camera: CubeCamera;
  private readonly pmrem: PMREMGenerator;
  private out: WebGLRenderTarget | null = null;

  constructor(gl: WebGLRenderer, size: number) {
    this.target = new WebGLCubeRenderTarget(size, { type: HalfFloatType, generateMipmaps: false });
    this.camera = new CubeCamera(0.1, 40, this.target);
    this.camera.children.forEach((child) => child.layers.enable(PROBE_LAYER));
    this.pmrem = new PMREMGenerator(gl);
  }

  capture(gl: WebGLRenderer, scene: Scene, furniture: Group | null, at: [number, number, number]): void {
    const wasVisible = furniture?.visible ?? true;
    const autoShadow = gl.shadowMap.autoUpdate;
    if (furniture) furniture.visible = false;
    gl.shadowMap.autoUpdate = false;
    this.camera.position.set(at[0], at[1], at[2]);
    this.camera.update(gl, scene);
    gl.shadowMap.autoUpdate = autoShadow;
    if (furniture) furniture.visible = wasVisible;
    const next = this.pmrem.fromCubemap(this.target.texture);
    this.out?.dispose();
    this.out = next;
    setReflectionEnv(next.texture);
  }

  dispose(): void {
    setReflectionEnv(null);
    this.out?.dispose();
    this.out = null;
    this.target.dispose();
    this.pmrem.dispose();
  }
}

interface Props {
  size: number;
  /** נקודת הצילום (מרכז הרהיט, מול החזית). */
  position: [number, number, number];
  furniture: RefObject<Group | null>;
  /** משתנה שמשתנה כשהחדר או הרהיט משתנים, כדי לצלם מחדש. */
  signature: string;
  handleRef?: Ref<ProbeHandle>;
}

/**
 * צילום קובייה של החדר מנקודה מול הרהיט, והמרתו למפת סביבה מסוננת (PMREM).
 * מראה וחזיתות מבריקות משתמשות בה, ולכן משקפות את הקירות, התקרה, הרצפה והחלון של החדר שנבחר.
 */
export function RoomProbe({ size, position, furniture, signature, handleRef }: Props) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const rig = useMemo(() => new ProbeRig(gl, size), [gl, size]);
  const [px, py, pz] = position;

  useImperativeHandle(
    handleRef,
    () => ({
      update: () => {
        rig.capture(gl, scene, furniture.current, [px, py, pz]);
        invalidate();
      },
    }),
    [rig, gl, scene, furniture, px, py, pz, invalidate],
  );

  useEffect(() => {
    const run = () => {
      rig.capture(gl, scene, furniture.current, [px, py, pz]);
      invalidate();
    };
    run();
    const late = window.setTimeout(run, 450);
    return () => window.clearTimeout(late);
  }, [signature, rig, gl, scene, furniture, px, py, pz, invalidate]);

  useEffect(() => () => rig.dispose(), [rig]);

  return null;
}
