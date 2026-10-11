import { useState } from "react";
import { Link } from "react-router";
import type { Companion } from "~/characters/types";
import { useCharacterEditor } from "~/characters/useCharacterEditor";
import { CHARACTERS_URL } from "~/characters/urls";
import type { CharacterPage } from "~/characters/view";
import { buttonClass, panelClass } from "../styles";
import { Portrait } from "./Portrait";
import { SheetBag } from "./SheetBag";
import { EditorBar } from "./EditorBar";
import { HitPointsPanel } from "./HitPointsPanel";
import { StatBox } from "./SheetParts";

/**
 * A companion the party shares: its statblock from the vault is its sheet, and Guildhall adds its
 * current hit points and a bag every player can use.
 */
export function CompanionSheet({ page }: { page: CharacterPage }) {
  const editor = useCharacterEditor(page.character);
  const companion = editor.character as Companion;
  const [editing, setEditing] = useState(false);
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <p className="mb-3 text-sm">
        <Link to={CHARACTERS_URL} className="text-muted hover:underline">
          ← Characters
        </Link>
      </p>
      <header className="flex items-center gap-4">
        <Portrait name={page.name} url={page.portraitUrl} size="lg" companion />
        <div>
          <h1 className="font-serif text-3xl font-bold">{page.name}</h1>
          <p className="text-muted">The party&rsquo;s companion</p>
        </div>
      </header>

      <EditorBar editor={editor}>
        <button
          type="button"
          aria-pressed={editing}
          onClick={() => setEditing(!editing)}
          className={buttonClass}
        >
          {editing ? "Done editing" : "Edit hit points"}
        </button>
      </EditorBar>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_2fr]">
        <StatBox label="Armour class">{page.armourClass ?? "—"}</StatBox>
        <StatBox label="Speed">
          <span className="text-lg">{page.speed ?? "—"}</span>
        </StatBox>
        <HitPointsPanel
          hp={companion.hp}
          editing={editing}
          dispatch={editor.dispatch}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {page.statblockHtml && (
        // The statblock is its own labelled region.
        <div className="note-body mt-4" dangerouslySetInnerHTML={{ __html: page.statblockHtml }} />
      )}

      <section aria-labelledby="bag-heading" className={`${panelClass} mt-4`}>
        <h2 id="bag-heading" className="font-serif text-2xl font-bold">
          Bag
        </h2>
        <p className="mb-3 text-sm text-muted">Shared by the whole party.</p>
        <SheetBag editor={editor} page={page} />
      </section>
    </main>
  );
}
