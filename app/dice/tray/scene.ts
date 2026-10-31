/**
 * Dice thrown across the screen, landing on a result already rolled. Browser only, and loaded
 * only when something's first thrown (it brings three.js and cannon-es).
 */
import * as THREE from "three";
import type { DiceLook, DieLookAndVoice } from "../looks";
import { seededRng } from "../rng";
import type { DieRoll } from "../roll";
import { planThrow, quaternionAt, type PlannedDie } from "./plan";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  bodyMaterial,
  coreMesh,
  hasEffects,
  inclusionMeshes,
  symbolFor,
  type Animate,
} from "./effects";
import { dieShape, type DieShape } from "./shapes";
import { DiceSound } from "./sound";

/** How long the dice stay once they've landed, then how long they take to fade. */
const STAY_MS = 1800;
const FADE_MS = 600;
const CAMERA_HEIGHT = 22;
const FOV = 35;

export interface ThrowOptions {
  /** Where the dice start and how they spin (the same seed throws the same way). */
  seed: number;
  /** Each thrown die's look and sound (by `thrownDice`), so one roll can mix styles. */
  styles: readonly DieLookAndVoice[];
  /** 0 for silence. */
  volume: number;
  /** No tumbling: the dice appear where they land. */
  reducedMotion: boolean;
  /** The dice have stopped, so the result can be shown. */
  onLanded: () => void;
}

/**
 * Throws the dice inside `container` (which they fill), then fades them away. Returns a function
 * that stops at once and tidies up. If WebGL isn't available, the dice have "landed" at once.
 */
export function throwDice(
  container: HTMLElement,
  rolls: readonly DieRoll[],
  { seed, styles, volume, reducedMotion, onLanded }: ThrowOptions,
): () => void {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch {
    onLanded();
    return () => {};
  }
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.domElement.style.transition = `opacity ${FADE_MS}ms`;
  container.appendChild(renderer.domElement);

  const rng = seededRng(seed);
  const halfZ = CAMERA_HEIGHT * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const halfX = halfZ * (width / height);
  const plan = planThrow(rolls, rng, { halfX: halfX - 1, halfZ: halfZ - 1 });

  const disposables: { dispose: () => void }[] = [renderer];
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, width / height, 1, 100);
  camera.position.set(0, CAMERA_HEIGHT, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  // Preparing the reflections is slow on weak graphics: only for throws with fancy dice.
  if (styles.some(({ look }) => hasEffects(look))) lightWithRoom(renderer, scene, disposables);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-6, 20, -4);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -halfX, right: halfX, top: halfZ, bottom: -halfZ });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  // The table itself is invisible: only the dice's shadows fall on it.
  const table = new THREE.Mesh(
    new THREE.PlaneGeometry(halfX * 2, halfZ * 2),
    new THREE.ShadowMaterial({ opacity: 0.35 }),
  );
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.add(table);
  disposables.push(table.geometry, table.material);
  const animate: Animate[] = [];
  const meshes = plan.dice.map((die, index) => {
    const look = styles[index].look;
    const mesh = buildDie(dieShape(die.sides), die, look, disposables, seed + index, animate);
    scene.add(mesh);
    return mesh;
  });

  const sound = volume > 0 ? new DiceSound(volume, styles[0].voice, rng) : undefined;
  const last = plan.frames.length - 1;
  let heard = reducedMotion ? plan.knocks.length : 0;
  if (reducedMotion) sound?.knock(0.4, 1000);
  let started: number | undefined;
  let frame = reducedMotion ? last : 0;
  let raf = 0;
  let timer: number | undefined;
  let stopped = false;

  const draw = (now: number) => {
    started ??= now;
    if (!reducedMotion) frame = Math.min(Math.floor(((now - started) / 1000) * 60), last);
    const data = plan.frames[frame];
    meshes.forEach((mesh, index) => {
      mesh.position.fromArray(data, index * 7);
      mesh.quaternion.copy(quaternionAt(data, index));
    });
    animate.forEach((each) => each((now - started!) / 1000));
    renderer.render(scene, camera);
    if (sound && !reducedMotion) {
      // A few knocks at once at most: more is a din, not dice.
      let together = 0;
      while (heard < plan.knocks.length && plan.knocks[heard].frame <= frame) {
        const { die, strength, pitch } = plan.knocks[heard++];
        if (together++ < 3) sound.knock(strength, pitch, styles[die].voice);
      }
      sound.roll(plan.rolling[frame] ?? 0);
    }
    if (frame < last) {
      raf = requestAnimationFrame(draw);
      return;
    }
    onLanded();
    timer = window.setTimeout(() => {
      renderer.domElement.style.opacity = "0";
      timer = window.setTimeout(stop, FADE_MS);
    }, STAY_MS);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    window.clearTimeout(timer);
    disposables.forEach((each) => each.dispose());
    sound?.close();
    renderer.domElement.remove();
  };
  raf = requestAnimationFrame(draw);
  return stop;
}

/** Reflections from a plain lit room, so fancy dice's glitter and shine have something to catch. */
export function lightWithRoom(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  disposables: { dispose: () => void }[],
) {
  const generator = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = generator.fromScene(room, 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.3;
  room.dispose();
  generator.dispose();
  disposables.push(environment);
}

export function buildDie(
  shape: DieShape,
  die: PlannedDie,
  look: DiceLook,
  disposables: { dispose: () => void }[],
  seed = 1,
  animate: Animate[] = [],
): THREE.Object3D {
  // The die an advantage roll dropped is drawn faded; with a core or things inside, the shell is
  // see-through whatever the look says.
  const inside = !!look.core || !!look.inclusions;
  const opacity = (inside ? Math.min(look.opacity, 0.4) : look.opacity) * (die.kept ? 1 : 0.45);
  const body = bodyMaterial(look, opacity, seed, animate);
  const geometry = shape.geometry.clone();
  disposables.push(body, geometry);
  const mesh = new THREE.Mesh(geometry, body);
  mesh.castShadow = true;
  if (look.core) mesh.add(coreMesh(geometry, look, seed, animate, disposables));
  for (const inclusion of inclusionMeshes(look, seed, disposables)) mesh.add(inclusion);
  const number = (value: number, size: number) => {
    const texture = numberTexture(value, die.sides, look);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: die.kept ? 1 : 0.5,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    const plane = new THREE.PlaneGeometry(size, size);
    disposables.push(texture, material, plane);
    return new THREE.Mesh(plane, material);
  };

  if (die.sides === 4) {
    // A d4 is read by its top tip: each side carries the numbers of its three corners, each
    // written pointing at its corner, as on real dice.
    for (const { normal, corners } of shape.sides3d) {
      const centre = corners
        .reduce((sum, v) => sum.add(shape.vertices[v]), new THREE.Vector3())
        .divideScalar(corners.length);
      for (const corner of corners) {
        const towards = shape.vertices[corner].clone().sub(centre);
        const label = number(die.labels[corner], shape.faces[corner].size);
        const up = towards.clone().normalize();
        label.quaternion.setFromRotationMatrix(
          new THREE.Matrix4().makeBasis(up.clone().cross(normal), up, normal),
        );
        label.position.copy(centre).addScaledVector(towards, 0.45).addScaledVector(normal, 0.005);
        mesh.add(label);
      }
    }
    return mesh;
  }
  shape.faces.forEach((face, index) => {
    const label = number(die.labels[index], face.size);
    label.position.copy(face.centre).addScaledVector(face.normal, 0.005);
    label.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.normal);
    mesh.add(label);
  });
  return mesh;
}

function numberTexture(value: number, sides: number, look: DiceLook): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.fillStyle = look.ink;
  if (look.glow) {
    context.shadowColor = look.glow;
    context.shadowBlur = 14;
  }
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `bold ${value >= 10 ? 60 : 72}px ${look.font}`;
  const symbol = symbolFor(look, value, sides);
  if (symbol) {
    // An icon in place of the number: drawn on 512 × 512, shrunk to fit the face.
    context.translate(20, 22);
    context.scale(88 / 512, 88 / 512);
    context.fill(symbol);
    context.setTransform(1, 0, 0, 1, 0, 0);
  } else context.fillText(String(value), 64, 68);
  // 6 and 9 underlined, as real dice do.
  if ((value === 6 || value === 9) && sides > 6) context.fillRect(44, 104, 40, 6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
