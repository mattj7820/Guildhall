import { useState } from "react";
import { data, Form, Link, useRevalidator } from "react-router";
import { z } from "zod";
import { DataFileError } from "~/.server/data/json-store";
import { diceStyle } from "~/.server/dice/catalogue";
import { usableDice } from "~/.server/dice/collections";
import { collectionView } from "~/.server/dice/view";
import { notFound } from "~/.server/not-found";
import { DiePicture } from "~/components/dice/DiePicture";
import { PackOpening } from "~/components/dice/PackOpening";
import { TryDice } from "~/components/dice/TryDice";
import { panelClass, primaryButtonClass } from "~/components/styles";
import { accountContext, servicesContext } from "~/context";
import type { CollectionView, DicePack, OwnedDieView } from "~/dice/collection";
import { DIE_TYPES, RARITIES, RARITY_INFO, type DieType } from "~/dice/styles";
import type { Route } from "./+types/settings-dice";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Your dice · Guildhall" }];
}

/** Each member's own dice: what they've found, which they roll first, and packs to open. */
export async function loader({ context }: Route.LoaderArgs) {
  const account = context.get(accountContext);
  if (account.kind !== "member") notFound();
  const { dice } = context.get(servicesContext);
  try {
    const collection = await dice.get(account.member.discordId);
    return { ...collectionView(collection, account.member, account.isDm), error: undefined };
  } catch (error) {
    if (!(error instanceof DataFileError)) throw error;
    const nothing: CollectionView = { isDm: account.isDm, owned: [], favourites: {}, packs: [] };
    return { ...nothing, error: error.message };
  }
}

const favouriteSchema = z.object({
  sides: z.coerce.number().pipe(z.literal([...DIE_TYPES])),
  // Empty: no favourite, so their rarest go first.
  style: z.string().max(40),
});

export async function action({ request, context }: Route.ActionArgs) {
  const account = context.get(accountContext);
  if (account.kind !== "member") notFound();
  const parsed = favouriteSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return data({ error: "That isn't one of the choices." }, 400);
  const { sides, style } = parsed.data;
  const { dice } = context.get(servicesContext);
  const { discordId } = account.member;
  if (style) {
    const usable = usableDice(await dice.get(discordId), account.member.dice?.given, account.isDm);
    const owns = usable.some((die) => die.style === style && die.sides === sides);
    if (!diceStyle(style) || !owns) return data({ error: "You haven't found that die." }, 400);
  }
  await dice.chooseFavourite(discordId, sides, style || undefined);
  return { ok: true };
}

export default function SettingsDice({ loaderData, actionData }: Route.ComponentProps) {
  const { isDm, owned, favourites, packs, error } = loaderData;
  const total = owned.reduce((sum, die) => sum + die.count, 0);
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <div>
        <Link to="/settings" className="text-link text-sm">
          ← Settings
        </Link>
        <h1 className="font-display text-title text-4xl">Your dice</h1>
        <p className="text-muted mt-1">
          {isDm
            ? "As the DM, you have every die. Players find theirs in the packs you give them."
            : "Every die you've found. Rolling several of one type picks up your favourite first, then your others of that type, rarest first; past those, the theme's dice."}
        </p>
      </div>
      {(error || (actionData && "error" in actionData)) && (
        <p role="alert" className="bg-danger-surface text-danger rounded-md px-3 py-2 text-sm">
          {error ?? (actionData && "error" in actionData ? actionData.error : undefined)}
        </p>
      )}
      {!isDm && <Packs packs={packs} />}
      <section aria-labelledby="collection-heading" className="flex flex-col gap-4">
        <h2 id="collection-heading" className="font-display text-title text-2xl">
          Collection ({total === 1 ? "1 die" : `${total} dice`})
        </h2>
        {owned.length === 0 && (
          <p className="text-muted">
            None yet: you roll with the theme&rsquo;s dice. The DM gives packs for things worth
            inspiration.
          </p>
        )}
        {DIE_TYPES.map((sides) => (
          <DieType
            key={sides}
            sides={sides}
            dice={owned.filter((die) => die.sides === sides)}
            favourite={favourites[sides]}
          />
        ))}
      </section>
      {!isDm && <Odds />}
    </main>
  );
}

/** Packs waiting to be opened, with why the DM gave them: each opened by its own click. */
function Packs({ packs }: { packs: DicePack[] }) {
  const [opening, setOpening] = useState<DicePack>();
  const revalidator = useRevalidator();
  return (
    <section aria-labelledby="packs-heading" className="flex flex-col gap-3">
      <h2 id="packs-heading" className="font-display text-title text-2xl">
        Packs to open ({packs.length})
      </h2>
      {packs.length === 0 ? (
        <p className="text-muted">No packs right now.</p>
      ) : (
        <ul aria-label="Packs to open" className="flex flex-wrap gap-3">
          {packs.map((pack) => (
            <li key={pack.id} aria-label="A pack" className={`${panelClass} flex flex-col gap-1`}>
              <span className="text-title font-semibold">A dice pack</span>
              {pack.reason && <span className="text-muted text-sm">{pack.reason}</span>}
              <button
                type="button"
                className={`${primaryButtonClass} mt-1 self-start`}
                onClick={() => setOpening(pack)}
              >
                Open
              </button>
            </li>
          ))}
        </ul>
      )}
      {opening && (
        <PackOpening
          pack={opening}
          onDone={() => {
            setOpening(undefined);
            void revalidator.revalidate();
          }}
        />
      )}
    </section>
  );
}

/** One type's dice, each with a button to roll it first. */
function DieType({
  sides,
  dice,
  favourite,
}: {
  sides: DieType;
  dice: OwnedDieView[];
  favourite: string | undefined;
}) {
  if (dice.length === 0) return null;
  return (
    <section aria-label={`d${sides}`} className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3">
        <h3 className="font-display text-title text-xl">d{sides}</h3>
        <TryDice sides={sides} />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dice.map((die) => (
          <DieCard key={die.style.id} die={die} favourite={die.style.id === favourite} />
        ))}
      </ul>
    </section>
  );
}

function DieCard({ die, favourite }: { die: OwnedDieView; favourite: boolean }) {
  const { style, sides, count } = die;
  const rarity = RARITY_INFO[style.rarity];
  return (
    <li
      aria-label={`${style.label} d${sides}`}
      className={`gh-card bg-surface flex gap-3 rounded-lg border p-3 ${favourite ? "border-accent ring-accent ring-2" : "border-line"}`}
    >
      <DiePicture sides={sides} style={style} />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-title font-semibold">
          {style.label}
          {count > 1 && <span className="text-muted font-normal"> ×{count}</span>}
        </span>
        <span className="text-xs font-semibold" style={{ color: rarity.colour }}>
          {rarity.label}
        </span>
        <span className="text-muted text-sm">{style.description}</span>
        <Form method="post">
          <input type="hidden" name="sides" value={sides} />
          <button
            type="submit"
            name="style"
            value={favourite ? "" : style.id}
            aria-pressed={favourite}
            className="text-link text-sm font-semibold"
          >
            {favourite ? "Rolled first" : "Roll these first"}
          </button>
        </Form>
      </div>
    </li>
  );
}

/** What a pack can hold: the same odds for everyone, shown so nobody has to guess. */
function Odds() {
  return (
    <section aria-labelledby="odds-heading" className="flex flex-col gap-2">
      <h2 id="odds-heading" className="font-display text-title text-xl">
        What&rsquo;s in a pack
      </h2>
      <p className="text-muted text-sm">
        One die of any type. A die you already have as many of as a roll could use is never in a
        pack.
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {RARITIES.map((rarity) => (
          <li key={rarity}>
            <span className="font-semibold" style={{ color: RARITY_INFO[rarity].colour }}>
              {RARITY_INFO[rarity].label}
            </span>{" "}
            {RARITY_INFO[rarity].odds}%
          </li>
        ))}
      </ul>
    </section>
  );
}
