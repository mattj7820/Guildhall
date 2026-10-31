import { describe, expect, it } from "vitest";
import { MOST_OF_A_DIE, type OwnedDie } from "~/dice/collection";
import { seededRng, sequenceRng } from "~/dice/rng";
import { DIE_TYPES, RARITIES, type DieStyle, type Rarity } from "~/dice/styles";
import { drawDie } from "./packs";

const style = (id: string, rarity: Rarity): DieStyle => ({
  id,
  label: id,
  description: "Fixture: a style for tests",
  rarity,
  look: { body: "#000000", ink: "#ffffff", metalness: 0, roughness: 1, opacity: 1 },
  voice: { pitch: 1, ring: 0, ringPitch: 1, ringFor: 0, knockFor: 0.05 },
});
const STYLES = RARITIES.map((rarity) => style(rarity, rarity));
const all = (id: string): OwnedDie[] =>
  DIE_TYPES.map((sides) => ({ style: id, sides, count: MOST_OF_A_DIE[sides] }));

describe("drawDie", () => {
  it("draws the rarity by its odds out of 100, then a die of it", () => {
    // 50 is the last common ticket, 51 the first uncommon, 100 the legendary one.
    expect(drawDie(sequenceRng([50, 1]), STYLES, [])).toMatchObject({ style: { id: "common" } });
    expect(drawDie(sequenceRng([51, 1]), STYLES, [])).toMatchObject({ style: { id: "uncommon" } });
    expect(drawDie(sequenceRng([100, 6]), STYLES, [])).toEqual({ style: STYLES[4], sides: 20 });
  });

  it("comes out near the odds over many packs", () => {
    const rng = seededRng(7);
    const counts = Object.fromEntries(RARITIES.map((rarity) => [rarity, 0]));
    for (let pack = 0; pack < 20_000; pack++) counts[drawDie(rng, STYLES, [])!.style.rarity]++;
    expect(counts.common / 20_000).toBeCloseTo(0.5, 1);
    expect(counts.uncommon / 20_000).toBeCloseTo(0.3, 1);
    expect(counts.legendary).toBeGreaterThan(250);
    expect(counts.legendary).toBeLessThan(550);
  });

  it("never draws a die they have the most worth having of", () => {
    const owned: OwnedDie[] = [{ style: "legendary", sides: 20, count: 3 }];
    for (let sides = 1; sides <= 5; sides++) {
      expect(drawDie(sequenceRng([100, sides]), STYLES, owned)?.sides).not.toBe(20);
    }
  });

  it("shares out a rarity's odds once it has nothing left to give", () => {
    const owned = all("common");
    // Without commons, the 50 tickets left go to the other rarities: 30 of them are uncommon.
    expect(drawDie(sequenceRng([30, 1]), STYLES, owned)?.style.id).toBe("uncommon");
    expect(drawDie(sequenceRng([31, 1]), STYLES, owned)?.style.id).toBe("rare");
  });

  it("draws nothing once they have everything", () => {
    expect(
      drawDie(
        sequenceRng([]),
        STYLES,
        STYLES.flatMap(({ id }) => all(id)),
      ),
    ).toBeUndefined();
  });
});
