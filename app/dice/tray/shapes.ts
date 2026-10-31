import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** The dice drawn in 3D. Others (d2, d3, d100…) show as text only. */
export const TRAY_SIDES: ReadonlySet<number> = new Set([4, 6, 8, 10, 12, 20]);

export interface Face {
  /** Outward, in the die's own frame. */
  normal: THREE.Vector3;
  centre: THREE.Vector3;
  /** How big its number is drawn. */
  size: number;
}

/** One die's shape: for the physics, for drawing, and for reading which face is up. */
export interface DieShape {
  sides: number;
  geometry: THREE.BufferGeometry;
  vertices: THREE.Vector3[];
  /** Outward-facing triangles, counter-clockwise from outside, as cannon-es wants. */
  triangles: [number, number, number][];
  /**
   * One per number. A d4 is read by its top tip, so its "faces" are its corners; the others by the
   * side facing up.
   */
  faces: Face[];
  /** The flat sides, with their corners (a d4's numbers are written in its corners). */
  sides3d: { normal: THREE.Vector3; corners: number[] }[];
}

const shapes = new Map<number, DieShape>();

/** The shape of a die with this many sides (made once). */
export function dieShape(sides: number): DieShape {
  let shape = shapes.get(sides);
  if (!shape) {
    shape = makeShape(sides);
    shapes.set(sides, shape);
  }
  return shape;
}

/** Which face is up when the die is turned by `rotation` (for a d4, the tip). */
export function faceUp(shape: DieShape, rotation: THREE.Quaternion): number {
  let best = 0;
  let highest = -Infinity;
  shape.faces.forEach((face, index) => {
    const pointing = shape.sides === 4 ? face.centre : face.normal;
    const y = pointing.clone().applyQuaternion(rotation).y;
    if (y > highest) [best, highest] = [index, y];
  });
  return best;
}

function makeShape(sides: number): DieShape {
  const source = baseGeometry(sides);
  // One vertex per corner, so the triangles of a flat side can be gathered together.
  const bare = new THREE.BufferGeometry().setAttribute("position", source.getAttribute("position"));
  if (source.index) bare.setIndex(source.index);
  const merged = mergeVertices(bare, 1e-4);
  source.dispose();
  bare.dispose();

  const position = merged.getAttribute("position");
  const vertices = Array.from({ length: position.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(position, i),
  );
  const index = merged.index!;
  const triangles: [number, number, number][] = [];
  // Triangles facing the same way make up one flat side.
  const flat: { normal: THREE.Vector3; corners: Set<number> }[] = [];
  for (let i = 0; i < index.count; i += 3) {
    let triangle: [number, number, number] = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const [a, b, c] = triangle.map((v) => vertices[v]);
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (normal.dot(a) < 0) {
      triangle = [triangle[0], triangle[2], triangle[1]];
      normal.negate();
    }
    normal.normalize();
    triangles.push(triangle);
    let side = flat.find((each) => each.normal.dot(normal) > 0.999);
    if (!side) flat.push((side = { normal, corners: new Set<number>() }));
    triangle.forEach((v) => side.corners.add(v));
  }
  const sides3d = flat.map(({ normal, corners }) => ({
    normal,
    corners: [...corners],
  }));
  const faces: Face[] =
    sides === 4
      ? vertices.map((v) => ({ normal: v.clone().normalize(), centre: v.clone(), size: 0.75 }))
      : sides3d.map(({ normal, corners }) => {
          const points = corners.map((v) => vertices[v]);
          const centre = points
            .reduce((sum, p) => sum.add(p), new THREE.Vector3())
            .divideScalar(points.length);
          const inner = Math.min(...points.map((p) => p.distanceTo(centre)));
          return { normal, centre, size: inner * (sides === 10 ? 0.8 : 1.1) };
        });
  const geometry = merged.toNonIndexed();
  geometry.computeVertexNormals();
  merged.dispose();
  return { sides, geometry, vertices, triangles, faces, sides3d };
}

function baseGeometry(sides: number): THREE.BufferGeometry {
  switch (sides) {
    case 4:
      return new THREE.TetrahedronGeometry(1.2);
    case 6:
      return new THREE.BoxGeometry(1.4, 1.4, 1.4);
    case 8:
      return new THREE.OctahedronGeometry(1.1);
    case 10:
      return trapezohedron();
    case 12:
      return new THREE.DodecahedronGeometry(1.1);
    case 20:
      return new THREE.IcosahedronGeometry(1.15);
    default:
      throw new Error(`No 3D die with ${sides} sides`);
  }
}

/** A d10: a pentagonal trapezohedron, its points' height chosen so each kite is flat. */
function trapezohedron(): THREE.BufferGeometry {
  const ring = 0.1;
  const cos36 = Math.cos(Math.PI / 5);
  const apex = (ring * (1 + cos36)) / (1 - cos36);
  const points = [new THREE.Vector3(0, apex, 0), new THREE.Vector3(0, -apex, 0)];
  for (let k = 0; k < 10; k++) {
    const angle = (k * Math.PI) / 5;
    points.push(new THREE.Vector3(Math.cos(angle), k % 2 ? -ring : ring, Math.sin(angle)));
  }
  const around = (k: number) => 2 + (k % 10);
  const indices: number[] = [];
  for (let k = 0; k < 10; k += 2) {
    indices.push(0, around(k), around(k + 1), 0, around(k + 1), around(k + 2));
    indices.push(1, around(k + 1), around(k + 2), 1, around(k + 2), around(k + 3));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map((p) => p.multiplyScalar(1.1)),
  );
  geometry.setIndex(indices);
  return geometry;
}
