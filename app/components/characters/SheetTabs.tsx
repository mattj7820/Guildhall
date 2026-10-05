import { useId, useState } from "react";
import { Link } from "react-router";
import type { TextField as TextFieldName } from "~/characters/actions";
import { NOTES_MAX } from "~/characters/schema";
import type { PlayerCharacter } from "~/characters/types";
import type { CharacterPage } from "~/characters/view";
import { ItemIconSvg } from "../inventory/ItemTile";
import { ActionsTab } from "./Actions";
import { FeaturesTab } from "./Features";
import { TextAreaField } from "./Fields";
import { SpellsTab } from "./Spells";
import { sheetPanelClass, TextBlock } from "./SheetParts";
import type { Parts } from "./SheetSections";

export type Tab = "actions" | "spells" | "features" | "notes" | "equipped" | "story";

export function SheetTabs({
  page,
  character,
  parts,
  text,
}: {
  page: CharacterPage;
  character: PlayerCharacter;
  parts: Parts;
  text: (field: TextFieldName) => (value: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("actions");
  const id = useId();
  const tabs: { key: Tab; label: string }[] = [
    { key: "actions", label: "Actions" },
    { key: "spells", label: "Spells" },
    { key: "features", label: "Features" },
    { key: "notes", label: "Notes" },
    { key: "equipped", label: "Equipped" },
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
        {tab === "actions" && <ActionsTab parts={parts} />}
        {tab === "spells" && (
          <SpellsTab
            parts={parts}
            spellNotes={{ catalogue: page.spellCatalogue ?? [], notes: page.spellNotes ?? {} }}
          />
        )}
        {tab === "features" && <FeaturesTab parts={parts} />}
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
        {tab === "notes" &&
          (parts.editing ? (
            <TextAreaField
              label="Notes"
              value={character.sheet.notes}
              maxLength={NOTES_MAX}
              rows={8}
              placeholder="Anything else from the paper sheet"
              onCommit={text("notes")}
            />
          ) : (
            <TextBlock text={character.sheet.notes} empty="No notes yet." />
          ))}
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
