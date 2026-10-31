import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { dieShape } from "./shapes";
import { TRAY_SIDES } from "./thrown";

describe("dieShape", () => {
  it.each([...TRAY_SIDES])("draws every triangle of a d%i facing outwards", (sides) => {
    // Facing inwards, a triangle is skipped when drawn, leaving a hole in the die.
    const position = dieShape(sides).geometry.getAttribute("position");
    const corner = (i: number) => new THREE.Vector3().fromBufferAttribute(position, i);
    for (let i = 0; i < position.count; i += 3) {
      const [a, b, c] = [corner(i), corner(i + 1), corner(i + 2)];
      const facing = new THREE.Vector3()
        .subVectors(b, a)
        .cross(new THREE.Vector3().subVectors(c, a));
      const centre = a.clone().add(b).add(c).divideScalar(3);
      expect(facing.dot(centre), `d${sides}, triangle ${i / 3}`).toBeGreaterThan(0);
    }
  });
});
