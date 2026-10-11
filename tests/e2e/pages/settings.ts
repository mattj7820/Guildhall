import { expect } from "@playwright/test";
import { AppPage } from "./app-page";

/** Someone's own Settings page: their theme. */
export class Settings extends AppPage {
  open() {
    return this.goto("/settings");
  }

  theme(label: string) {
    return this.page.getByRole("button", { name: label });
  }

  /** The theme the page is shown in, as <html data-theme>; null when following the device. */
  shownIn() {
    return this.page.locator("html").getAttribute("data-theme");
  }

  async pick(label: string, value: string) {
    await this.theme(label).click();
    await expect(this.theme(label)).toHaveAttribute("aria-pressed", "true");
    await expect(this.page.locator("html")).toHaveAttribute("data-theme", value);
  }
}
