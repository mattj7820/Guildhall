import { Link } from "react-router";
import type { Companion } from "~/characters/types";
import { CHARACTERS_URL } from "~/characters/urls";
import type { CharacterPage } from "~/characters/view";
import { Portrait } from "./Portrait";
import { HitPointsView, SheetPanel, StatBox } from "./SheetParts";

/**
 * A companion the party shares: its statblock from the vault is its sheet, and Guildhall adds its
 * current hit points and a bag every player can use.
 */
export function CompanionSheet({ page }: { page: CharacterPage }) {
  const companion = page.character as Companion;
  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <p className="mb-3 text-sm">
        <Link to={CHARACTERS_URL} className="text-stone-600 hover:underline dark:text-stone-400">
          ← Characters
        </Link>
      </p>
      <header className="flex items-center gap-4">
        <Portrait name={page.name} url={page.portraitUrl} size="lg" companion />
        <div>
          <h1 className="font-serif text-3xl font-bold">{page.name}</h1>
          <p className="text-stone-600 dark:text-stone-400">The party&rsquo;s companion</p>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_2fr]">
        <StatBox label="Armour class">{page.armourClass ?? "—"}</StatBox>
        <StatBox label="Speed">
          <span className="text-lg">{page.speed ?? "—"}</span>
        </StatBox>
        <SheetPanel title="Hit points" className="col-span-2 sm:col-span-1">
          <HitPointsView hp={companion.hp} />
        </SheetPanel>
      </div>

      {page.statblockHtml && (
        // The statblock is its own labelled region.
        <div className="note-body mt-4" dangerouslySetInnerHTML={{ __html: page.statblockHtml }} />
      )}
    </main>
  );
}
