import { expect, type Locator, type Page } from "@playwright/test";
import { AppPage, dragBetween, middleOf } from "./app-page";

/** Types into a sheet's field and presses Enter, which saves it. */
async function commit(field: Locator, value: string) {
  await field.fill(value);
  await field.press("Enter");
}

function escaped(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

  /** One of the sheet's tabs: Actions, Spells, Features, Notes… */
  async openTab(name: string) {
    const tab = this.page.getByRole("tab", { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  }

  /** Slots, uses, hit dice and concentration, at a glance under the hit points. */
  get trackers() {
    return this.page.getByRole("region", { name: "Trackers" });
  }

  /** A row of pips by what it counts ("1st-level slot", a feature's name), which says what's left. */
  counter(label: string, within: Locator | Page = this.page) {
    return within.getByRole("group", {
      name: new RegExp(`^${escaped(label)}: \\d+ of \\d+ left$`),
    });
  }

  /** How many of something are left, read from its pips. */
  async left(label: string, within: Locator | Page = this.page): Promise<number> {
    const name = (await this.counter(label, within).first().getAttribute("aria-label")) ?? "";
    return Number(/: (\d+) of/.exec(name)?.[1]);
  }

  /** Uses one: a click on a lit pip. */
  async useOne(label: string, within: Locator = this.trackers) {
    await within
      .getByRole("button", { name: `Use one ${label}` })
      .first()
      .click();
  }

  /** While editing, adds an attack from the Actions tab and fills it in. */
  async addAttack({ name, bonus, damage }: { name: string; bonus: number; damage: string }) {
    await this.page.getByRole("button", { name: "Add attack" }).click();
    await commit(
      this.page.getByRole("listitem", { name: "New attack" }).last().getByLabel("Name"),
      name,
    );
    const row = this.page.getByRole("listitem", { name, exact: true });
    await commit(row.getByLabel("To hit"), String(bonus));
    await commit(row.getByLabel("Damage"), damage);
  }

  /**
   * While editing, adds a spell from the Spells tab and fills it in. A wiki note is linked first,
   * since a new spell takes its note's name, and then the spell is given its own.
   */
  async addSpell({
    name,
    level,
    note,
    concentration = false,
    attack = false,
    roll,
  }: {
    name: string;
    level: string;
    note?: string;
    concentration?: boolean;
    attack?: boolean;
    roll?: string;
  }) {
    await this.page.getByRole("button", { name: "Add spell" }).click();
    let row = this.page.getByRole("listitem", { name: "New spell" }).last();
    if (note) {
      await row.getByLabel("Wiki note").selectOption({ label: note });
      row = this.page.getByRole("listitem", { name: note, exact: true }).last();
    }
    await commit(row.getByLabel("Name"), name);
    row = this.page.getByRole("listitem", { name, exact: true });
    await row.getByLabel("Level").selectOption({ label: level });
    if (concentration) await row.getByLabel("Concentration").check();
    if (attack) await row.getByLabel("Spell attack").check();
    if (roll) await commit(row.getByLabel("Roll"), roll);
    return row;
  }

  /** The Spells tab's contents on the full sheet; beside the map, pass the panel instead. */
  get spells() {
    return this.page.getByRole("tabpanel");
  }

  /** A ready spell, listed day to day (outside Prepare mode). */
  readySpell(name: string, within: Locator = this.spells) {
    return within.getByRole("button", { name: `${name}: details`, exact: true });
  }

  /** Opens the spell picker from the Spells tab; beside the map, pass the panel. */
  async openSpellPicker(within: Locator = this.spells) {
    await within.getByRole("button", { name: "Add spells" }).click();
    const picker = new SpellPicker(within.getByRole("region", { name: "Add spells" }));
    await expect(picker.found.getByRole("listitem").first()).toBeVisible();
    return picker;
  }

  /** Opens Prepare mode from the Spells tab. */
  async openPrepare(within: Locator = this.spells) {
    await within.getByRole("button", { name: "Prepare spells" }).first().click();
    await expect(within.getByRole("heading", { name: "Prepare spells" })).toBeVisible();
  }

  /** A spell's checkbox in Prepare mode: checked while it's prepared. */
  prepareBox(name: string, within: Locator = this.spells) {
    return within.getByRole("checkbox", { name: `Prepare ${name}`, exact: true });
  }

  /** Prepare mode's count, "3 / 3 prepared" or "3 prepared", and anything said after it. */
  preparedCount(within: Locator = this.spells) {
    return within.getByText(/^\d+( \/ \d+)? prepared/);
  }

  /** How many count as prepared now, read from Prepare mode's count. */
  async prepared(within: Locator = this.spells): Promise<number> {
    return Number(/^(\d+)/.exec((await this.preparedCount(within).textContent()) ?? "")?.[1]);
  }

  /** While editing, adds a feature from the open tab and fills it in. */
  async addFeature({
    name,
    usedAs,
    uses,
  }: {
    name: string;
    usedAs: string;
    uses?: { max: number; comesBackOn: "Short rest" | "Long rest" | "By hand" };
  }) {
    await this.page.getByRole("button", { name: "Add feature" }).click();
    await commit(
      this.page.getByRole("listitem", { name: "New feature" }).last().getByLabel("Name"),
      name,
    );
    const row = () => this.page.getByRole("listitem", { name, exact: true });
    await row().getByLabel("Used as").selectOption({ label: usedAs });
    if (uses) {
      await row().getByLabel("Limited uses").check();
      await commit(row().getByLabel(`${name}: how many uses`), String(uses.max));
      await row().getByLabel(`${name}: comes back on`).selectOption({ label: uses.comesBackOn });
    }
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

/** The spell picker on the Spells tab: the SRD's spells and the DM's spell notes. */
export class SpellPicker {
  constructor(readonly region: Locator) {}

  get found() {
    return this.region.getByRole("list", { name: "Spells found" });
  }

  get status() {
    return this.region.getByRole("status");
  }

  async search(text: string) {
    await this.region.getByRole("searchbox", { name: "Find a spell" }).fill(text);
  }

  chip(name: string) {
    return this.region.getByRole("button", { name, exact: true });
  }

  /** A spell's row, by its name and tag ("Mine", "2024", "2014"). */
  row(name: string, tag: string) {
    // The inner locator is matched within each row, so it starts from the page.
    const details = this.region
      .page()
      .getByRole("button", { name: `${name} (${tag}): details`, exact: true });
    return this.found.getByRole("listitem").filter({ has: details });
  }

  details(name: string, tag: string) {
    return this.region.getByRole("button", { name: `${name} (${tag}): details`, exact: true });
  }

  async add(name: string, tag: string) {
    await this.region.getByRole("button", { name: `Add ${name} (${tag})`, exact: true }).click();
    await expect(this.status).toContainText(`Added ${name} (${tag})`);
  }

  async done() {
    await this.region.getByRole("button", { name: "Done", exact: true }).click();
  }
}
