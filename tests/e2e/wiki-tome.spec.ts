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

    // The wiki's front page is the closed book, which opens to its title page.
    await tome.goto("/wiki");
    await expect(tome.page.getByRole("button", { name: /^Rename|^Name the campaign/ })).toHaveCount(
      0,
    );
    await tome.page.getByRole("button", { name: /^Open / }).click();
    await expect(tome.page).toHaveURL("/wiki?open");
    await expect(tome.chapter("Locations")).toBeVisible();

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

    // Reading: the left page folds away for a long note, and comes back.
    await tome.page.getByRole("button", { name: "Read", exact: true }).click();
    await expect(tome.spell("Locate Object")).toBeHidden();
    await tome.reload();
    await expect(tome.page.getByRole("button", { name: "Contents", exact: true })).toBeVisible();
    await tome.page.keyboard.press("r");
    await expect(tome.spell("Locate Object")).toBeVisible();

    // Closing the book goes back to its cover.
    await tome.page.getByRole("link", { name: "Close", exact: true }).click();
    await expect(tome.page).toHaveURL("/wiki");
    await expect(tome.page.getByRole("button", { name: /^Open / })).toBeVisible();

    // Back to pages: the plain wiki's sidebar.
    await them.settings.open();
    await them.settings.pickWikiLook("Pages");
    await them.wiki.open();
    await expect(them.wiki.sidebar).toBeVisible();
  });

  test("the DM names the campaign, and everyone's wiki shows it", async ({ api, openAs }) => {
    await api.postForm("/wiki?index", { campaignName: "Fixture Campaign" });
    const player = await openAs("playerOne");
    await player.goto("/wiki");
    // The plain wiki shows the name too; in the tome it's on the cover.
    await expect(
      player.page.getByRole("heading", { level: 1, name: "Fixture Campaign" }),
    ).toBeVisible();
    await api.postForm("/wiki?index", { campaignName: "" });
  });

  test("players can't name the campaign", async ({ openAs }) => {
    const player = await openAs("playerOne");
    const response = await player.api.postForm("/wiki?index", { campaignName: "Not theirs" });
    expect(response.status()).toBe(404);
  });
});
