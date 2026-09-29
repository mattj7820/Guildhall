import { useState } from "react";
import { describeChange, type InventoryChange } from "~/characters/inventory-changes";
import type { ItemId } from "~/characters/types";
import type { CharacterEditorControls } from "~/characters/useCharacterEditor";
import type { CharacterPage } from "~/characters/view";
import { Bag } from "../inventory/Bag";
import type { Recipient } from "../inventory/InventoryBoard";
import { UndoToast } from "../inventory/UndoToast";

/**
 * A character's bag, saved as it changes: every change is an action through the sheet's editor,
 * with a toast to undo it. Marking a new item as seen isn't worth an undo step.
 */
export function SheetBag({
  editor,
  page,
  recipients,
  onGive,
}: {
  editor: CharacterEditorControls;
  page: CharacterPage;
  recipients?: Recipient[];
  onGive?: (id: ItemId, to: string, amount: number) => void;
}) {
  const [toast, setToast] = useState<{ message?: string; serial: number }>({ serial: 0 });
  const inventory = editor.character.inventory;

  function change(next: InventoryChange) {
    if (next.type === "seen") {
      editor.dispatchWithoutUndo({ type: "inventory", change: next });
      return;
    }
    const message = describeChange(inventory, next);
    editor.dispatch({ type: "inventory", change: next });
    setToast((previous) => ({ message, serial: previous.serial + 1 }));
  }

  return (
    <>
      <Bag
        state={inventory}
        onChange={change}
        catalogue={page.catalogue}
        notes={page.itemNotes}
        recipients={recipients}
        onGive={onGive}
      />
      <UndoToast message={toast.message} serial={toast.serial} onUndo={editor.undo} />
    </>
  );
}
