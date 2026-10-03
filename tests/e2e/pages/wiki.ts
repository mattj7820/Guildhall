import { expect } from "@playwright/test";
import { AppPage } from "./app-page";

/** The wiki: notes, the folder sidebar and search. */
export class Wiki extends AppPage {
  get sidebar() {
    return this.page.getByRole("navigation", { name: "Wiki folders" });
  }

  get noteBody() {
    return this.page.locator("article .note-body");
  }

  get searchResults() {
    return this.page.getByRole("list", { name: "Search results" });
  }

  heading(name: string) {
    return this.page.getByRole("heading", { level: 1, name });
  }

  open() {
    return this.goto("/wiki");
  }

  /** Opens a note by its vault path without `.md`, e.g. "NPCs/Mira Stonehand". */
  openNote(slug: string) {
    return this.goto(`/wiki/${slug.split("/").map(encodeURIComponent).join("/")}`);
  }

  async search(query: string) {
    const box = this.page.getByRole("searchbox", { name: "Search the wiki" });
    await box.fill(query);
    await box.press("Enter");
    await expect(this.page).toHaveURL(/\/wiki\?q=/);
  }

  nothingMatches(query: string) {
    return this.page.getByText(`Nothing matches “${query}”.`);
  }
}
