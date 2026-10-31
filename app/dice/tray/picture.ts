/**
 * Still pictures of dice, for lists: each drawn once with three.js into an image and kept, so a
 * page of dice needs one WebGL context however many it shows. Browser only, with the 3D dice.
 */
import * as THREE from "three";
import type { DiceLook } from "../looks";
import { hasEffects } from "./effects";
import { buildDie, lightWithRoom } from "./scene";
import { dieShape } from "./shapes";

const PIXELS = 192;
const pictures = new Map<string, string>();
let studio:
  | { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera }
  | null
  | undefined;

/** A picture of the die (a data URL), or undefined where WebGL isn't there. */
export function pictureOf(sides: number, look: DiceLook): string | undefined {
  const key = `${sides} ${JSON.stringify(look)}`;
  const kept = pictures.get(key);
  if (kept) return kept;
  const ready = studioFor();
  if (!ready) return undefined;
  const { renderer, scene, camera } = ready;
  // Prepared once, for the first fancy die: slow on weak graphics, and plain dice don't use it.
  if (hasEffects(look) && !scene.environment) lightWithRoom(renderer, scene, []);

  const shape = dieShape(sides);
  const disposables: { dispose: () => void }[] = [];
  const labels = shape.faces.map((_, face) => face + 1);
  const die = buildDie(shape, { sides, value: sides, kept: true, labels }, look, disposables);
  // Turned so its top number faces you, a little tilted, as in a shop's photo.
  die.rotation.set(0.45, 0.5, 0.15);
  scene.add(die);
  renderer.render(scene, camera);
  const picture = renderer.domElement.toDataURL("image/png");
  scene.remove(die);
  disposables.forEach((each) => each.dispose());
  pictures.set(key, picture);
  return picture;
}

function studioFor() {
  if (studio !== undefined) return studio;
  try {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(PIXELS, PIXELS);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0.7, 4.9);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-3, 4, 5);
    scene.add(key);
    studio = { renderer, scene, camera };
  } catch {
    studio = null;
  }
  return studio;
}
