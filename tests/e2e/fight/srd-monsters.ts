import { expect, test as base } from "./fight-test";
import { Tracker } from "../pages/combat";
import type { MapView } from "../pages/maps";
import { d20, face, scriptDice } from "../support/dice";
import { REVEAL_ALL, SQUARES_64, uniqueName } from "../support/test-data";

/**
 * The SRD's monsters, bundled with Guildhall beside the fixture vault's statblocks. Real SRD
 * monsters are used: the 2024 Wolf (2d8 + 2 HP, Bite "Melee Attack Roll: +4", Medium), the 2014
 * Blink Dog (which has the SRD's own lore) and the 2024 Ogre (Large: two squares across).
 */

const d8 = (value: number) => face(8, value);

const test = base.extend<{ battlefield: MapView }>({
  /** A shared battle map of the fog fixture, all revealed, open with Combat beside it. */
  battlefield: async ({ api, maps }, use) => {
    const map = await api.createMap({
      name: uniqueName("Battlefield"),
      shared: true,
      fog: [REVEAL_ALL],
      grid: SQUARES_64,
    });
    const view = await maps.view(map);
    await view.openCombat();
    await use(view);
  },
});

test.describe("SRD monsters", () => {
  test("the DM finds one, adds three and rolls from its statblock beside the fight", async ({
    combat,
    page,
  }) => {
    const { tracker } = combat;
    await combat.open();
    await tracker.findMonster("wolf");
    const found = tracker.monsterPicker.getByRole("list", { name: "Monsters found" });
    // The exact name first, the 2024 rules before 2014, then names with the word in them.
    await expect(found.getByRole("listitem").nth(0)).toContainText(/^Wolf\s*2024\s*1\/4/);
    await expect(found.getByRole("listitem").nth(1)).toContainText(/^Wolf\s*2014\s*1\/4/);
    await expect(found).toContainText("Dire Wolf");

    // Per wolf: initiative, then 2d8 + 2 hit points.
    await scriptDice(page, [d20(10), d8(4), d8(5), d20(12), d8(1), d8(1), d20(3), d8(8), d8(8)]);
    await tracker.addMonsters("Wolf", 3, "2024");
    await expect(tracker.combatant("Wolf 1")).toContainText("11/11");
    await expect(tracker.combatant("Wolf 2")).toContainText("4/4");
    await expect(tracker.combatant("Wolf 3")).toContainText("18/18");

    await tracker.showStatblock("Wolf 1");
    await expect(tracker.statblock).toContainText("Pack Tactics");
    await expect(tracker.statblock).toContainText("SRD 5.2.1 (2024 rules)");
    await scriptDice(page, [d20(13)]);
    await tracker.statblock.getByRole("button", { name: "Roll Bite attack: 1d20 + 4" }).click();
    await expect(tracker.latestRoll).toContainText("Wolf 1 · Bite attack");
    await expect(tracker.latestRoll).toContainText("17");
  });

  test("filters by where a statblock is from and its challenge rating", async ({ combat }) => {
    const { tracker } = combat;
    await combat.open();
    const picker = tracker.monsterPicker;
    const found = picker.getByRole("list", { name: "Monsters found" });

    await picker.getByRole("button", { name: "2024", exact: true }).click();
    await picker.getByRole("button", { name: "2014", exact: true }).click();
    await expect(found).toContainText("Fixture Minion");
    await expect(found).not.toContainText("Aboleth");

    await picker.getByRole("button", { name: "2014", exact: true }).click();
    await picker.getByRole("button", { name: "Mine", exact: true }).click();
    await picker.getByLabel("Lowest challenge rating").selectOption("20");
    await expect(found.getByRole("listitem")).not.toHaveCount(0);
    for (const row of await found.getByRole("listitem").all()) {
      await expect(row).toContainText("2014");
    }
    await expect(found).toContainText("Ancient Red Dragon");
    await expect(found).not.toContainText("Adult Red Dragon");
  });

  test("shows the SRD's lore and credit with a monster that has some", async ({ combat, page }) => {
    const { tracker } = combat;
    await combat.open();
    await tracker.findMonster("blink dog");
    await tracker.monsterPicker
      .getByRole("listitem")
      .filter({ hasText: "2014" })
      .getByRole("button", { name: "Blink Dog", exact: true })
      .click();
    await tracker.monsterPicker.getByText("Statblock", { exact: true }).click();
    const preview = page.getByRole("region", { name: "Statblock preview" });
    await expect(preview).toContainText("From the SRD");
    await expect(preview).toContainText("A blink dog takes its name");

    await preview.getByRole("link", { name: "Credits" }).click();
    await expect(
      page.getByRole("heading", { name: "Monsters and spells from the SRD" }),
    ).toBeVisible();
    await expect(page.getByText(/System Reference Document 5\.1/)).toBeVisible();
    await expect(page.getByText(/System Reference Document 5\.2\.1/)).toBeVisible();
  });

  test("an SRD monster prepared on a battle map starts there, its token sized from its statblock", async ({
    battlefield,
    page,
    prepared,
  }) => {
    const tracker = new Tracker(page);
    await tracker.addMonsters("Fixture Minion", 1);
    await tracker.addMonsters("Ogre", 1, "2024");
    await expect(battlefield.placing).toBeVisible();
    await battlefield.canvas.click();
    const ogre = battlefield.anyTokenNamed("Ogre 1");
    await expect(ogre).toBeVisible();

    // Large: twice as wide as the Small minion beside it.
    const width = async (name: string) =>
      (await battlefield.anyTokenNamed(name).locator("circle").first().boundingBox())!.width;
    await expect
      .poll(async () => (await width("Ogre 1")) / (await width("Fixture Minion 1")))
      .toBeGreaterThan(1.8);
    const placedAt = await ogre.getAttribute("aria-label");

    const encounterName = uniqueName("Ogre ambush");
    await tracker.saveAsPrepared(encounterName);
    await battlefield.endFight("Clear the monsters");
    await expect(ogre).toHaveCount(0);

    await prepared.open();
    await page.getByRole("link", { name: `Start ${encounterName}` }).click();
    await page.waitForURL((current) => current.searchParams.has("start"));
    await prepared
      .startPanel(encounterName)
      .getByRole("button", { name: "Add to tracker" })
      .click();
    await expect(ogre).toHaveAttribute("aria-label", placedAt!);
    await tracker.showStatblock("Ogre 1");
    await expect(tracker.statblock).toContainText("SRD 5.2.1 (2024 rules)");
  });

  test("players get none of it: no catalogue, and no SRD statblock", async ({ api, openAs }) => {
    const url = `/combat/statblock?key=${encodeURIComponent("srd-5.2:wolf")}`;
    expect((await api.request.get(url)).status()).toBe(200);

    const player = await openAs("playerOne");
    expect((await player.api.request.get(url)).status()).toBe(404);
    await player.combat.openAsPlayer();
    await expect(player.page.getByRole("searchbox", { name: "Find a monster" })).toHaveCount(0);
  });
});
