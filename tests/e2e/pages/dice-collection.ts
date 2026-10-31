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

  /** A die they've found, by its style and type ("Bone d20"). */
  die(label: string) {
    return this.page.getByRole("listitem", { name: label, exact: true });
  }

  /** Makes a die the first its type rolls with, and waits until it's saved. */
  async rollFirst(label: string) {
    const button = this.die(label).getByRole("button", { name: "Roll these first" });
    await button.click();
    await expect(this.die(label).getByRole("button", { name: "Rolled first" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
}
