import { expect } from "@playwright/test";
import { AppPage } from "./app-page";

/** The wiki as a tome: ribbons for chapters, spells on the left page, the note on the right. */
export class Tome extends AppPage {
  chapter(name: string) {
    return this.page.getByRole("group", { name: "Chapters" }).getByRole("button", { name });
  }

  spell(name: string) {
    return this.page
      .getByRole("group", { name: "Spells", exact: true })
      .getByRole("button", { name: new RegExp(name) });
  }

  /** A spell's input, by its label ("Speak the words", "Name the place"). */
  words(label: string) {
    return this.page.getByRole("searchbox", { name: label });
  }

  list(name: string) {
    return this.page.getByRole("list", { name });
  }

  status(text: string) {
    return this.page.getByRole("status").filter({ hasText: text });
  }

  /** Casts Locate Object from the keyboard and speaks the words. */
  async locate(words: string) {
    await this.page.keyboard.press("/");
    await expect(this.words("Speak the words")).toBeFocused();
    await this.words("Speak the words").fill(words);
  }

  /** Casts Misty Step from the keyboard and names the place. */
  async mistyStep(name: string) {
    await this.page.keyboard.press("Control+k");
    await expect(this.words("Name the place")).toBeFocused();
    await this.words("Name the place").fill(name);
  }
}
