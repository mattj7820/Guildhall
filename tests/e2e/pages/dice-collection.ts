import { expect } from "@playwright/test";
import { AppPage } from "./app-page";

/** Someone's own dice (Settings → Your dice): what they've found, and packs to open. */
export class DiceCollection extends AppPage {
  open() {
    return this.goto("/settings/dice");
  }

  get collection() {
    return this.page.getByRole("heading", { name: /^Collection/ });
  }

  get packs() {
    return this.page.getByRole("list", { name: "Packs to open" }).getByRole("listitem");
  }

  /**
   * Opens the first pack and waits for the die (at once: tests ask for reduced motion). Returns
   * what it says, such as "New!".
   */
  async openPack() {
    await this.packs.first().getByRole("button", { name: "Open" }).click();
    const opening = this.page.getByRole("dialog", { name: "Opening a pack" });
    await expect(opening.getByRole("button", { name: "Done" })).toBeFocused();
    return opening;
  }

  /** A type's slot, which shows the die it rolls first ("d20 Bone"). */
  type(sides: number) {
    return this.page.getByRole("tab", { name: new RegExp(`^d${sides} `) });
  }

  /** Shows one type's dice. */
  async showType(sides: number) {
    await this.type(sides).click();
    await expect(this.type(sides)).toHaveAttribute("aria-selected", "true");
  }

  /** The type shown: its dice, by rarity. */
  get shown() {
    return this.page.getByRole("tabpanel");
  }

  /** A die of the type shown, by its style and type ("Bone d20"); pressed when rolled first. */
  die(label: string) {
    return this.shown.getByRole("button", { name: label, exact: true });
  }

  /** Makes a die (of the type shown) the first its type rolls with, and waits until it's saved. */
  async rollFirst(label: string) {
    await this.die(label).click();
    await expect(this.shown.getByRole("button", { name: "Rarest first instead" })).toBeVisible();
    await expect(this.die(label)).toHaveAttribute("aria-pressed", "true");
  }
}
