/**
 * Fancier dice: colours running through the body (marble, swirl, nebula, speckle), glitter,
 * a liquid core, things set inside the resin, and symbols. Patterns are worked out from each
 * point's place inside the die, not an image wrapped round it, so they suit every shape. Browser
 * only, with the rest of the 3D dice.
 */
import * as THREE from "three";
import { TOKEN_ICONS } from "~/maps/tokens/token-icons";
import type { DiceLook, DicePattern, InclusionKind } from "../looks";
import { seededRng } from "../rng";

/** Called each frame with the seconds since the throw began, for what moves inside a die. */
export type Animate = (seconds: number) => void;

const PATTERN_KINDS: Record<DicePattern["kind"], number> = {
  marble: 0,
  swirl: 1,
  nebula: 2,
  speckle: 3,
};

const NOISE = /* glsl */ `
varying vec3 vLocal;
uniform vec3 uColours[3];
uniform float uPattern;
uniform float uScale;
uniform vec3 uOffset;
uniform float uTime;
uniform vec3 uGlitter;
uniform float uGlitterAmount;

float gh_hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
vec3 gh_hash3(vec3 p) {
  return vec3(gh_hash(p), gh_hash(p + 19.19), gh_hash(p + 47.47));
}
float gh_noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(gh_hash(i), gh_hash(i + vec3(1, 0, 0)), f.x),
        mix(gh_hash(i + vec3(0, 1, 0)), gh_hash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(gh_hash(i + vec3(0, 0, 1)), gh_hash(i + vec3(1, 0, 1)), f.x),
        mix(gh_hash(i + vec3(0, 1, 1)), gh_hash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float gh_fbm(vec3 p) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 5; octave++) {
    sum += amplitude * gh_noise(p);
    p = p * 2.03 + 1.7;
    amplitude *= 0.5;
  }
  return sum;
}
vec3 gh_pattern(vec3 local) {
  vec3 p = local * uScale + uOffset;
  if (uPattern < 0.5) {
    // Marble: soft bands bent by noise, with thin veins of the third colour.
    float band = sin(p.x * 2.5 + p.y * 1.2 + gh_fbm(p * 1.6) * 7.0);
    vec3 colour = mix(uColours[0], uColours[1], smoothstep(-0.2, 1.0, band) * 0.6);
    return mix(colour, uColours[2], 1.0 - smoothstep(0.0, 0.09, abs(band)));
  }
  if (uPattern < 1.5) {
    // Swirl: noise folded into itself, slowly turning.
    vec3 q = p + vec3(gh_fbm(p + uTime * 0.15), gh_fbm(p + 5.2), gh_fbm(p + 9.1 - uTime * 0.1)) * 2.2;
    float f = gh_fbm(q * 1.3);
    vec3 colour = mix(uColours[0], uColours[1], smoothstep(0.3, 0.6, f));
    return mix(colour, uColours[2], smoothstep(0.55, 0.75, gh_fbm(q * 2.0 + 3.0)));
  }
  if (uPattern < 2.5) {
    // Nebula: dark, with clouds of colour.
    float clouds = gh_fbm(p * 1.4 + gh_fbm(p * 0.8) * 1.5);
    vec3 colour = mix(uColours[0], uColours[1], smoothstep(0.45, 0.8, clouds));
    return mix(colour, uColours[2], smoothstep(0.62, 0.9, gh_fbm(p * 2.2 + 7.0)) * 0.8);
  }
  // Speckle: a base with scattered spots of the other colours.
  vec3 cell = floor(p * 6.0);
  vec3 jitter = gh_hash3(cell);
  float spot = length(fract(p * 6.0) - jitter);
  float pick = gh_hash(cell + 3.3);
  vec3 spotColour = pick < 0.5 ? uColours[1] : uColours[2];
  return mix(spotColour, uColours[0], clamp(smoothstep(0.12, 0.2, spot) + step(pick, 0.15), 0.0, 1.0));
}
// Flecks: tiny, sparse, and each bright only when it faces the light it's turned to.
vec3 gh_glitter(vec3 local, vec3 viewNormal) {
  if (uGlitterAmount <= 0.0) return vec3(0.0);
  vec3 p = local * 14.0 + uOffset;
  vec3 cell = floor(p);
  if (gh_hash(cell + 11.0) > uGlitterAmount) return vec3(0.0);
  float near = length(fract(p) - (0.25 + 0.5 * gh_hash3(cell)));
  vec3 facing = normalize(gh_hash3(cell + 23.0) * 2.0 - 1.0 + vec3(0.0, 0.0, 0.8));
  float catchLight = pow(max(dot(viewNormal, facing), 0.0), 8.0);
  return uGlitter * (1.0 - smoothstep(0.06, 0.13, near)) * (0.25 + 3.0 * catchLight);
}
`;

/** A material for a die's body, or its core, with the look's pattern and glitter. */
export function bodyMaterial(
  look: DiceLook,
  opacity: number,
  seed: number,
  animate: Animate[],
  options: { core?: boolean } = {},
): THREE.MeshStandardMaterial {
  const pattern: DicePattern | undefined = options.core
    ? {
        kind: "swirl",
        colours: [...look.core!.colours, look.core!.glitter ?? look.core!.colours[1]],
      }
    : look.pattern;
  const glitter = options.core
    ? look.core!.glitter
      ? { colour: look.core!.glitter, amount: 0.5 }
      : undefined
    : look.glitter;
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(options.core ? "#ffffff" : look.body),
    roughness: options.core ? 0.4 : look.roughness,
    metalness: options.core ? 0 : look.metalness,
    emissive: new THREE.Color(look.glow ?? "#000000"),
    // A pattern keeps its own colours: the glow is only around the numbers.
    emissiveIntensity: look.glow && !look.pattern ? 0.1 : 0,
    flatShading: true,
    transparent: opacity < 1,
    opacity,
  });
  if (!pattern && !glitter) return material;

  const random = seededRng(seed);
  const colours = (pattern?.colours ?? [look.body]).map((colour) => new THREE.Color(colour));
  while (colours.length < 3) colours.push(colours[colours.length - 1]);
  const uniforms = {
    uColours: { value: colours },
    uPattern: { value: pattern ? PATTERN_KINDS[pattern.kind] : -1 },
    uScale: { value: pattern?.scale ?? 1 },
    uOffset: { value: new THREE.Vector3(random(1000) / 10, random(1000) / 10, random(1000) / 10) },
    uTime: { value: 0 },
    uGlitter: { value: new THREE.Color(glitter?.colour ?? "#ffffff") },
    uGlitterAmount: { value: glitter?.amount ?? 0 },
  };
  if (options.core || pattern?.kind === "swirl") {
    animate.push((seconds) => (uniforms.uTime.value = seconds));
  }
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocal = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${NOISE}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>\nif (uPattern >= 0.0) diffuseColor.rgb = gh_pattern(vLocal);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += gh_glitter(vLocal, normal);",
      );
  };
  // Each die's own program, as its uniforms differ.
  material.customProgramCacheKey = () => `gh-dice-${pattern?.kind ?? "plain"}-${glitter ? 1 : 0}`;
  return material;
}

/** A smaller die inside: the liquid core, swirling as it goes. */
export function coreMesh(
  geometry: THREE.BufferGeometry,
  look: DiceLook,
  seed: number,
  animate: Animate[],
  disposables: { dispose: () => void }[],
): THREE.Mesh {
  const material = bodyMaterial(look, 1, seed + 1, animate, { core: true });
  disposables.push(material);
  const core = new THREE.Mesh(geometry, material);
  core.scale.setScalar(0.62);
  return core;
}

/** Little things set inside the die, each a flat picture facing its own way. */
export function inclusionMeshes(
  look: DiceLook,
  seed: number,
  disposables: { dispose: () => void }[],
): THREE.Object3D[] {
  const inclusions = look.inclusions;
  if (!inclusions) return [];
  const random = seededRng(seed + 7);
  const unit = () => random(10_000) / 10_000;
  const textures = inclusions.colours.map((colour) => inclusionTexture(inclusions.kind, colour));
  const geometry = new THREE.PlaneGeometry(1, 1);
  disposables.push(geometry, ...textures);
  const materials = textures.map((map) => {
    const material = new THREE.MeshStandardMaterial({
      map,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      roughness: 0.5,
      metalness: inclusions.kind === "flake" ? 0.8 : 0,
    });
    disposables.push(material);
    return material;
  });
  return Array.from({ length: inclusions.count }, (_, index) => {
    const mesh = new THREE.Mesh(geometry, materials[index % materials.length]);
    // Anywhere inside, well clear of the faces.
    const direction = new THREE.Vector3(unit() - 0.5, unit() - 0.5, unit() - 0.5).normalize();
    mesh.position.copy(direction.multiplyScalar(0.55 * Math.cbrt(unit())));
    mesh.rotation.set(unit() * 6.3, unit() * 6.3, unit() * 6.3);
    mesh.scale.setScalar(inclusions.kind === "bubble" ? 0.12 + 0.12 * unit() : 0.3 + 0.18 * unit());
    return mesh;
  });
}

function inclusionTexture(kind: InclusionKind, colour: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.translate(64, 64);
  context.fillStyle = colour;
  context.strokeStyle = colour;
  if (kind === "leaf") {
    context.beginPath();
    context.moveTo(0, -58);
    context.quadraticCurveTo(46, -10, 0, 58);
    context.quadraticCurveTo(-46, -10, 0, -58);
    context.fill();
    context.strokeStyle = "rgb(0 0 0 / 0.35)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(0, -50);
    context.lineTo(0, 54);
    context.stroke();
  } else if (kind === "flower") {
    for (let petal = 0; petal < 5; petal++) {
      context.rotate((Math.PI * 2) / 5);
      context.beginPath();
      context.ellipse(0, -30, 17, 30, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = "#f6c945";
    context.beginPath();
    context.arc(0, 0, 13, 0, Math.PI * 2);
    context.fill();
  } else if (kind === "star") {
    context.beginPath();
    for (let point = 0; point < 10; point++) {
      const radius = point % 2 ? 24 : 60;
      const angle = (point * Math.PI) / 5 - Math.PI / 2;
      context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    context.fill();
  } else if (kind === "flake") {
    // Gold leaf: a torn, uneven scrap.
    const random = seededRng(colour.length * 31 + 5);
    context.beginPath();
    for (let corner = 0; corner < 9; corner++) {
      const angle = (corner / 9) * Math.PI * 2;
      const radius = 30 + random(30);
      context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    context.fill();
  } else {
    // A bubble: a ring with a glint.
    context.lineWidth = 6;
    context.beginPath();
    context.arc(0, 0, 50, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "rgb(255 255 255 / 0.9)";
    context.beginPath();
    context.arc(-18, -20, 9, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The icon a d20 shows in place of this number, if its look has one. */
export function symbolFor(look: DiceLook, value: number, sides: number): Path2D | undefined {
  if (sides !== 20 || !look.symbols) return undefined;
  const id = value === sides ? look.symbols.high : value === 1 ? look.symbols.low : undefined;
  const path = TOKEN_ICONS.find((icon) => icon.id === id)?.path;
  return path ? new Path2D(path) : undefined;
}
