import { useState } from "react";
import { describeChange, type InventoryChange } from "~/characters/inventory-changes";
import type { ItemId } from "~/characters/types";
import type { CharacterEditorControls } from "~/characters/useCharacterEditor";
import type { CharacterPage } from "~/characters/view";
import { Bag } from "../inventory/Bag";
import { UndoToast } from "../inventory/UndoToast";

/**
 * A character's bag, saved as it changes: every change is an action through the sheet's editor,
 * with a toast to undo it. Marking a new item as seen isn't worth an undo step.
 */
export function SheetBag({
  editor,
  page,
}: {
  editor: CharacterEditorControls;
  page: CharacterPage;
}) {
  const [toast, setToast] = useState<{ message?: string; serial: number; undoable: boolean }>({
    serial: 0,
    undoable: true,
  });
  const inventory = editor.character.inventory;
  const show = (message: string, undoable: boolean) =>
    setToast((previous) => ({ message, serial: previous.serial + 1, undoable }));

  async function give(id: ItemId, to: string, amount: number) {
    const item = inventory.items.find((candidate) => candidate.id === id);
    const recipient = page.recipients.find((candidate) => candidate.id === to);
    if (!item || !recipient) return;
    const problem = await editor.give({ item: id, amount, to });
    show(
      problem ?? `Gave ${amount > 1 ? `${amount} ` : ""}${item.name} to ${recipient.name}`,
      false,
    );
  }

  function change(next: InventoryChange) {
    if (next.type === "seen") {
      editor.dispatchWithoutUndo({ type: "inventory", change: next });
      return;
    }
    const message = describeChange(inventory, next);
    editor.dispatch({ type: "inventory", change: next });
    show(message, true);
  }

  return (
    <>
      <Bag
        state={inventory}
        onChange={change}
        catalogue={page.catalogue}
        notes={page.itemNotes}
        recipients={page.recipients}
        onGive={give}
        givingAs={page.givingAs}
      />
      <UndoToast
        message={toast.message}
        serial={toast.serial}
        onUndo={toast.undoable ? editor.undo : undefined}
      />
    </>
  );
}
