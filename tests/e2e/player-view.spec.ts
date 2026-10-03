import { expect, test } from "./support/fixtures";

/**
 * The player preview must hide DM-only content everywhere it could surface. In the fixture vault,
 * "Captain Voss" (no visibility field) and "Villain Plan" (visibility: dm) are both DM-only.
 */
test.describe("Player view", () => {
  test("the DM sees DM-only notes by default", async ({ wiki }) => {
    await wiki.open();

    await expect(wiki.sidebar.getByRole("link", { name: /Captain Voss/ })).toBeVisible();
    await expect(wiki.sidebar.getByText("Secrets")).toBeVisible();
  });

  test("hides DM-only notes and folders from the sidebar", async ({ wiki }) => {
    await wiki.open();
    await wiki.previewAsPlayer();

    await expect(wiki.sidebar.getByRole("link", { name: /Mira Stonehand/ })).toBeVisible();
    await expect(wiki.sidebar.getByRole("link", { name: /Captain Voss/ })).toHaveCount(0);
    await expect(wiki.sidebar.getByText("Secrets")).toHaveCount(0);
  });

  test("shows links to DM-only notes as plain text", async ({ wiki }) => {
    await wiki.openNote("Locations/Brindleford");
    await expect(wiki.noteBody.getByRole("link", { name: "Captain Voss" })).toBeVisible();

    await wiki.previewAsPlayer();
    await expect(wiki.noteBody).toContainText("The town guard answers to Captain Voss.");
    await expect(wiki.noteBody.getByRole("link", { name: "Captain Voss" })).toHaveCount(0);
  });

  test("returns not found for a DM-only note's URL", async ({ page, wiki }) => {
    await wiki.open();
    await wiki.previewAsPlayer();

    const response = await wiki.goto("/wiki/Secrets/Villain%20Plan");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Note not found" })).toBeVisible();
  });

  test("leaves DM-only notes out of search results", async ({ wiki }) => {
    await wiki.open();
    await wiki.search("quartermaster");
    await expect(wiki.searchResults.getByRole("link")).toHaveCount(2);

    await wiki.previewAsPlayer();
    await expect(wiki.nothingMatches("quartermaster")).toBeVisible();
  });

  test("hides DM comments inside player-visible notes", async ({ wiki }) => {
    await wiki.openNote("NPCs/Mira Stonehand");
    await expect(wiki.noteBody).toContainText("inline secret about the forge");
    await expect(wiki.noteBody).toContainText("It spans several lines.");

    await wiki.previewAsPlayer();
    await expect(wiki.noteBody).toContainText("She works in Brindleford.");
    await expect(wiki.noteBody).not.toContainText("secret");
  });

  test("hides DM sections and DM callouts inside player-visible notes", async ({ wiki }) => {
    // "Fixture Informant" opens with a "# DM" section, and has a DM callout and a "## DM" section.
    await wiki.openNote("NPCs/Fixture Informant");
    for (const secret of ["medlar", "loquat", "quince"]) {
      await expect(wiki.noteBody).toContainText(secret);
    }
    await expect(wiki.noteBody.getByRole("img")).toBeVisible();

    await wiki.previewAsPlayer();
    await expect(wiki.heading("Fixture Informant")).toBeVisible();
    await expect(wiki.noteBody).toContainText("persimmon");
    await expect(wiki.noteBody).toContainText("damson");
    for (const secret of ["medlar", "loquat", "quince", "[!dm]"]) {
      await expect(wiki.noteBody).not.toContainText(secret);
    }
    await expect(wiki.noteBody.getByRole("img")).toHaveCount(0);

    await wiki.search("quince");
    await expect(wiki.nothingMatches("quince")).toBeVisible();
  });

  test("blocks attachments that only DM-only notes use", async ({ api, wiki }) => {
    const asset = async (name: string) =>
      (await api.request.get(`/vault-asset/Attachments/${name}`)).status();
    await wiki.open();
    expect(await asset("dm-map.png")).toBe(200);

    await wiki.previewAsPlayer();
    expect(await asset("dm-map.png")).toBe(404);
    expect(await asset("mira-portrait.png")).toBe(200);
  });

  test("switching back restores the DM view on the same page", async ({ page, wiki }) => {
    await wiki.openNote("Locations/Brindleford");
    await wiki.previewAsPlayer();
    await wiki.backToDmView();

    await expect(page).toHaveURL("/wiki/Locations/Brindleford");
    await expect(wiki.noteBody.getByRole("link", { name: "Captain Voss" })).toBeVisible();
  });
});
