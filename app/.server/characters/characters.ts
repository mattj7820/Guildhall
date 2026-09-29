import path from "node:path";
import { z } from "zod";
import type { EntityId } from "~/campaign/types";
import { applyActions, type ActionResult, type CharacterAction } from "~/characters/actions";
import { giveItem } from "~/characters/inventory-changes";
import { blankSheet, characterSchema, SHORT_TEXT_MAX } from "~/characters/schema";
import type { Character, CharacterId, HitPoints, ItemId } from "~/characters/types";
import { newId } from "~/shared/ids";
import { JsonFile } from "../data/json-store";

const fileSchema = z.object({
  version: z.literal(1),
  characters: z.array(characterSchema),
});
type CharactersFile = z.infer<typeof fileSchema>;

export type NewCharacter =
  | { kind: "pc"; note: EntityId }
  /** A companion's maximum hit points start as its statblock's. */
  | { kind: "companion"; note: EntityId; maxHp: number };

export type Created = { character: Character } | { problem: string };

export interface Applied {
  character: Character;
  /** One per action, in order (without the character). */
  results: Omit<ActionResult, "character">[];
  /** Someone else changed the character after the revision the sender's actions were based on. */
  changedElsewhere: boolean;
}

export type Gift = { from: Character; to: Character } | { problem: string };

/**
 * Character sheets, companions and their bags, kept in `characters.json` in the data folder.
 * Changes arrive as actions and are applied to what's stored at that moment (see
 * `~/characters/actions.ts`), inside the file's queued update, so nothing is lost between two
 * people. Who may do what is decided by the caller, from the viewer.
 */
export class Characters {
  constructor(
    private readonly file: JsonFile<CharactersFile>,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = newId,
  ) {}

  /** The clock and IDs can be replaced in tests. */
  static inFolder(
    dataPath: string,
    options: { now?: () => Date; createId?: () => string } = {},
  ): Characters {
    return new Characters(
      new JsonFile(path.join(dataPath, "characters.json"), fileSchema, () => ({
        version: 1,
        characters: [],
      })),
      options.now,
      options.createId,
    );
  }

  async list(): Promise<Character[]> {
    return (await this.file.read()).characters;
  }

  async get(id: CharacterId): Promise<Character | undefined> {
    return (await this.file.read()).characters.find((character) => character.id === id);
  }

  async forNote(note: EntityId): Promise<Character | undefined> {
    return (await this.file.read()).characters.find((character) => character.note === note);
  }

  /** One character per note, checked inside the write so two clicks can't make two. */
  create(fields: NewCharacter): Promise<Created> {
    return this.file.update<Created>((data) => {
      if (data.characters.some((character) => character.note === fields.note)) {
        return { next: data, result: { problem: "That character already has a sheet." } };
      }
      const timestamp = this.now().toISOString();
      const base = {
        id: this.createId(),
        note: fields.note,
        revision: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        inventory: { items: [], purse: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 } },
      };
      const character: Character =
        fields.kind === "pc"
          ? { ...base, kind: "pc", sheet: blankSheet() }
          : { ...base, kind: "companion", hp: fullHp(fields.maxHp) };
      return {
        next: { ...data, characters: [...data.characters, character] },
        result: { character },
      };
    });
  }

  /**
   * Applies actions to the stored character. The revision goes up once if anything changed.
   * Undefined if the character has been deleted. A batch that would leave the character invalid
   * (such as a bag over its limit) changes nothing and is reported as a problem.
   */
  apply(
    id: CharacterId,
    actions: readonly CharacterAction[],
    baseRevision: number,
  ): Promise<Applied | { problem: string } | undefined> {
    return this.file.update<Applied | { problem: string } | undefined>((data) => {
      const stored = data.characters.find((character) => character.id === id);
      if (!stored) return { next: data, result: undefined };

      const { character: applied, results } = applyActions(stored, actions);
      const changedElsewhere = stored.revision !== baseRevision;
      if (!results.some((result) => result.outcome === "changed")) {
        return { next: data, result: { character: stored, results, changedElsewhere } };
      }
      const character = this.touched(applied);
      if (!characterSchema.safeParse(character).success) {
        return { next: data, result: { problem: "That change can't be saved." } };
      }
      return {
        next: replace(data, character),
        result: { character, results, changedElsewhere },
      };
    });
  }

  /**
   * Moves some or all of a stack from one character's bag to another's, in one write, so it can
   * never vanish from one bag without reaching the other. Undefined if either character has gone.
   */
  give(
    fromId: CharacterId,
    {
      item,
      amount,
      to: toId,
      givenBy,
    }: { item: ItemId; amount: number; to: CharacterId; givenBy: string },
  ): Promise<Gift | undefined> {
    return this.file.update<Gift | undefined>((data) => {
      const from = data.characters.find((character) => character.id === fromId);
      const to = data.characters.find((character) => character.id === toId);
      if (!from || !to) return { next: data, result: undefined };
      if (from.id === to.id) return { next: data, result: { problem: "That's the same bag." } };

      const transfer = giveItem(from.inventory, to.inventory, {
        id: item,
        amount,
        newId: this.createId(),
        givenBy: givenBy.slice(0, SHORT_TEXT_MAX),
      });
      if (!transfer) {
        return { next: data, result: { problem: "That item isn't there any more." } };
      }
      const gave = this.touched({ ...from, inventory: transfer.from });
      const got = this.touched({ ...to, inventory: transfer.to });
      if (!characterSchema.safeParse(got).success) {
        return { next: data, result: { problem: "Their bag is full." } };
      }
      return { next: replace(replace(data, gave), got), result: { from: gave, to: got } };
    });
  }

  /** Points a character at another note, when its own has gone or was renamed without an `id`. */
  relink(id: CharacterId, note: EntityId): Promise<Created | undefined> {
    return this.file.update<Created | undefined>((data) => {
      const stored = data.characters.find((character) => character.id === id);
      if (!stored) return { next: data, result: undefined };
      if (data.characters.some((character) => character.note === note && character.id !== id)) {
        return { next: data, result: { problem: "That note already has a sheet." } };
      }
      const character = this.touched({ ...stored, note });
      return { next: replace(data, character), result: { character } };
    });
  }

  /** False if there was nothing to delete. */
  delete(id: CharacterId): Promise<boolean> {
    return this.file.update((data) => {
      const characters = data.characters.filter((character) => character.id !== id);
      return characters.length === data.characters.length
        ? { next: data, result: false }
        : { next: { ...data, characters }, result: true };
    });
  }

  private touched<C extends Character>(character: C): C {
    return {
      ...character,
      revision: character.revision + 1,
      updatedAt: this.now().toISOString(),
    };
  }
}

function replace(data: CharactersFile, character: Character): CharactersFile {
  return {
    ...data,
    characters: data.characters.map((existing) =>
      existing.id === character.id ? character : existing,
    ),
  };
}

function fullHp(max: number): HitPoints {
  const value = Math.max(0, Math.round(max));
  return { current: value, max: value, temp: 0 };
}
