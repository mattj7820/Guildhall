import { describe, expect, it, vi } from "vitest";
import { loadStatblock, statblockUrl } from "./statblocks";
import type { CombatCatalogue } from "./types";

const catalogue = (): CombatCatalogue => ({ creatures: [], party: [] });
const ok = (html: string) => () => Promise.resolve(Response.json({ html }));
const status = (code: number) => () => Promise.resolve(new Response("Not found", { status: code }));

describe("loadStatblock", () => {
  it("asks for the statblock by its key", async () => {
    const fetcher = vi.fn(ok("<section>Minion</section>"));
    const key = "Bestiary/Fixture Minion#Fixture Minion";
    expect(await loadStatblock(catalogue(), key, fetcher)).toEqual({
      html: "<section>Minion</section>",
    });
    expect(fetcher).toHaveBeenCalledWith(statblockUrl(key));
    expect(statblockUrl(key)).toBe(
      "/combat/statblock?key=Bestiary%2FFixture%20Minion%23Fixture%20Minion",
    );
  });

  it("loads each statblock once for a catalogue", async () => {
    const fetcher = vi.fn(ok("<section></section>"));
    const page = catalogue();
    await loadStatblock(page, "a", fetcher);
    await loadStatblock(page, "a", fetcher);
    await loadStatblock(page, "b", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("loads it again with a new catalogue, so the page's next load sees vault edits", async () => {
    const fetcher = vi.fn(ok("<section></section>"));
    await loadStatblock(catalogue(), "a", fetcher);
    await loadStatblock(catalogue(), "a", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("answers null for a statblock that isn't there, and remembers it", async () => {
    const fetcher = vi.fn(status(404));
    const page = catalogue();
    expect(await loadStatblock(page, "gone", fetcher)).toBeNull();
    expect(await loadStatblock(page, "gone", fetcher)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("forgets a failure, so showing it again tries again", async () => {
    const page = catalogue();
    await expect(loadStatblock(page, "a", status(503))).rejects.toThrow("503");
    expect(await loadStatblock(page, "a", ok("<section>Back</section>"))).toEqual({
      html: "<section>Back</section>",
    });
  });
});
