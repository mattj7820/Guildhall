/** How a set of dice looks: what three.js needs to draw them. */
export interface DiceLook {
  body: string;
  ink: string;
  /** A CSS font family for the numbers. */
  font: string;
  metalness: number;
  roughness: number;
  /** Below 1, see-through, like glass or resin. */
  opacity: number;
}
