import { expect, type Page } from "@playwright/test";
import { AppPage } from "./app-page";

/**
 * The combat tracker's parts, wherever it's shown: on the Combat page, or beside a map. The
 * table has one fight, kept on the server; see `fight.spec.ts`.
 */
export class Tracker {
  constructor(readonly page: Page) {}

  get turnOrder() {
    return this.page.getByRole("list", { name: "Turn order" });
  }

  /** The round and whose turn it is, e.g. "Round 2 · Goblin 1's turn". */
  get turnStatus() {
    return this.page.getByRole("region", { name: "Turn", exact: true });
  }

  /** Whose turn it is, as players see it too (on the Combat page and over a map). */
  get whoseTurn() {
    return this.page.getByRole("status", { name: "Whose turn" });
  }

  get latestRoll() {
    return this.page.getByRole("status", { name: "Latest roll" });
  }

  /** The statblock panel, showing whose turn it is or the monster picked. */
  get statblock() {
    return this.page.getByRole("region", { name: "Selected statblock" });
  }

  combatant(name: string) {
    return this.turnOrder.getByRole("listitem", { name, exact: true });
  }

  /** The names in the turn order, in order of play. */
  orderOfPlay() {
    return this.turnOrder
      .getByRole("listitem")
      .evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")));
  }

  /** Waits until the fight's last change has reached the server. */
  async saved() {
    await expect(this.page.getByText("Saving…")).toHaveCount(0);
  }

  async addMonsters(statblock: string, quantity: number) {
    const form = this.page.getByRole("form", { name: "Add monsters" });
    await form.getByLabel("Statblock", { exact: true }).selectOption({ label: statblock });
    await form.getByLabel("How many").fill(String(quantity));
    await form.getByRole("button", { name: "Add monsters" }).click();
  }

  /** Adds a party member (or the shared companion) with its one-click button. */
  async addPartyMember(name: string) {
    await this.page.getByRole("button", { name: `Add ${name}` }).click();
    await expect(this.combatant(name)).toBeVisible();
  }

  async addCompanion(controller: string, statblock: string) {
    const form = this.page.getByRole("form", { name: "Add a companion or other player combatant" });
    await form.getByLabel("Controlled by").fill(controller);
    await form.getByLabel("Linked statblock (optional)").selectOption({ label: statblock });
    await form.getByRole("button", { name: "Add player combatant" }).click();
  }

  async setInitiative(name: string, value: number) {
    const input = this.combatant(name).getByLabel(`Initiative for ${name}`);
    await input.fill(String(value));
    await input.press("Enter");
  }

  async start() {
    await this.page.getByRole("button", { name: "Start combat" }).click();
    await expect(this.turnStatus).toContainText("Round 1");
  }

  async nextTurn() {
    await this.page.getByRole("button", { name: "Next turn" }).click();
  }

  async damage(name: string, amount: number) {
    const row = this.combatant(name);
    await row.getByLabel(`Amount for ${name}`).fill(String(amount));
    await row.getByRole("button", { name: `Damage ${name}` }).click();
  }

  async toggleHidden(name: string) {
    await this.combatant(name)
      .getByRole("button", { name: `Hide ${name} from players` })
      .click();
  }

  async showStatblock(name: string) {
    await this.combatant(name)
      .getByRole("button", { name: `Show statblock for ${name}` })
      .click();
  }

  async undo() {
    await this.page.getByRole("button", { name: "Undo" }).click();
  }

  /** Saves the fight as it's set up as a prepared encounter. */
  async saveAsPrepared(name: string) {
    await this.page.getByText("Save as a prepared encounter").click();
    await this.page.getByLabel("Prepared encounter name").fill(name);
    await this.page.getByRole("button", { name: "Save as prepared" }).click();
    await expect(this.page.getByText(`Saved as “${name}”.`)).toBeVisible();
  }
}

/** The Combat page: the DM's tracker, or a player's view of the fight. */
export class Combat extends AppPage {
  readonly tracker = new Tracker(this.page);

  /** Opens the tracker and waits until the fight has loaded in the browser. */
  async open() {
    await this.goto("/combat");
    await expect(this.tracker.turnStatus).toBeVisible();
  }

  /** A player's Combat page. */
  async openAsPlayer() {
    await this.goto("/combat");
    await expect(this.page.getByRole("heading", { name: "Combat", level: 1 })).toBeVisible();
  }

  get endMyTurn() {
    return this.page.getByRole("button", { name: "End my turn" });
  }

  get turnStrip() {
    return this.page.getByRole("list", { name: "Turn strip" }).getByRole("listitem");
  }
}

/** Prepared encounters: the list, and the editor. */
export class Prepared extends AppPage {
  readonly tracker = new Tracker(this.page);

  get list() {
    return this.page.getByRole("list", { name: "Prepared encounters" });
  }

  card(name: string) {
    return this.list.getByRole("listitem", { name, exact: true });
  }

  /** A monster or companion in the editor. */
  combatant(name: string) {
    return this.page
      .getByRole("list", { name: "Monsters and companions" })
      .getByRole("listitem", { name, exact: true });
  }

  maxHp(name: string) {
    return this.combatant(name).getByLabel(`Max HP for ${name}`);
  }

  async saved() {
    await expect(this.page.getByText("✓ All changes saved")).toBeVisible();
  }

  open() {
    return this.goto("/combat/prepared");
  }

  /** Creates a prepared encounter from the list page and names it; ends in the editor. */
  async create(name: string) {
    await this.open();
    await this.page.getByRole("button", { name: "New encounter" }).click();
    await expect(this.page).toHaveURL(/\/combat\/prepared\/\w+/);
    await this.page.getByLabel("Encounter name").fill(name);
    await this.saved();
  }

  async backToList() {
    await this.page.getByRole("link", { name: "← All prepared encounters" }).click();
    await expect(this.list).toBeVisible();
  }

  /** From the editor: the panel that starts it at the table. */
  async startFromEditor(name: string) {
    await this.page.getByRole("link", { name: "Start", exact: true }).click();
    return this.startPanel(name);
  }

  startPanel(name: string) {
    return this.page.getByRole("region", { name: `Start “${name}”` });
  }
}
