import { useId, useState } from "react";
import { Link } from "react-router";
import {
  ABILITIES,
  ABILITY_NAMES,
  PASSIVE_SKILLS,
  signed,
  SKILL_ABILITIES,
  SKILL_NAMES,
  SKILLS,
} from "~/characters/abilities";
import { deriveSheet } from "~/characters/derive";
import type { PlayerCharacter } from "~/characters/types";
import { CHARACTERS_URL } from "~/characters/urls";
import type { CharacterPage } from "~/characters/view";
import { ItemIconSvg } from "../inventory/ItemTile";
import { Portrait } from "./Portrait";
import {
  Bonus,
  HitPointsView,
  ProficiencyMark,
  SheetPanel,
  sheetPanelClass,
  StatBox,
  TextBlock,
} from "./SheetParts";

/**
 * A player character's sheet, laid out like the paper one: abilities across the top, then saves
 * and senses, skills, and combat numbers with tabs for everything else.
 */
export function CharacterSheet({ page }: { page: CharacterPage }) {
  const character = page.character as PlayerCharacter;
  const sheet = character.sheet;
  const derived = deriveSheet(sheet);
  const subtitle = [
    sheet.species,
    sheet.className && `${sheet.className} ${sheet.level}`,
    sheet.background,
  ].filter(Boolean);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <p className="mb-3 text-sm">
        <Link to={CHARACTERS_URL} className="text-stone-600 hover:underline dark:text-stone-400">
          ← Characters
        </Link>
      </p>

      <header className="flex flex-wrap items-center gap-4">
        <Portrait name={page.name} url={page.portraitUrl} size="lg" />
        <div className="mr-auto min-w-0">
          <h1 className="font-serif text-3xl font-bold">{page.name}</h1>
          <p className="text-stone-600 dark:text-stone-400">
            {subtitle.length > 0 ? subtitle.join(" · ") : `Level ${sheet.level}`}
          </p>
        </div>
        <p
          className={`rounded-full px-3 py-1 text-sm ${sheet.heroicInspiration ? "bg-amber-100 font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200" : "text-stone-500"}`}
        >
          {sheet.heroicInspiration ? "★ Heroic inspiration" : "No heroic inspiration"}
        </p>
      </header>

      <section aria-label="Ability scores" className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITIES.map((ability) => (
          <div
            key={ability}
            className={`${sheetPanelClass} flex flex-col items-center py-2 text-center`}
          >
            <abbr
              title={ABILITY_NAMES[ability]}
              className="text-xs font-semibold tracking-wide text-stone-500 uppercase no-underline"
            >
              {ability}
            </abbr>
            <span className="text-3xl font-bold tabular-nums">
              {signed(derived.modifiers[ability])}
            </span>
            <span className="rounded-full border border-stone-300 px-2 text-sm tabular-nums dark:border-stone-700">
              {sheet.abilities[ability]}
            </span>
          </div>
        ))}
      </section>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-[repeat(4,minmax(0,1fr))_2fr]">
        <StatBox label="Proficiency">{signed(sheet.proficiencyBonus)}</StatBox>
        <StatBox label="Initiative">
          <Bonus value={derived.initiative} />
        </StatBox>
        <StatBox label="Armour class">{sheet.armourClass}</StatBox>
        <StatBox label="Speed">
          <span className="text-lg">{sheet.speed || "—"}</span>
        </StatBox>
        <SheetPanel title="Hit points" className="col-span-2 sm:col-span-4 lg:col-span-1">
          <HitPointsView hp={sheet.hp} />
        </SheetPanel>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-3">
          <SheetPanel title="Saving throws">
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
              {ABILITIES.map((ability) => (
                <li key={ability} className="flex items-center gap-2 text-sm">
                  <ProficiencyMark proficiency={sheet.saves[ability]} />
                  <span className="mr-auto">{ABILITY_NAMES[ability]}</span>
                  <Bonus value={derived.saves[ability]} className="font-semibold" />
                </li>
              ))}
            </ul>
          </SheetPanel>
          <SheetPanel title="Passive senses">
            <ul className="space-y-1 text-sm">
              {PASSIVE_SKILLS.map((skill) => (
                <li key={skill} className="flex justify-between">
                  <span>Passive {SKILL_NAMES[skill]}</span>
                  <span className="font-semibold tabular-nums">
                    {derived.passives[skill].value}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2">
              <TextBlock text={sheet.senses} empty="No other senses" />
            </div>
          </SheetPanel>
          <SheetPanel title="Proficiencies">
            <TextBlock text={sheet.proficiencies} />
          </SheetPanel>
          <SheetPanel title="Languages">
            <TextBlock text={sheet.languages} />
          </SheetPanel>
        </div>

        <SheetPanel title="Skills">
          <ul className="space-y-1">
            {SKILLS.map((skill) => (
              <li key={skill} className="flex items-center gap-2 text-sm">
                <ProficiencyMark proficiency={sheet.skills[skill]} />
                <span className="mr-auto">
                  {SKILL_NAMES[skill]}{" "}
                  <span className="text-xs text-stone-400 uppercase">{SKILL_ABILITIES[skill]}</span>
                </span>
                <Bonus value={derived.skills[skill]} className="font-semibold" />
              </li>
            ))}
          </ul>
        </SheetPanel>

        <div className="space-y-3 md:col-span-2 xl:col-span-1">
          <SheetPanel title="Defences">
            <TextBlock text={sheet.defences} />
          </SheetPanel>
          <SheetPanel title="Conditions">
            <TextBlock text={sheet.conditions} empty="None" />
          </SheetPanel>
          <SheetTabs page={page} />
        </div>
      </div>
    </main>
  );
}

type Tab = "equipped" | "notes" | "story";

function SheetTabs({ page }: { page: CharacterPage }) {
  const character = page.character as PlayerCharacter;
  const [tab, setTab] = useState<Tab>("equipped");
  const id = useId();
  const tabs: { key: Tab; label: string }[] = [
    { key: "equipped", label: "Equipped" },
    { key: "notes", label: "Features & notes" },
    { key: "story", label: "Story" },
  ];
  const equipped = character.inventory.items.filter((item) => item.equipped);

  return (
    <section aria-label="More" className={sheetPanelClass}>
      <div
        role="tablist"
        aria-label="More"
        className="flex gap-4 border-b border-stone-200 text-sm dark:border-stone-700"
      >
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${id}-${key}-tab`}
            aria-selected={tab === key}
            aria-controls={`${id}-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={(event) => {
              const at = tabs.findIndex((candidate) => candidate.key === tab);
              const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
              if (!step) return;
              const next = tabs[(at + step + tabs.length) % tabs.length].key;
              setTab(next);
              document.getElementById(`${id}-${next}-tab`)?.focus();
            }}
            className={
              tab === key
                ? "-mb-px border-b-2 border-amber-600 pb-2 font-semibold"
                : "pb-2 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-${tab}`}
        aria-labelledby={`${id}-${tab}-tab`}
        tabIndex={0}
        className="pt-3"
      >
        {tab === "equipped" &&
          (equipped.length > 0 ? (
            <ul className="space-y-1.5">
              {equipped.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-sm">
                  <ItemIconSvg
                    icon={item.icon}
                    className="h-5 w-5 text-stone-600 dark:text-stone-300"
                  />
                  <span>{item.name}</span>
                  {item.attuned && (
                    <span className="text-xs text-amber-700 dark:text-amber-400">attuned</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">Nothing equipped.</p>
          ))}
        {tab === "notes" && <TextBlock text={character.sheet.notes} empty="No notes yet." />}
        {tab === "story" &&
          (page.story ? (
            <>
              <div
                className="note-body prose prose-stone prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: page.story.html }}
              />
              <Link
                to={page.story.url}
                className="mt-2 inline-block text-sm text-amber-800 hover:underline dark:text-amber-400"
              >
                Open {page.story.title} in the wiki
              </Link>
            </>
          ) : (
            <p className="text-sm text-stone-500">The story isn&rsquo;t shared yet.</p>
          ))}
      </div>
    </section>
  );
}
