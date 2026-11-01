import { expect } from "@playwright/test";
import { AppPage } from "./app-page";

/** Someone's own Settings page: their theme, their wiki and their dice. */
export class Settings extends AppPage {
  open() {
    return this.goto("/settings");
  }

  theme(label: string) {
    return this.page.getByRole("button", { name: label });
  }

  /** The theme the page is shown in, as <html data-theme>; null when following the device. */
  shownIn() {
    return this.page.locator("html").getAttribute("data-theme");
  }

  get diceSwitch() {
    return this.page.getByRole("switch", { name: "Roll with 3D dice" });
  }

  /** Turns 3D dice on or off, and waits until it's saved. */
  async rollWithDice(on: boolean) {
    if ((await this.diceSwitch.getAttribute("aria-checked")) !== String(on)) {
      await this.diceSwitch.click();
    }
    await expect(this.diceSwitch).toHaveAttribute("aria-checked", String(on));
  }

  get diceSoundSwitch() {
    return this.page.getByRole("switch", { name: "Dice sounds" });
  }

  /** The way to their dice collection, saying how many they've found and have to open. */
  get yourDice() {
    return this.page.getByRole("link", { name: /^Your dice/ });
  }

  wikiLook(label: string) {
    return this.page
      .getByRole("region", { name: "Wiki" })
      .getByRole("button", { name: new RegExp(`^${label}`) });
  }

  /** Picks how the wiki looks, and waits until it's saved. */
  async pickWikiLook(label: string) {
    await this.wikiLook(label).click();
    await expect(this.wikiLook(label)).toHaveAttribute("aria-pressed", "true");
  }

  async pick(label: string, value: string) {
    await this.theme(label).click();
    await expect(this.theme(label)).toHaveAttribute("aria-pressed", "true");
    await expect(this.page.locator("html")).toHaveAttribute("data-theme", value);
  }
}
