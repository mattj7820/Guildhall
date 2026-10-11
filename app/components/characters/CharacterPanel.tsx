import { useState } from "react";
import { Link } from "react-router";
import { ABILITIES, ABILITY_NAMES, SKILL_NAMES, SKILLS, signed } from "~/characters/abilities";
import type { Companion, PlayerCharacter } from "~/characters/types";
import { characterUrl, portraitUrl } from "~/characters/urls";
import { useCharacterEditor, type CharacterEditorControls } from "~/characters/useCharacterEditor";
import type { CharacterPage } from "~/characters/view";
import type { RollLogControls } from "~/dice/useRollLog";
import { labelClass } from "../styles";
import { ActionsTab } from "./Actions";
import { EditorBar } from "./EditorBar";
import { FeaturesTab } from "./Features";
import { HitPointsPanel } from "./HitPointsPanel";
import { Portrait } from "./Portrait";
import { RestButtons } from "./Rests";
import { SheetBag } from "./SheetBag";
import { subtitle } from "./SheetHeader";
import { DiceChip } from "./SheetLists";
import type { Parts } from "./SheetSections";
import { SpellsTab } from "./Spells";
import { Trackers } from "./Trackers";
import { useSheetParts } from "./useSheetParts";

export type PanelTab = "sheet" | "bag";

/**
 * A character beside the map: what matters mid-session, or their bag. It saves through the same
 * editor as the full sheet (the same actions, undo and merging), with a way through to it.
 */
export function CharacterPanel({ page, tab }: { page: CharacterPage; tab: PanelTab }) {
  const editor = useCharacterEditor(page.character);
  return (
    <div className="flex flex-col gap-3">
      {tab === "bag" ? (
        <SheetBag editor={editor} page={page} />
      ) : editor.character.kind === "pc" ? (
        <CompactSheet page={page} editor={editor} />
      ) : (
        <CompactCompanion page={page} editor={editor} />
      )}
      <EditorBar editor={editor}>
        <Link to={characterUrl(page.character.id)} className="text-sm text-link hover:underline">
          Full {tab === "bag" ? "page" : "sheet"} ↗
        </Link>
      </EditorBar>
    </div>
  );
}

type Part = "actions" | "spells" | "features";

const PARTS: [Part, string][] = [
  ["actions", "Actions"],
  ["spells", "Spells"],
  ["features", "Features"],
];

function CompactSheet({ page, editor }: { page: CharacterPage; editor: CharacterEditorControls }) {
  const { sheet } = editor.character as PlayerCharacter;
  const name = sheet.name.trim() || page.name;
  const { parts, rolls } = useSheetParts(editor, sheet, name, false);
  const [part, setPart] = useState<Part>("actions");
  const portraitPath = sheet.portrait ?? page.notePortrait;
  const { derived } = parts;

  return (
    <>
      <div className="flex items-center gap-3">
        <Portrait
          name={name}
          url={portraitPath ? portraitUrl(page.character.id, portraitPath) : undefined}
        />
        <div className="min-w-0">
          <h2 className="truncate font-serif text-xl font-bold">{name}</h2>
          <p className="truncate text-sm text-muted">{subtitle(sheet)}</p>
        </div>
      </div>
      <HitPointsPanel hp={sheet.hp} editing={false} dispatch={editor.dispatch} />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span>
          AC <strong>{sheet.armourClass}</strong>
        </span>
        <span className="inline-flex items-center gap-1">
          Initiative
          <DiceChip
            label={`Roll Initiative, ${signed(derived.initiative.value)}`}
            onRoll={() => parts.roll("Initiative", derived.initiative.value)}
          >
            {signed(derived.initiative.value)}
          </DiceChip>
        </span>
        <span>
          Speed <strong>{sheet.speed || "—"}</strong>
        </span>
        <span>
          Passive Perception <strong>{derived.passives.perception.value}</strong>
        </span>
      </p>
      <Trackers parts={parts} compact>
        <RestButtons parts={parts} undo={editor.undo} />
      </Trackers>
      <div>
        <div
          role="tablist"
          aria-label="Sheet beside the map"
          className="flex gap-4 border-b border-line text-sm"
        >
          {PARTS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={part === key}
              onClick={() => setPart(key)}
              className={
                part === key
                  ? "-mb-px border-b-2 border-accent pb-1.5 font-semibold"
                  : "pb-1.5 text-muted hover:text-ink"
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel" aria-label={part} className="pt-2">
          {part === "actions" && <ActionsTab parts={parts} compact />}
          {part === "spells" && (
            <SpellsTab
              parts={parts}
              compact
              spellNotes={{ catalogue: page.spellCatalogue ?? [], notes: page.spellNotes ?? {} }}
            />
          )}
          {part === "features" && <FeaturesTab parts={parts} compact />}
        </div>
      </div>
      <Checks parts={parts} />
      <LastRoll rolls={rolls} />
    </>
  );
}

/** Saves and skills to roll, folded away: asked for now and then, not every turn. */
function Checks({ parts }: { parts: Parts }) {
  const { derived, roll } = parts;
  const checks = [
    ...ABILITIES.map(
      (ability) => [`${ABILITY_NAMES[ability]} save`, derived.saves[ability]] as const,
    ),
    ...SKILLS.map((skill) => [SKILL_NAMES[skill], derived.skills[skill]] as const),
  ];
  return (
    <details>
      <summary className={`${labelClass} cursor-pointer`}>Checks &amp; saves</summary>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {checks.map(([label, value]) => (
          <DiceChip
            key={label}
            label={`Roll ${label}, ${signed(value.value)}`}
            onRoll={() => roll(label, value.value)}
          >
            {label} {signed(value.value)}
          </DiceChip>
        ))}
      </div>
    </details>
  );
}

/** The latest roll, where the panel ends: the panel is where the click was. */
function LastRoll({ rolls }: { rolls: RollLogControls }) {
  const latest = rolls.log.rolls[0];
  return (
    <p role="status" aria-label="Latest roll" className="text-sm">
      {latest && (
        <>
          {latest.label}: <strong className="text-lg">{latest.result.total}</strong>{" "}
          <span className="text-xs text-muted">{latest.result.expression}</span>
          {latest.critical && " · Critical!"}
          {latest.result.natural === 20 && " · Natural 20!"}
          {latest.result.natural === 1 && " · Natural 1"}
        </>
      )}
    </p>
  );
}

/** The shared companion: its hit points, and its numbers from the statblock. */
function CompactCompanion({
  page,
  editor,
}: {
  page: CharacterPage;
  editor: CharacterEditorControls;
}) {
  const companion = editor.character as Companion;
  return (
    <>
      <div className="flex items-center gap-3">
        <Portrait name={page.name} url={page.portraitUrl} companion />
        <div className="min-w-0">
          <h2 className="truncate font-serif text-xl font-bold">{page.name}</h2>
          <p className="text-sm text-muted">The party&rsquo;s companion</p>
        </div>
      </div>
      <HitPointsPanel hp={companion.hp} editing={false} dispatch={editor.dispatch} />
      <p className="flex gap-3 text-sm">
        <span>
          AC <strong>{page.armourClass ?? "—"}</strong>
        </span>
        <span>
          Speed <strong>{page.speed ?? "—"}</strong>
        </span>
      </p>
    </>
  );
}
