// PROTOTYPE (removed before the PR): finding and adding SRD monsters among the vault's statblocks.
import { toHtml } from "hast-util-to-html";
import { stringify } from "yaml";
import { requireDm } from "~/.server/not-found";
import { parseStatblock, type Statblock } from "~/.server/vault/statblock/parse-statblock";
import { renderStatblock } from "~/.server/vault/statblock/rehype-statblocks";
import { servicesContext, viewerContext } from "~/context";
import type { PrototypeCreature } from "~/prototype/srd-monsters/SrdPrototype";
import { SrdPrototype } from "~/prototype/srd-monsters/SrdPrototype";
import sample from "~/prototype/srd-monsters/sample.json";
import { noteUrl } from "~/wiki/urls";
import type { Route } from "./+types/srd-monsters-prototype";

export function meta() {
  return [{ title: "SRD monsters prototype · Guildhall" }];
}

export function loader({ context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  requireDm(viewer);
  const vault = context.get(servicesContext).vault.current;
  const mine = vault.statblocks(viewer).map(({ note, statblock }, index) =>
    toCreature(statblock, {
      key: `mine:${index}`,
      source: "mine",
      noteTitle: note.title,
      noteUrl: noteUrl(note.slug),
    }),
  );
  const srd = sample.flatMap((entry) => {
    const parsed = parseStatblock(stringify(entry.statblock));
    if (!parsed.ok) return [];
    return [
      toCreature(parsed.statblock, {
        key: entry.key,
        source: entry.version === "5.2" ? "2024" : "2014",
        initiative: entry.initiative,
        lore: entry.lore,
      }),
    ];
  });
  return { creatures: [...mine, ...srd] };
}

function toCreature(
  statblock: Statblock,
  extra: Pick<PrototypeCreature, "key" | "source"> & Partial<PrototypeCreature>,
): PrototypeCreature {
  const [, size, type] = /^(\w+)\s+(\w+)/.exec(statblock.description ?? "") ?? [];
  return {
    name: statblock.name,
    challenge: statblock.challenge?.split(" ")[0],
    size,
    type: type?.toLowerCase(),
    armorClass: statblock.numbers.armorClass,
    hitPoints: statblock.numbers.hitPoints,
    hitDice: statblock.numbers.hitDice,
    speed: statblock.speed,
    initiative: statblock.numbers.dexterityModifier,
    html: toHtml(renderStatblock(statblock, { rollable: true })),
    ...extra,
  };
}

export default function SrdMonstersPrototypePage({ loaderData }: Route.ComponentProps) {
  return <SrdPrototype creatures={loaderData.creatures} />;
}
