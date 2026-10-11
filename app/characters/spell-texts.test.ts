import { describe, expect, it, vi } from "vitest";
import { loadSpellOptions, loadSpellText, SPELLS_URL, spellTextUrl } from "./spell-texts";

const text = (html: string) => ({ html, source: "SRD 5.2.1" });
const ok = (body: unknown) => () => Promise.resolve(Response.json(body));
const status = (code: number) => () => Promise.resolve(new Response("Not found", { status: code }));

describe("loadSpellOptions", () => {
  it("asks for the spells each time", async () => {
    const fetcher = vi.fn(ok({ spells: [] }));
    expect(await loadSpellOptions(fetcher)).toEqual([]);
    await loadSpellOptions(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledWith(SPELLS_URL);
  });

  it("fails when the server does", async () => {
    await expect(loadSpellOptions(status(500))).rejects.toThrow("500");
  });
});

describe("loadSpellText", () => {
  it("asks for a spell's text by its key", async () => {
    const fetcher = vi.fn(ok(text("<p>Boom</p>")));
    expect(await loadSpellText("srd-5.2/fireball-a", fetcher)).toEqual(text("<p>Boom</p>"));
    expect(fetcher).toHaveBeenCalledWith("/spells/text?key=srd-5.2%2Ffireball-a");
    expect(spellTextUrl("note/Spells/A B")).toBe("/spells/text?key=note%2FSpells%2FA%20B");
  });

  it("loads an SRD spell's text once, as it never changes", async () => {
    const fetcher = vi.fn(ok(text("<p>Once</p>")));
    await loadSpellText("srd-5.2/fireball-b", fetcher);
    await loadSpellText("srd-5.2/fireball-b", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("asks for a note's text each time, so edits to it show", async () => {
    const fetcher = vi.fn(ok(text("<p>Note</p>")));
    await loadSpellText("note/Spells/A", fetcher);
    await loadSpellText("note/Spells/A", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("answers null for a spell that isn't there or isn't theirs", async () => {
    expect(await loadSpellText("note/Spells/Secret", status(404))).toBeNull();
  });

  it("forgets a failure, so opening it again tries again", async () => {
    await expect(loadSpellText("srd-5.2/fireball-c", status(503))).rejects.toThrow("503");
    expect(await loadSpellText("srd-5.2/fireball-c", ok(text("<p>Back</p>")))).toEqual(
      text("<p>Back</p>"),
    );
  });
});
