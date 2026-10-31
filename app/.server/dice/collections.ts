import path from "node:path";
import { z } from "zod";
import {
  addDie,
  countOf,
  EMPTY_COLLECTION,
  MOST_OF_A_DIE,
  type DiceCollection,
  type DiceGot,
  type OwnedDie,
} from "~/dice/collection";
import { defaultRng, type Rng } from "~/dice/rng";
import { DIE_TYPES, type DieStyle, type DieType } from "~/dice/styles";
import type { DiscordId } from "~/members/types";
import { newId } from "~/shared/ids";
import { JsonFile } from "../data/json-store";
import { DICE_STYLES, diceStyle } from "./catalogue";
import { drawDie } from "./packs";

/** What's kept of someone's history: plenty for a collection screen, and the file stays small. */
const HISTORY_KEPT = 500;

const sidesSchema = z.literal([...DIE_TYPES]);

/** A list whose damaged entries are dropped, never refusing the file (it's live data). */
function lenientList<T>(item: z.ZodType<T>) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items.flatMap((each) => {
        const parsed = item.safeParse(each);
        return parsed.success ? [parsed.data] : [];
      }),
    );
}

const collectionSchema = z.object({
  discordId: z.string(),
  owned: lenientList(
    z.object({ style: z.string().max(40), sides: sidesSchema, count: z.int().min(1).max(99) }),
  ),
  packs: lenientList(
    z.object({
      id: z.string().min(1),
      givenAt: z.iso.datetime(),
      reason: z.string().max(200).optional().catch(undefined),
    }),
  ),
  favourites: lenientList(z.object({ sides: sidesSchema, style: z.string().max(40) })),
  history: lenientList(
    z.object({
      at: z.iso.datetime(),
      style: z.string().max(40),
      sides: sidesSchema,
      pack: z.string().optional().catch(undefined),
      reason: z.string().max(200).optional().catch(undefined),
    }),
  ),
});
type StoredCollection = z.infer<typeof collectionSchema>;

const fileSchema = z.object({
  version: z.literal(1),
  collections: lenientList(collectionSchema),
});
type DiceFile = z.infer<typeof fileSchema>;

export type OpenedPack =
  | { opened: DiceGot & { count: number; isNew: boolean } }
  /** They already have everything worth having: the pack stays unopened. */
  | { full: true };

/**
 * Everyone's dice collections, kept in `dice.json` in the data folder, beside (not in)
 * `members.json`, so an older Guildhall simply never reads it. A pack's die is drawn here, on the
 * server, with the injected `Rng`, as the pack is opened: nobody can pick their own.
 */
export class DiceCollections {
  constructor(
    private readonly file: JsonFile<DiceFile>,
    private readonly rng: Rng = defaultRng,
    private readonly now: () => Date = () => new Date(),
    private readonly styles: readonly DieStyle[] = DICE_STYLES,
  ) {}

  static inFolder(
    dataPath: string,
    options: { rng?: Rng; now?: () => Date; styles?: readonly DieStyle[] } = {},
  ): DiceCollections {
    return new DiceCollections(
      new JsonFile(path.join(dataPath, "dice.json"), fileSchema, () => ({
        version: 1,
        collections: [],
      })),
      options.rng,
      options.now,
      options.styles,
    );
  }

  /** Someone's collection as stored (empty if they've never had a die). */
  async get(discordId: DiscordId): Promise<DiceCollection> {
    const { collections } = await this.file.read();
    return toCollection(collections.find((each) => each.discordId === discordId));
  }

  /** Everyone's, for the DM. */
  async all(): Promise<Map<DiscordId, DiceCollection>> {
    const { collections } = await this.file.read();
    return new Map(collections.map((each) => [each.discordId, toCollection(each)]));
  }

  /** The DM gives someone a pack, with why. */
  givePack(discordId: DiscordId, reason?: string): Promise<void> {
    const pack = {
      id: newId(),
      givenAt: this.now().toISOString(),
      ...(reason?.trim() && { reason: reason.trim().slice(0, 200) }),
    };
    return this.change(discordId, (collection) => ({
      next: { ...collection, packs: [...collection.packs, pack] },
      result: undefined,
    }));
  }

  /** The DM gives someone a particular die. False if it isn't one, or they have the most of it. */
  giveDie(discordId: DiscordId, style: string, sides: DieType): Promise<boolean> {
    return this.change(discordId, (collection) => {
      if (!this.styles.some((each) => each.id === style))
        return { next: collection, result: false };
      if (countOf(collection.owned, style, sides) >= MOST_OF_A_DIE[sides]) {
        return { next: collection, result: false };
      }
      const got: DiceGot = { at: this.now().toISOString(), style, sides };
      return { next: received(collection, got), result: true };
    });
  }

  /**
   * Opens one of someone's packs, drawing its die. `alsoOwned` counts as owned for the draw (the
   * sets the DM gave before packs). Undefined if the pack isn't theirs or is already open, so two
   * tabs can't open it twice.
   */
  openPack(
    discordId: DiscordId,
    packId: string,
    alsoOwned: readonly OwnedDie[] = [],
  ): Promise<OpenedPack | undefined> {
    return this.change<OpenedPack | undefined>(discordId, (collection) => {
      const pack = collection.packs.find((each) => each.id === packId);
      if (!pack) return { next: collection, result: undefined };
      const owned = [...collection.owned, ...alsoOwned];
      const drawn = drawDie(this.rng, this.styles, owned);
      if (!drawn) return { next: collection, result: { full: true } };
      const got: DiceGot = {
        at: this.now().toISOString(),
        style: drawn.style.id,
        sides: drawn.sides,
        pack: pack.id,
        ...(pack.reason && { reason: pack.reason }),
      };
      const before = countOf(owned, got.style, got.sides);
      const next = received(
        { ...collection, packs: collection.packs.filter((each) => each !== pack) },
        got,
      );
      const count = countOf(next.owned, got.style, got.sides);
      return { next, result: { opened: { ...got, count, isNew: before === 0 } } };
    });
  }

  /** Which style a type rolls in first, or undefined to let their rarest dice go first. */
  chooseFavourite(discordId: DiscordId, sides: DieType, style: string | undefined): Promise<void> {
    return this.change(discordId, (collection) => {
      const others = collection.favourites.filter((each) => each.sides !== sides);
      const favourites = style ? [...others, { sides, style }] : others;
      return { next: { ...collection, favourites }, result: undefined };
    });
  }

  private change<R>(
    discordId: DiscordId,
    change: (collection: DiceCollection) => { next: DiceCollection; result: R },
  ): Promise<R> {
    return this.file.update((data) => {
      const stored = data.collections.find((each) => each.discordId === discordId);
      const { next, result } = change(toCollection(stored));
      const updated: StoredCollection = { discordId, ...next };
      const others = data.collections.filter((each) => each !== stored);
      return { next: { ...data, collections: [...others, updated] }, result };
    });
  }
}

function toCollection(stored: StoredCollection | undefined): DiceCollection {
  if (!stored) return EMPTY_COLLECTION;
  const { owned, packs, favourites, history } = stored;
  return { owned, packs, favourites, history };
}

function received(collection: DiceCollection, got: DiceGot): DiceCollection {
  return {
    ...collection,
    owned: addDie(collection.owned, got.style, got.sides),
    history: [...collection.history, got].slice(-HISTORY_KEPT),
  };
}

/** Every die worth having of every style: the DM's, who has them all. */
export function everyDie(styles: readonly DieStyle[] = DICE_STYLES): OwnedDie[] {
  return styles.flatMap(({ id }) =>
    DIE_TYPES.map((sides) => ({ style: id, sides, count: MOST_OF_A_DIE[sides] })),
  );
}

/**
 * The dice someone may roll: those in their collection, plus a full kit of each set the DM gave
 * before packs (`members.json`'s `dice.given`), which they keep. Styles no longer in the app are
 * left out. The DM has every die.
 */
export function usableDice(
  collection: DiceCollection,
  givenSets: readonly string[] | undefined,
  isDm: boolean,
): OwnedDie[] {
  if (isDm) return everyDie();
  const kits = everyDie().filter((die) => givenSets?.includes(die.style));
  const most = new Map<string, OwnedDie>();
  for (const die of [...collection.owned, ...kits]) {
    if (!diceStyle(die.style)) continue;
    const key = `${die.style} d${die.sides}`;
    if ((most.get(key)?.count ?? 0) < die.count) most.set(key, die);
  }
  return [...most.values()];
}
