import { CharacterSheet } from "../pages/characters";
import { expect, test } from "../support/fixtures";
import { REVEAL_ALL, uniqueName } from "../support/test-data";

/**
 * The spell picker: SRD spells (2024 first, 2014 behind a chip) and the vault's spell notes,
 * added filled in and linked, then edited and cast like any spell. Spells added keep the SRD's
 * name only until they're renamed to a unique one, so a run repeated against one server still
 * finds its own.
 */

test("a player adds an SRD spell filled in, edits it and casts it", async ({ openAs }) => {
  const player = await openAs("playerOne");
  const sheet = await player.characters.openSheet("Fixture PC One");
  await sheet.openTab("Spells");
  // With no number to prepare, a new spell starts prepared (decision 72).
  await sheet.edit();
  await sheet.field("Spells to prepare").fill("");
  await sheet.field("Spells to prepare").press("Enter");
  await sheet.doneEditing();

  const picker = await sheet.openSpellPicker();
  await expect(picker.chip("2024")).toHaveAttribute("aria-pressed", "true");
  await expect(picker.chip("2014")).toHaveAttribute("aria-pressed", "false");
  await picker.search("identify");
  await expect(picker.details("Identify", "2014")).toHaveCount(0);
  await picker.chip("2014").click();
  await expect(picker.details("Identify", "2014")).toBeVisible();

  // Its text, as the SRD has it, before adding it.
  await picker.details("Identify", "2024").click();
  const row = picker.row("Identify", "2024");
  await expect(row).toContainText("You touch an object throughout the spell's casting");
  await expect(row).toContainText("Material: a pearl worth 100+ GP");
  await expect(row).toContainText("SRD 5.2.1");
  await picker.add("Identify", "2024");
  await expect(picker.status).toContainText("Added Identify (2024), prepared.");
  await expect(picker.row("Identify", "2024")).toContainText("On the sheet");
  await picker.done();

  // An ordinary spell: renamed while editing, still linked to its text.
  const name = uniqueName("Identify");
  await sheet.edit();
  const form = sheet.spells.getByRole("listitem", { name: "Identify", exact: true }).last();
  await expect(form.getByLabel("Range")).toHaveValue("Touch");
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Name").press("Enter");
  await expect(sheet.spells.getByRole("listitem", { name, exact: true })).toContainText(
    "From the SRD 5.2.1",
  );
  await sheet.doneEditing();

  const spell = sheet.readySpell(name);
  await expect(spell).toContainText("1 minute · Touch · V, S, M · Instantaneous");
  await expect(spell.getByTitle("Ritual")).toBeVisible();
  await spell.click();
  await expect(sheet.spells).toContainText("You touch an object throughout the spell's casting");

  await sheet.spells.getByRole("button", { name: `Cast ${name}: as a ritual` }).click();
  await expect(sheet.spells.getByRole("status")).toContainText(`Cast ${name} as a ritual.`);
  await sheet.saved();

  await sheet.reload();
  await sheet.openTab("Spells");
  await sheet.readySpell(name).click();
  await expect(sheet.spells).toContainText("You touch an object throughout the spell's casting");
});

test("a player's vault spell notes are theirs, filled in from their frontmatter", async ({
  openAs,
}) => {
  const player = await openAs("playerOne");
  const sheet = await player.characters.openSheet("Fixture PC One");
  await sheet.openTab("Spells");
  const picker = await sheet.openSpellPicker();

  await picker.search("fixture");
  await expect(picker.details("Fixture Spark", "Mine")).toBeVisible();
  await expect(picker.details("Fixture Artificer Spell", "Mine")).toBeVisible();
  // The SRD has no Artificer: its list comes from the notes.
  await picker.search("");
  await picker.region.getByLabel("Class").selectOption("Artificer");
  await expect(picker.found.getByRole("button", { name: /: details$/ })).toHaveCount(1);

  await picker.details("Fixture Artificer Spell", "Mine").click();
  await expect(picker.row("Fixture Artificer Spell", "Mine")).toContainText(
    "whose frontmatter fills in a picked spell",
  );
  await picker.add("Fixture Artificer Spell", "Mine");
  await picker.done();

  const name = uniqueName("Artificer Spell");
  await sheet.edit();
  const form = sheet.spells
    .getByRole("listitem", { name: "Fixture Artificer Spell", exact: true })
    .last();
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Name").press("Enter");
  await sheet.doneEditing();
  const spell = sheet.spells
    .getByRole("listitem")
    .filter({ has: player.page.getByRole("button", { name: `${name}: details`, exact: true }) });
  await expect(spell).toContainText("DEX");
  await expect(spell).toContainText("2d6");
});

test("a player never finds a DM-only spell note; the DM sees it marked", async ({
  app,
  openAs,
}) => {
  const player = await openAs("playerOne");
  const sheet = await player.characters.openSheet("Fixture PC One");
  await sheet.openTab("Spells");
  const picker = await sheet.openSpellPicker();
  await picker.search("fixture secret");
  await expect(picker.found).toContainText("Nothing matches.");

  // Nor through the data requests behind it.
  const spells = await player.page.request.get("/spells");
  expect(await spells.text()).not.toContain("Fixture Secret Spell");
  const text = await player.page.request.get(
    `/spells/text?key=${encodeURIComponent("note/Spells/Fixture Secret Spell")}`,
  );
  expect(text.status()).toBe(404);

  const dmSheet = await app.characters.openSheet("Fixture PC One");
  await dmSheet.openTab("Spells");
  const dmPicker = await dmSheet.openSpellPicker();
  await dmPicker.search("fixture secret");
  await expect(dmPicker.row("Fixture Secret Spell", "Mine")).toContainText("DM only");
});

test("a player adds a spell from the sheet beside the map", async ({ api, openAs }) => {
  const map = await api.createMap({ shared: true, fog: [REVEAL_ALL] });
  const player = await openAs("playerOne");
  const view = await player.maps.view(map);
  const panel = view.page.getByRole("complementary", { name: "Side panel" });
  await panel.getByRole("tab", { name: "Sheet" }).click();
  await panel.getByRole("tab", { name: "Spells" }).click();

  const sheet = new CharacterSheet(player.page);
  const picker = await sheet.openSpellPicker(panel);
  await picker.search("fire bolt");
  await picker.add("Fire Bolt", "2024");
  await expect(picker.status).toContainText("a cantrip, always ready");
  await picker.done();
  await expect(sheet.readySpell("Fire Bolt", panel).first()).toBeVisible();
});
