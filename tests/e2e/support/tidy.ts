import type { PlaywrightWorkerArgs } from "@playwright/test";
import { Api, ok } from "./api";
import { SIGNED_IN } from "./sign-in";
import { namesMade } from "./test-data";

interface StoredCharacter {
  revision: number;
  inventory: { items: { id: string; name: string }[] };
}

/**
 * Takes the items a test added (by the unique names it made) out of every party bag, as the DM,
 * who may change any. Bags are shared by every test on the server, and would otherwise only grow,
 * until tiles a test drags are far down the page. Use in `test.afterEach`.
 */
export async function tidyBags({
  playwright,
  baseURL,
}: Pick<PlaywrightWorkerArgs, "playwright"> & { baseURL?: string }) {
  const names = [...namesMade];
  namesMade.clear();
  if (names.length === 0) return;
  const request = await playwright.request.newContext({ baseURL, storageState: SIGNED_IN.dm });
  try {
    const api = new Api(request);
    const page = await (await request.get("/characters")).text();
    const sheets = new Set(page.match(/\/characters\/[0-9a-f]{8,}/g));
    for (const sheet of sheets) {
      const { character } = (await (await request.get(`${sheet}/changes`)).json()) as {
        character: StoredCharacter;
      };
      const ours = character.inventory.items.filter((item) =>
        names.some((name) => item.name.includes(name)),
      );
      if (ours.length === 0) continue;
      const actions = ours.map((item) => ({
        type: "inventory",
        change: { type: "remove", id: item.id },
      }));
      await ok(api.post(`${sheet}/changes`, { baseRevision: character.revision, actions }));
    }
  } finally {
    await request.dispose();
  }
}
