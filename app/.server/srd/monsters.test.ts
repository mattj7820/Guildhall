import { toHtml } from "hast-util-to-html";
import { describe, expect, it } from "vitest";
import { statblockFromData, type Statblock } from "~/.server/vault/statblock/parse-statblock";
import { renderStatblock } from "~/.server/vault/statblock/rehype-statblocks";
import srd51 from "./monsters-5.1.json";
import srd52 from "./monsters-5.2.json";

/**
 * Checks over every monster in the committed SRD data, so a converter change or a new release of
 * the source data can't quietly break one. (`npm run srd:check` proves the files match the script.)
 */
describe.each([
  ["SRD 5.1", srd51, 334],
  ["SRD 5.2.1", srd52, 341],
])("%s monsters", (document, data, count) => {
  const parsed = data.monsters.map(({ id, statblock }) => {
    const result = statblockFromData(statblock);
    if (!result.ok) throw new Error(`${id}: ${result.error}`);
    return { id, statblock: result.statblock };
  });

  it("are all there, from the pinned release", () => {
    expect(data.document).toBe(document);
    expect(data.monsters).toHaveLength(count);
  });

  it("have unique IDs", () => {
    expect(new Set(data.monsters.map(({ id }) => id)).size).toBe(count);
  });

  it("all have the numbers the tracker needs", () => {
    const missing = parsed.filter(
      ({ statblock: { numbers, challenge } }) =>
        numbers.armorClass === undefined ||
        numbers.hitPoints === undefined ||
        numbers.hitDice === undefined ||
        numbers.squares === undefined ||
        challenge === undefined,
    );
    expect(missing.map(({ id }) => id)).toEqual([]);
  });

  it("make every attack clickable to roll", () => {
    const unrollable = parsed.flatMap(({ id, statblock }) =>
      attacks(statblock)
        .filter(
          (feature) => !rollableHtml(statblock, feature.name).includes('data-roll-kind="attack"'),
        )
        .map((feature) => `${id}: ${feature.name}`),
    );
    expect(unrollable).toEqual([]);
  });
});

it("gives 2024 monsters their own initiative, which isn't always DEX", () => {
  const differs = srd52.monsters.filter(({ statblock }) => {
    const parsed = statblockFromData(statblock);
    if (!parsed.ok || !parsed.statblock.abilities) return false;
    return (
      parsed.statblock.numbers.initiative !==
      Math.floor((parsed.statblock.abilities[1].score - 10) / 2)
    );
  });
  expect(srd52.monsters.every(({ statblock }) => "initiative" in statblock)).toBe(true);
  expect(differs.length).toBeGreaterThan(0);
});

const ATTACK = /to hit|Attack Roll: [+−-]\d/;

function attacks(statblock: Statblock) {
  return [...statblock.actions, ...statblock.bonusActions, ...statblock.reactions].filter(
    (feature) => ATTACK.test(feature.description),
  );
}

/** The rendered paragraph for one feature. */
function rollableHtml(statblock: Statblock, name: string | undefined): string {
  const only = attacks(statblock).filter((feature) => feature.name === name);
  return toHtml(
    renderStatblock(
      {
        ...statblock,
        traits: [],
        actions: only,
        bonusActions: [],
        reactions: [],
        legendaryActions: [],
      },
      { rollable: true },
    ),
  );
}
