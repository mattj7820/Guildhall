import { expect, test } from "./support/fixtures";

test.describe("Wiki navigation", () => {
  test("clicking a wikilink opens the linked note", async ({ page, wiki }) => {
    await wiki.openNote("Home");
    await wiki.noteBody.getByRole("link", { name: "Brindleford" }).click();

    await expect(page).toHaveURL("/wiki/Locations/Brindleford");
    await expect(wiki.heading("Brindleford")).toBeVisible();
  });

  test("an aliased wikilink shows its alias and opens the target note", async ({ page, wiki }) => {
    await wiki.openNote("Home");
    await wiki.noteBody.getByRole("link", { name: "the blacksmith" }).click();

    await expect(page).toHaveURL("/wiki/NPCs/Mira%20Stonehand");
    await expect(wiki.heading("Mira Stonehand")).toBeVisible();
  });

  test("a heading link opens the note at that heading", async ({ page, wiki }) => {
    await wiki.openNote("Home");
    await wiki.noteBody.getByRole("link", { name: "Session 1 > Loot" }).click();

    await expect(page).toHaveURL("/wiki/Sessions/Session%201#loot");
    await expect(page.getByRole("heading", { name: "Loot" })).toBeInViewport();
  });

  test("an ambiguous link resolves to the shortest path", async ({ wiki }) => {
    await wiki.openNote("Locations/Brindleford");
    await wiki.noteBody.getByRole("link", { name: "Old Mill" }).click();

    await expect(wiki.heading("Old Mill (outside town)")).toBeVisible();
  });

  test("a broken link is shown but not clickable", async ({ wiki }) => {
    await wiki.openNote("Home");
    await expect(wiki.noteBody.getByText("A Note That Does Not Exist")).toBeVisible();
    await expect(
      wiki.noteBody.getByRole("link", { name: "A Note That Does Not Exist" }),
    ).toHaveCount(0);
  });

  test("embedded images load from the vault", async ({ wiki }) => {
    await wiki.openNote("NPCs/Mira Stonehand");
    const images = wiki.noteBody.getByRole("img", { name: "mira-portrait.png" });

    await expect(images).toHaveCount(2);
    await expect(images.last()).toHaveAttribute("width", "120");
    await expect
      .poll(() => images.first().evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  });

  test("the folder sidebar navigates to notes", async ({ page, wiki }) => {
    await wiki.open();
    const link = wiki.sidebar.getByRole("link", { name: /Session 1/ });
    await link.click();

    await expect(page).toHaveURL("/wiki/Sessions/Session%201");
    await expect(link).toHaveAttribute("aria-current", "page");
  });

  test("an unknown note shows a not-found page", async ({ page, wiki }) => {
    const response = await wiki.goto("/wiki/No/Such/Note");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Note not found" })).toBeVisible();
  });
});
