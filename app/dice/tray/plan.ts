import * as CANNON from "cannon-es";
import * as THREE from "three";
import type { Rng } from "../rng";
import type { DieRoll } from "../roll";
import { TRAY_SIDES, dieShape, faceUp } from "./shapes";

/** More than this many dice in one roll: the first ones are thrown, all are in the text. */
export const MOST_DICE_THROWN = 10;
const STEP = 1 / 60;
/** No throw lasts longer than this, still or not. */
const LONGEST_STEPS = 60 * 3.5;
/** Stopped: every die barely moving for this many steps. */
const STILL_STEPS = 15;

/** Half the tray's width and depth, in the dice's units (a die is about 2 across). */
export interface TrayBounds {
  halfX: number;
  halfZ: number;
}

export interface PlannedDie {
  sides: number;
  value: number;
  kept: boolean;
  /** The number on each face (by `DieShape.faces`), arranged so `value` ends up on top. */
  labels: number[];
}

/**
 * A whole throw, worked out before any of it is shown: each frame's positions (per die x, y, z
 * and a quaternion), the knocks to hear (a die hitting the table or another die), and how fast
 * the dice are rolling along the table.
 */
export interface ThrowPlan {
  dice: PlannedDie[];
  frames: Float32Array[];
  knocks: { frame: number; strength: number; pitch: number }[];
  rolling: number[];
}

/** Whether any of these dice would be thrown, rather than only shown as text. */
export function throwsAny(rolls: readonly DieRoll[]): boolean {
  return rolls.some((die) => TRAY_SIDES.has(die.sides));
}

/**
 * Throws the dice in a physics simulation, then numbers each one so that the face that ended up
 * on top shows the value already rolled. The physics decides only how the dice move, never the
 * result. `rng` only sets where they start and how they spin.
 */
export function planThrow(rolls: readonly DieRoll[], rng: Rng, bounds: TrayBounds): ThrowPlan {
  const thrown = rolls.filter((die) => TRAY_SIDES.has(die.sides)).slice(0, MOST_DICE_THROWN);
  const { frames, knocks, rolling } = simulate(thrown, rng, bounds);
  const last = frames[frames.length - 1];
  const dice = thrown.map((die, index): PlannedDie => {
    const shape = dieShape(die.sides);
    const up = faceUp(shape, quaternionAt(last, index));
    const labels = shape.faces.map((_, face) => face + 1);
    // The face on top shows the rolled value: swap it with the face that had that value.
    const had = labels.indexOf(die.value);
    [labels[up], labels[had]] = [labels[had], labels[up]];
    return { sides: die.sides, value: die.value, kept: die.kept, labels };
  });
  return { dice, frames, knocks, rolling };
}

/** A die's turn in a frame. */
export function quaternionAt(frame: Float32Array, index: number): THREE.Quaternion {
  const at = index * 7 + 3;
  return new THREE.Quaternion(frame[at], frame[at + 1], frame[at + 2], frame[at + 3]);
}

function simulate(dice: readonly DieRoll[], rng: Rng, { halfX, halfZ }: TrayBounds) {
  const random = () => rng(10_000) / 10_000;
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -40, 0) });
  const material = new CANNON.Material();
  world.addContactMaterial(
    new CANNON.ContactMaterial(material, material, { friction: 0.25, restitution: 0.35 }),
  );
  // The table, and walls at the tray's edges.
  const walls: [CANNON.Vec3, number, number][] = [
    [new CANNON.Vec3(0, 0, 0), -Math.PI / 2, 0],
    [new CANNON.Vec3(-halfX, 0, 0), 0, Math.PI / 2],
    [new CANNON.Vec3(halfX, 0, 0), 0, -Math.PI / 2],
    [new CANNON.Vec3(0, 0, -halfZ), 0, 0],
    [new CANNON.Vec3(0, 0, halfZ), 0, Math.PI],
  ];
  for (const [at, aboutX, aboutY] of walls) {
    const wall = new CANNON.Body({ mass: 0, material, shape: new CANNON.Plane() });
    wall.position.copy(at);
    wall.quaternion.setFromEuler(aboutX, aboutY, 0);
    world.addBody(wall);
  }

  const knocks: ThrowPlan["knocks"] = [];
  let step = 0;
  // Thrown from the bottom right towards the middle, the way a hand would.
  const bodies = dice.map((die, index) => {
    const shape = dieShape(die.sides);
    const body = new CANNON.Body({
      mass: 1,
      material,
      shape: new CANNON.ConvexPolyhedron({
        vertices: shape.vertices.map((v) => new CANNON.Vec3(v.x, v.y, v.z)),
        faces: shape.triangles,
      }),
      angularDamping: 0.25,
      linearDamping: 0.1,
    });
    body.position.set(
      halfX * (0.55 + 0.3 * random()),
      3 + 2 * random() + index * 0.3,
      halfZ * (0.2 + 0.6 * random()) - index * 0.4,
    );
    body.quaternion.setFromEuler(random() * 6.3, random() * 6.3, random() * 6.3);
    body.velocity.set(-(14 + 8 * random()), 2, -(8 + 8 * random()));
    body.angularVelocity.set((random() - 0.5) * 30, (random() - 0.5) * 30, (random() - 0.5) * 30);
    // Smaller dice click higher, and a die on a die higher than one on the table.
    const pitch = { 4: 1.25, 6: 1, 8: 1.1, 10: 1.05, 12: 0.95, 20: 0.9 }[die.sides] ?? 1;
    body.addEventListener(
      "collide",
      (event: { body: CANNON.Body; contact: CANNON.ContactEquation }) => {
        const speed = Math.abs(event.contact.getImpactVelocityAlongNormal());
        if (speed < 1.5) return;
        knocks.push({
          frame: step,
          strength: Math.min(1, speed / 14) ** 1.4,
          pitch: (event.body.mass > 0 ? 3200 : 1700) * pitch * (0.9 + 0.2 * random()),
        });
      },
    );
    world.addBody(body);
    return body;
  });

  const frames: Float32Array[] = [];
  const rolling: number[] = [];
  let still = 0;
  for (; step < LONGEST_STEPS && still <= STILL_STEPS; step++) {
    world.step(STEP);
    const frame = new Float32Array(bodies.length * 7);
    bodies.forEach((body, index) => {
      const { position: p, quaternion: q } = body;
      frame.set([p.x, p.y, p.z, q.x, q.y, q.z, q.w], index * 7);
    });
    frames.push(frame);
    const onTable = bodies.filter((body) => body.position.y < 1.6);
    const speed = onTable.reduce(
      (sum, body) => sum + body.velocity.length() + body.angularVelocity.length() * 0.3,
      0,
    );
    rolling.push(Math.min(1, speed / 30));
    const stopped = bodies.every(
      (body) => body.velocity.length() < 0.4 && body.angularVelocity.length() < 0.8,
    );
    still = stopped ? still + 1 : 0;
  }
  return { frames, knocks, rolling };
}
