import { signed } from "~/characters/abilities";
import { deriveSheet } from "~/characters/derive";
import type { Sheet } from "~/characters/types";
import type { CharacterEditorControls } from "~/characters/useCharacterEditor";
import { defaultRng } from "~/dice/rng";
import { useRollLog } from "~/dice/useRollLog";
import type { Parts } from "./SheetSections";

/**
 * What a sheet's parts need, for the full sheet and the one beside the map alike: the sheet and
 * its numbers, the editor's dispatch, and rolls labelled with the character's name.
 */
export function useSheetParts(
  editor: CharacterEditorControls,
  sheet: Sheet,
  name: string,
  editing: boolean,
): { parts: Parts; rolls: ReturnType<typeof useRollLog> } {
  const rolls = useRollLog(defaultRng);
  const parts: Parts = {
    sheet,
    derived: deriveSheet(sheet),
    editing,
    dispatch: editor.dispatch,
    roll: (label, bonus) =>
      rolls.roll({
        expression: bonus === 0 ? "1d20" : `1d20${signed(bonus)}`,
        kind: "check",
        label: `${name} · ${label}`,
      }),
    rollDice: (request) => rolls.roll({ ...request, label: `${name} · ${request.label}` }),
  };
  return { parts, rolls };
}
