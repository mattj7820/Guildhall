// PROTOTYPE (removed before the PR): finding and adding SRD spells and vault spell notes.
import { requireDm } from "~/.server/not-found";
import { renderMarkdown } from "~/.server/vault/render";
import { PLAYER_VIEWER } from "~/campaign/types";
import { canView } from "~/campaign/visibility";
import { servicesContext, viewerContext } from "~/context";
import {
  SpellPickerPrototype,
  type PrototypeSpell,
} from "~/prototype/srd-spells/SpellPickerPrototype";
import sample from "~/prototype/srd-spells/sample.json";
import { noteUrl } from "~/wiki/urls";
import type { Route } from "./+types/spell-picker-prototype";

export function meta() {
  return [{ title: "Spell picker prototype · Guildhall" }];
}

/**
 * What the fixture notes' frontmatter would say under the proposed format (the prototype can't
 * read frontmatter yet). Only some fields, to show that a note fills in what it has.
 */
const EXAMPLE_FRONTMATTER: Record<string, Partial<PrototypeSpell>> = {
  "Fixture Spark": {
    level: 0,
    classes: ["Artificer", "Wizard"],
    castingTime: "1 action",
    range: "60 feet",
    components: "V, S",
    duration: "Instantaneous",
    attack: true,
    roll: "1d6",
    effect: "lightning",
  },
  "Fixture Secret Spell": { level: 2, classes: ["Artificer"] },
};

const asText = (markdown: string) =>
  renderMarkdown(markdown, { role: "player", resolve: () => undefined, canSee: () => false });

export function loader({ context }: Route.LoaderArgs) {
  const viewer = context.get(viewerContext);
  requireDm(viewer);
  const vault = context.get(servicesContext).vault.current;
  const mine = vault
    .notes(viewer)
    .filter((note) => note.type === "spell")
    .map((note): PrototypeSpell => ({
      key: `note/${note.id}`,
      tag: "Mine",
      name: note.title,
      level: undefined,
      classes: [],
      castingTime: "",
      range: "",
      components: "",
      duration: "",
      concentration: false,
      ritual: false,
      attack: false,
      ...EXAMPLE_FRONTMATTER[note.title],
      html: vault.render(note, viewer),
      noteUrl: noteUrl(note.slug),
      hiddenFromPlayers: !canView(PLAYER_VIEWER, note.visibility),
    }));
  const srd = sample.map(
    ({
      version,
      text,
      material,
      higherLevel,
      id: _id,
      school: _school,
      ...spell
    }): PrototypeSpell => ({
      ...spell,
      tag: version === "5.2" ? "2024" : "2014",
      save: spell.save as PrototypeSpell["save"],
      area: spell.area as PrototypeSpell["area"],
      html: [
        asText(text),
        material ? `<p><em>Material:</em> ${escape(material)}</p>` : "",
        higherLevel ? `<h4>At higher levels</h4>${asText(higherLevel)}` : "",
      ].join(""),
      source: version === "5.2" ? "SRD 5.2.1" : "SRD 5.1",
    }),
  );
  return { spells: [...mine, ...srd] };
}

function escape(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function SpellPickerPrototypePage({ loaderData }: Route.ComponentProps) {
  return <SpellPickerPrototype spells={loaderData.spells} />;
}
