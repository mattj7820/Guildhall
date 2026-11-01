import { expect, test } from "./support/fixtures";
import { uniqueName } from "./support/test-data";

/**
 * The wiki as a tome, picked in Settings. A newcomer the DM lets in picks it, so the shared
 * accounts other specs use keep the plain wiki. As a player without a character, they also show
 * that the spells only ever find what players may read.
 */
test.describe("The wiki as a tome", () => {
  test("someone picks the tome and finds notes with its spells", async ({ members, openAs }) => {
    const them = await openAs("signedOut");
    const name = uniqueName("Tome reader");
    await them.signIn.asNewcomer(name);
    await members.open();
    await members.letIn(name);

    await them.settings.open();
    await them.settings.pickWikiLook("Tome");
    const { tome } = them;

    await tome.goto("/wiki/Locations/Brindleford");
    await expect(tome.chapter("Locations")).toHaveAttribute("aria-pressed", "true");
    await expect(tome.chapter("Secrets")).toHaveCount(0);

    // Locate Object: the wiki's own search, as players see it.
    await tome.locate("stoneh");
    await expect(
      tome.list("Search results").getByRole("link", { name: /Mira Stonehand/ }),
    ).toBeVisible();
    await tome.words("Speak the words").press("Enter");
    await expect(tome.page).toHaveURL("/wiki/NPCs/Mira%20Stonehand");
    await tome.words("Speak the words").fill("quartermaster");
    await expect(tome.status("Nothing answers to “quartermaster”.")).toBeVisible();

    // Misty Step: a note by name.
    await tome.mistyStep("brindle");
    await expect(tome.status("Enter steps to Brindleford.")).toBeVisible();
    await tome.words("Name the place").press("Enter");
    await expect(tome.page).toHaveURL("/wiki/Locations/Brindleford");

    // Detect Magic: notes by tag.
    await tome.spell("Detect Magic").click();
    await tome.page.getByRole("button", { name: "#brindleford" }).click();
    await expect(
      tome.list("Notes tagged brindleford").getByRole("link", { name: /Mira Stonehand/ }),
    ).toBeVisible();

    // Scrying: what links here, without a link players can't read.
    await tome.goto("/wiki/Locations/Old%20Mill");
    await tome.spell("Scrying").click();
    const linkedFrom = tome.list("Notes that link here");
    await expect(linkedFrom.getByRole("link", { name: /Brindleford/ })).toBeVisible();
    await expect(linkedFrom.getByRole("link", { name: /Fixture Informant/ })).toHaveCount(0);

    // Back to pages: the plain wiki's sidebar.
    await them.settings.open();
    await them.settings.pickWikiLook("Pages");
    await them.wiki.open();
    await expect(them.wiki.sidebar).toBeVisible();
  });
});
