import { expect } from "@playwright/test";
import { AppPage } from "./app-page";

/** The notice board: the next session, the session notes, and the corkboard's cards and string. */
export class Board extends AppPage {
  open() {
    return this.goto("/board");
  }

  get nextSession() {
    return this.page.getByRole("heading", { name: "Next session" }).locator("..");
  }

  get sessions() {
    return this.page.getByRole("region", { name: "Sessions" }).getByRole("link");
  }

  /** A card on the board, by its title (a note's, or a short card's first words). */
  card(name: string | RegExp) {
    return this.page.getByRole("group", { name });
  }

  tool(name: "Pin a note" | "Write a card" | "Tie string") {
    return this.page.getByRole("toolbar", { name: "Board tools" }).getByRole("button", { name });
  }

  async writeCard(text: string) {
    await this.tool("Write a card").click();
    await this.page.getByLabel("Your card").fill(text);
    await this.page.getByRole("button", { name: "Pin it up" }).click();
    await expect(this.card(text)).toBeVisible();
  }

  async pinNote(path: string, caption: string) {
    await this.tool("Pin a note").click();
    await this.page.getByLabel("Note").fill(path);
    await this.page.getByLabel("Caption (optional)").fill(caption);
    await this.page.getByRole("button", { name: "Pin it", exact: true }).click();
  }

  /**
   * A card's own tool (Show players, Take down), by keyboard: cards put up at the same moment by
   * other tests may overlap it.
   */
  async cardTool(card: string | RegExp, name: string) {
    await this.card(card).getByRole("button", { name }).press("Enter");
  }

  /** Ties string from one card to another, with a label, picking the cards by keyboard. */
  async tie(from: string | RegExp, to: string | RegExp, label: string) {
    await this.tool("Tie string").click();
    await this.page.getByLabel("Label (optional)").fill(label);
    await this.card(from).press("Enter");
    await this.card(to).press("Enter");
    await expect(this.stringLabel(label)).toBeVisible();
    await this.tool("Tie string").click();
  }

  stringLabel(label: string) {
    return this.page.getByText(label, { exact: true });
  }
}
