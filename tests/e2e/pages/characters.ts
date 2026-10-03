import { expect, type Locator, type Page } from "@playwright/test";
import { AppPage, dragBetween, middleOf } from "./app-page";

/** The Characters page: the party's cards. */
export class Characters extends AppPage {
  open() {
    return this.goto("/characters");
  }

  card(name: string) {
    return this.page.getByRole("article", { name, exact: true });
  }

  /** The bag on the page that's open. */
  get bag() {
    return new Bag(this.page);
  }

  /**
   * Opens a character's sheet from the Characters page, starting it first if no test has yet.
   * Tests share one server, and starting a sheet that exists just opens it, so any test may be
   * first.
   */
  async openSheet(name: string) {
    await this.open();
    const card = this.card(name);
    await card
      .getByRole("link", { name: new RegExp(`^Open .* for ${name}$`) })
      .or(card.getByRole("button", { name: new RegExp(`^(Start sheet|Set up) for ${name}$`) }))
      .click();
    await expect(this.page).toHaveURL(/\/characters\/\w+$/);
    await expect(this.page.getByRole("heading", { level: 1, name })).toBeVisible();
    return new CharacterSheet(this.page);
  }

  /** Opens a player character's bag, which is behind a tab on their sheet. */
  async openBag(name: string) {
    return (await this.openSheet(name)).openBag();
  }

  /** Opens the shared companion's page, where its bag is shown straight away. */
  async openCompanionBag(name: string) {
    await this.openSheet(name);
    const bag = new Bag(this.page);
    await expect(bag.grid).toBeVisible();
    return bag;
  }
}

/** A character's page: a sheet (or a companion), edited in place and saved as it changes. */
export class CharacterSheet extends AppPage {
  get notices() {
    return this.page.getByRole("list", { name: "Notices" });
  }

  get hitPoints() {
    return this.page.getByRole("region", { name: "Hit points" });
  }

  get latestRoll() {
    return this.page.getByRole("status", { name: "Latest roll" });
  }

  /** Waits until every change has reached the server. */
  async saved() {
    await expect(this.page.getByText("✓ All changes saved")).toBeVisible();
  }

  async edit() {
    await this.page.getByRole("button", { name: "Edit sheet" }).click();
    await expect(this.page.getByRole("button", { name: "Done editing" })).toBeVisible();
  }

  async doneEditing() {
    await this.page.getByRole("button", { name: "Done editing" }).click();
  }

  field(label: string) {
    return this.page.getByLabel(label, { exact: true });
  }

  async setNumber(label: string, value: number) {
    const field = this.field(label);
    await field.fill(String(value));
    await field.press("Enter");
  }

  /** Heals or damages by an amount, from the hit points panel. */
  async changeHitPoints(action: "Heal" | "Damage", amount: number) {
    await this.page.getByLabel("Amount of healing or damage").fill(String(amount));
    await this.page.getByRole("button", { name: action }).click();
  }

  async undo() {
    await this.page.getByRole("button", { name: "Undo" }).click();
  }

  async openBag() {
    const bag = new Bag(this.page);
    await this.page.getByRole("button", { name: /^Bag/ }).click();
    await expect(bag.grid).toBeVisible();
    return bag;
  }
}

/**
 * A bag: the grid of item tiles, quick add, and dragging by mouse or keyboard. Tiles are found
 * by their accessible name, e.g. "Rope, 3, equipped". Tests share the party's bags, so they use
 * uniquely named items and never look at the whole bag.
 */
export class Bag {
  constructor(readonly page: Page) {}

  get grid() {
    return this.page.getByRole("list", { name: "Inventory" });
  }

  get equipped() {
    return this.page.getByRole("region", { name: "Equipped" });
  }

  /** A tile by its accessible name: exactly, unless given a pattern. */
  tile(name: string | RegExp) {
    return this.grid.getByRole("button", { name, exact: typeof name === "string" });
  }

  details(name: string) {
    return this.page.getByRole("dialog", { name });
  }

  async saved() {
    await expect(this.page.getByText("✓ All changes saved")).toBeVisible();
  }

  /** What the screen reader was last told, e.g. while dragging by keyboard. */
  announced(text: string) {
    return this.page.getByRole("status").filter({ hasText: text });
  }

  /** Types into quick add and presses Enter for each, which picks the first suggestion. */
  async quickAdd(...texts: string[]) {
    await this.page.getByRole("button", { name: "+ Add item" }).click();
    const box = this.page.getByRole("combobox", { name: "Add item" });
    for (const text of texts) {
      await box.fill(text);
      await box.press("Enter");
      await expect(box).toHaveValue("");
    }
    await this.page.getByRole("button", { name: "Done" }).click();
  }

  /** The DM's quick add: types and picks the suggestion matching `suggestion`, then saves. */
  async give(text: string, suggestion: RegExp) {
    await this.page.getByRole("button", { name: "+ Give item" }).click();
    await this.page.getByRole("combobox", { name: "Give item" }).fill(text);
    await this.page.getByRole("option", { name: suggestion }).click();
    await this.page.getByRole("button", { name: "Done" }).click();
    await this.saved();
  }

  /** Splits `amount` off a stack from its details. */
  async split(stack: Locator, name: string, amount?: number) {
    await stack.press("s");
    const details = this.details(name);
    if (amount !== undefined) {
      await details.getByRole("spinbutton", { name: "Split off" }).fill(String(amount));
    }
    await details.getByRole("button", { name: "Split", exact: true }).click();
    await expect(details).toHaveCount(0);
  }

  /** The names of these items, in the order the bag shows them. */
  async order(names: string[]) {
    const labels = await this.grid
      .getByRole("button")
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") ?? ""));
    return labels
      .map((label) => names.find((name) => label.startsWith(name)))
      .filter((name) => name !== undefined);
  }

  /** Drags one tile onto another (or onto any element, such as a portrait) with the mouse. */
  async drag(from: Locator, to: Locator) {
    await dragBetween(this.page, await middleOf(from), await middleOf(to));
    // For 50ms after a drag, dnd-kit stops every click on the page (so the drop isn't also a
    // click), and a click sent at once would be lost. A timer of our own set now runs after it.
    await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
  }

  /**
   * Picks a tile up with the keyboard and moves it with the arrow keys, waiting for each step
   * to be announced, then drops it. `steps` pairs each key with what it should announce.
   */
  async keyboardDrag(tile: Locator, name: string, steps: [key: string, announcement: string][]) {
    await tile.focus();
    await expect(tile).toBeFocused();
    await this.page.keyboard.press("Space");
    await expect(this.announced(`${name} is at position`)).toBeAttached();
    // dnd-kit starts listening for the arrow keys in a zero-delay timer after the pick-up, and
    // Chrome runs input before timers, so a key sent at once can arrive first and be lost. A
    // zero-delay timer of our own runs after dnd-kit's, so once it has, the keys are heard.
    await this.page.evaluate(() => new Promise((resolve) => setTimeout(resolve)));
    for (const [key, announcement] of steps) {
      await this.page.keyboard.press(key);
      await expect(this.announced(announcement)).toBeAttached();
    }
    await this.page.keyboard.press("Space");
    await expect(this.announced(`Dropped ${name}.`)).toBeAttached();
  }
}
