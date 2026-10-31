/**
 * One die shown on its own, turning slowly in the light: what comes out of a pack. Browser only,
 * and loaded with the thrown dice' chunk (three.js).
 */
import * as THREE from "three";
import type { DiceLook } from "../looks";
import { buildDie } from "./scene";
import { dieShape } from "./shapes";

/**
 * Draws the die inside `container` (which it fills) until the returned function is called. With
 * reduced motion it holds still. If WebGL isn't available it draws nothing, and returns false
 * from `drawn` so the page can show a flat picture instead.
 */
export function showDie(
  container: HTMLElement,
  sides: number,
  look: DiceLook,
  { reducedMotion }: { reducedMotion: boolean },
): { stop: () => void; drawn: boolean } {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch {
    return { stop: () => {}, drawn: false };
  }
  const size = Math.max(1, Math.min(container.clientWidth, container.clientHeight));
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(size, size);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.9, 6.8);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.2);
  rim.position.set(4, -1, -3);
  scene.add(rim);

  const shape = dieShape(sides);
  const disposables: { dispose: () => void }[] = [renderer];
  const labels = shape.faces.map((_, face) => face + 1);
  const die = buildDie(shape, { sides, value: sides, kept: true, labels }, look, disposables);
  die.rotation.set(0.5, 0.6, 0.2);
  scene.add(die);

  let raf = 0;
  let last: number | undefined;
  const draw = (now: number) => {
    const seconds = last === undefined ? 0 : (now - last) / 1000;
    last = now;
    die.rotation.y += seconds * 0.6;
    die.rotation.x += seconds * 0.15;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(draw);
  };
  if (reducedMotion) renderer.render(scene, camera);
  else raf = requestAnimationFrame(draw);

  return {
    drawn: true,
    stop: () => {
      cancelAnimationFrame(raf);
      disposables.forEach((each) => each.dispose());
      renderer.domElement.remove();
    },
  };
}
