import { expect } from "@playwright/test";
import { AppPage } from "./app-page";

/** The DM's Campaigns page: each campaign's name and folder, and which one is running. */
export class Campaigns extends AppPage {
  open() {
    return this.goto("/settings/campaigns");
  }

  /** A campaign's panel, by its name ("Unnamed campaign" until it has one). */
  campaign(name: string) {
    return this.page.getByRole("region", { name, exact: true });
  }

  async add(name: string, folder: string) {
    await this.page.getByRole("textbox", { name: "The new campaign's name" }).fill(name);
    await this.page.getByRole("combobox", { name: "Folder" }).last().selectOption(folder);
    await this.page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(this.campaign(name)).toBeVisible();
  }

  /** Checks what running the campaign leaves out, then runs it and waits until it's running. */
  async run(name: string) {
    const panel = this.campaign(name);
    await panel.getByRole("button", { name: "Run this campaign…" }).click();
    const check = panel.getByRole("status");
    await expect(check).toBeVisible();
    await check.getByRole("button", { name: /^Run / }).click();
    await expect(panel.getByText("Running", { exact: true })).toBeVisible();
  }
}
