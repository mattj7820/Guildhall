import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encounter, monster } from "~/combat/test-builders";
import type { TokenAction } from "~/maps/tokens/actions";
import type { Token } from "~/maps/tokens/types";
import { aCharacterToken, aMarker } from "~/maps/tokens/test-builders";
import { DataFileError } from "../data/json-store";
import { MapTokens } from "./map-tokens";

let folder: string;
beforeEach(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "guildhall-tokens-"));
});
afterEach(() => rm(folder, { recursive: true, force: true }));

const everything = () => true;
const pc = aCharacterToken({ id: "pc", map: "world", at: [0.1, 0.1] });
const inn = aMarker({ id: "inn", map: "world" });
const cellar = aMarker({ id: "cellar", map: "keep" });
const place = (token: Token): TokenAction => ({ type: "place", token });

describe("MapTokens", () => {
  it("has no tokens until some are placed", async () => {
    expect(await MapTokens.inFolder(folder).list()).toEqual([]);
  });

  it("keeps tokens in the data folder, so they survive a restart", async () => {
    await MapTokens.inFolder(folder).apply("world", [place(pc), place(inn)], everything);
    expect(await MapTokens.inFolder(folder).onMap("world")).toEqual([pc, inn]);
    const onDisk = JSON.parse(await readFile(path.join(folder, "tokens.json"), "utf8"));
    expect(onDisk).toEqual({ version: 1, tokens: [pc, inn] });
  });

  it("loads a file from before NPC tokens unchanged, and keeps it so through a change", async () => {
    // Exactly as an earlier build wrote it: party members, markers and a monster's token.
    const before = {
      version: 1,
      tokens: [
        { kind: "character", id: "pc", map: "world", at: [0.1, 0.1], note: "Party/One" },
        {
          kind: "marker",
          id: "inn",
          map: "world",
          at: [0.5, 0.5],
          size: 2,
          name: "Inn",
          colour: "blue",
          visibility: "players",
        },
        { kind: "combatant", id: "orc", map: "keep", at: [0.3, 0.3], combatant: "c1" },
      ],
    };
    await writeFile(path.join(folder, "tokens.json"), JSON.stringify(before), "utf8");
    const tokens = MapTokens.inFolder(folder);
    expect(await tokens.list()).toEqual(before.tokens);
    await tokens.apply("world", [{ type: "move", id: "pc", to: [0.2, 0.2] }], everything);
    const onDisk = JSON.parse(await readFile(path.join(folder, "tokens.json"), "utf8"));
    expect(onDisk.tokens.slice(1)).toEqual(before.tokens.slice(1));
  });

  it("answers with the map's tokens, and which maps changed", async () => {
    const tokens = MapTokens.inFolder(folder);
    await tokens.apply("keep", [place(cellar)], everything);
    const result = await tokens.apply(
      "world",
      [place(pc), { type: "move", id: "cellar", to: [0.9, 0.9], map: "world" }],
      everything,
    );
    // In the order they were first placed.
    expect(result.tokens.map((token) => token.id)).toEqual(["cellar", "pc"]);
    expect(result.changed.sort()).toEqual(["keep", "world"]);
    expect(await tokens.onMap("keep")).toEqual([]);
  });

  it("applies only what's allowed, judged against the tokens at that moment", async () => {
    const tokens = MapTokens.inFolder(folder);
    await tokens.apply("world", [place(pc)], everything);
    const onlyExisting = (action: TokenAction, now: readonly { id: string }[]) =>
      action.type === "move" && now.some((token) => token.id === action.id);
    const result = await tokens.apply(
      "world",
      [
        { type: "move", id: "pc", to: [0.5, 0.5] },
        place(inn),
        { type: "move", id: "inn", to: [0.5, 0.5] },
      ],
      onlyExisting,
    );
    expect(result.refused).toBe(2);
    expect(result.tokens).toEqual([{ ...pc, at: [0.5, 0.5] }]);
  });

  it("reports no change for moves of tokens that have gone", async () => {
    const result = await MapTokens.inFolder(folder).apply(
      "world",
      [{ type: "move", id: "gone", to: [0.5, 0.5] }],
      everything,
    );
    expect(result).toEqual({ tokens: [], refused: 0, changed: [] });
  });

  it("applies simultaneous changes one after the other, losing neither", async () => {
    const tokens = MapTokens.inFolder(folder);
    await tokens.apply("world", [place(pc), place(inn)], everything);
    await Promise.all([
      tokens.apply("world", [{ type: "move", id: "pc", to: [0.2, 0.2] }], everything),
      tokens.apply("world", [{ type: "move", id: "inn", to: [0.8, 0.8] }], everything),
    ]);
    expect((await tokens.onMap("world")).map((token) => token.at)).toEqual([
      [0.2, 0.2],
      [0.8, 0.8],
    ]);
  });

  describe("monsters leaving the fight", () => {
    const fight = encounter([monster("Goblin 1"), monster("Ambusher", { hidden: true })]);
    const onMap = (combatant: string, map = "world"): Token => ({
      kind: "combatant",
      id: `t-${combatant}`,
      map,
      at: [0.5, 0.5],
      size: 2,
      combatant,
    });

    it("clears the fight's monsters, and says which maps changed", async () => {
      const tokens = MapTokens.inFolder(folder);
      await tokens.apply("world", [place(onMap("Goblin 1")), place(inn)], everything);
      await tokens.apply("keep", [place(onMap("Ambusher", "keep"))], everything);
      expect((await tokens.removeCombatants(fight.combatants, false)).sort()).toEqual([
        "keep",
        "world",
      ]);
      expect(await tokens.list()).toEqual([inn]);
    });

    it("leaves them where they fell as markers, a hidden one for the DM only", async () => {
      const tokens = MapTokens.inFolder(folder);
      await tokens.apply("world", [place(onMap("Goblin 1")), place(onMap("Ambusher"))], everything);
      await tokens.removeCombatants(fight.combatants, true);
      expect(await tokens.list()).toEqual([
        expect.objectContaining({
          kind: "marker",
          name: "Goblin 1",
          visibility: "players",
          size: 2,
        }),
        expect.objectContaining({ kind: "marker", name: "Ambusher", visibility: "dm" }),
      ]);
    });

    it("leaves tokens of monsters from other fights alone", async () => {
      const tokens = MapTokens.inFolder(folder);
      await tokens.apply("world", [place(onMap("Someone else"))], everything);
      expect(await tokens.removeCombatants(fight.combatants, false)).toEqual([]);
      expect(await tokens.list()).toHaveLength(1);
    });
  });

  it("forgets a deleted map's tokens, leaving others", async () => {
    const tokens = MapTokens.inFolder(folder);
    await tokens.apply("world", [place(pc), place(inn), place(cellar)], everything);
    await tokens.deleteMap("world");
    expect(await tokens.list()).toEqual([cellar]);
  });

  it("refuses to read a damaged file, and never overwrites it", async () => {
    const file = path.join(folder, "tokens.json");
    await writeFile(file, '{"version":1,"tokens":[{"kind":"marker"}]}', "utf8");
    const tokens = MapTokens.inFolder(folder);
    await expect(tokens.list()).rejects.toThrow(DataFileError);
    await expect(tokens.apply("world", [place(pc)], everything)).rejects.toThrow(DataFileError);
    expect(await readFile(file, "utf8")).toBe('{"version":1,"tokens":[{"kind":"marker"}]}');
  });
});
