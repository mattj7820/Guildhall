import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyActions, type CharacterAction } from "./actions";
import { CharacterEditor } from "./editor";
import { aCharacter, anItem } from "./test-builders";
import type { Character, PlayerCharacter } from "./types";

/**
 * A stand-in for the changes endpoint that applies actions like the real one, and can be told to
 * fail or to have someone else change the character first.
 */
function fakeServer(initial: Character) {
  let stored = initial;
  const server = {
    get stored() {
      return stored;
    },
    posts: [] as { baseRevision: number; actions: CharacterAction[] }[],
    /** Answers the next posts with these statuses instead of saving. */
    failWith: [] as (number | "offline")[],
    /** Someone else's change, made on the server now. */
    elsewhere(...actions: CharacterAction[]) {
      stored = { ...applyActions(stored, actions).character, revision: stored.revision + 1 };
    },
    gifts: [] as { item: string; amount: number; to: string }[],
    fetch: vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (init?.method !== "POST") return Response.json({ character: stored });
      const body = JSON.parse(String(init.body));
      if (String(url).endsWith("/give")) {
        const item = stored.inventory.items.find((candidate) => candidate.id === body.item);
        if (!item)
          return Response.json({ error: "That item isn't there any more." }, { status: 409 });
        server.gifts.push(body);
        stored = {
          ...applyActions(stored, [
            item.quantity === body.amount
              ? { type: "inventory", change: { type: "remove", id: item.id } }
              : {
                  type: "inventory",
                  change: { type: "quantity", id: item.id, quantity: item.quantity - body.amount },
                },
          ]).character,
          revision: stored.revision + 1,
        };
        return Response.json({ character: stored });
      }
      server.posts.push(body);
      const failure = server.failWith.shift();
      if (failure === "offline") throw new TypeError("Failed to fetch");
      if (failure) return Response.json({ error: "Refused" }, { status: failure });
      const changedElsewhere = stored.revision !== body.baseRevision;
      const { character, results } = applyActions(stored, body.actions);
      stored = results.some((result) => result.outcome === "changed")
        ? { ...character, revision: stored.revision + 1 }
        : stored;
      return Response.json({ character: stored, results, changedElsewhere });
    }),
  };
  return server;
}

const TIMING = { saveDelayMs: 300, retryDelayMs: 3000 };
const dex = (value: number): CharacterAction => ({ type: "ability", ability: "dex", value });
const dexOf = (character: Character) => (character as PlayerCharacter).sheet.abilities.dex;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setUp(initial = aCharacter()) {
  const server = fakeServer(initial);
  const editor = new CharacterEditor(
    initial,
    "/characters/c/changes",
    "/characters/c/give",
    server.fetch as typeof fetch,
    TIMING,
  );
  return { server, editor };
}

describe("CharacterEditor", () => {
  it("shows a change at once and saves it shortly after, with others as one batch", async () => {
    const { server, editor } = setUp();
    editor.dispatch(dex(14));
    editor.dispatch(dex(16));
    expect(dexOf(editor.getSnapshot().character)).toBe(16);
    expect(editor.getSnapshot().unsaved).toBe(true);

    await vi.advanceTimersByTimeAsync(300);
    expect(server.posts).toEqual([{ baseRevision: 0, actions: [dex(14), dex(16)] }]);
    expect(editor.getSnapshot()).toMatchObject({ unsaved: false, status: { kind: "saved" } });
    expect(dexOf(server.stored)).toBe(16);
  });

  it("tells its listeners about every change", async () => {
    const { editor } = setUp();
    const listener = vi.fn();
    editor.subscribe(listener);
    editor.dispatch(dex(14));
    expect(listener).toHaveBeenCalled();
  });

  it("keeps someone else's change and mentions it", async () => {
    const { server, editor } = setUp();
    server.elsewhere({ type: "text", field: "species", value: "Elf" });
    editor.dispatch(dex(14));
    await vi.advanceTimersByTimeAsync(300);
    const { character, notices } = editor.getSnapshot();
    expect((character as PlayerCharacter).sheet.species).toBe("Elf");
    expect(notices.map((notice) => notice.text)).toEqual(["Updated with changes made elsewhere."]);
  });

  it("says when its change replaced someone else's newer value", async () => {
    const { server, editor } = setUp();
    server.elsewhere({ type: "number", field: "armourClass", value: 16 });
    editor.dispatch({ type: "number", field: "armourClass", value: 15, from: 10 });
    await vi.advanceTimersByTimeAsync(300);
    expect(editor.getSnapshot().notices[0].text).toBe(
      "Armour class had been changed to 16 elsewhere; yours (15) was kept.",
    );
  });

  it("says when changes were about something removed elsewhere", async () => {
    const { server, editor } = setUp(aCharacter({ items: [anItem({ id: "rope" })] }));
    server.elsewhere({ type: "inventory", change: { type: "remove", id: "rope" } });
    editor.dispatch({ type: "inventory", change: { type: "equip", id: "rope", equipped: true } });
    await vi.advanceTimersByTimeAsync(300);
    expect(editor.getSnapshot().notices.map((notice) => notice.text)).toContain(
      "Some changes were about things removed elsewhere, so they were left out.",
    );
    expect(editor.getSnapshot().character.inventory.items).toEqual([]);
  });

  it("keeps changes when offline and sends them again, with anything made since", async () => {
    const { server, editor } = setUp();
    server.failWith.push("offline");
    editor.dispatch(dex(14));
    await vi.advanceTimersByTimeAsync(300);
    expect(editor.getSnapshot().status).toMatchObject({ kind: "error", retrying: true });
    expect(dexOf(editor.getSnapshot().character)).toBe(14);

    editor.dispatch({ type: "ability", ability: "str", value: 8 });
    await vi.advanceTimersByTimeAsync(3000);
    expect(server.posts.at(-1)?.actions).toEqual([
      dex(14),
      { type: "ability", ability: "str", value: 8 },
    ]);
    expect(editor.getSnapshot().status).toEqual({ kind: "saved" });
  });

  it("lets go of a batch the server refuses, saying why", async () => {
    const { server, editor } = setUp();
    server.failWith.push(409);
    editor.dispatch(dex(14));
    await vi.advanceTimersByTimeAsync(300);
    expect(editor.getSnapshot()).toMatchObject({
      unsaved: false,
      status: { kind: "error", message: "Refused", retrying: false },
    });
    expect(dexOf(editor.getSnapshot().character)).toBe(10);
  });

  it("undoes and redoes, saving each", async () => {
    const { server, editor } = setUp();
    editor.dispatch(dex(14));
    await vi.advanceTimersByTimeAsync(300);
    expect(editor.getSnapshot().canUndo).toBe(true);

    editor.undo();
    await vi.advanceTimersByTimeAsync(300);
    expect(dexOf(server.stored)).toBe(10);
    expect(editor.getSnapshot()).toMatchObject({ canUndo: false, canRedo: true });

    editor.redo();
    await vi.advanceTimersByTimeAsync(300);
    expect(dexOf(server.stored)).toBe(14);
  });

  it("undoes a batch dispatched together as one step", () => {
    const { editor } = setUp();
    editor.dispatch(dex(14), { type: "ability", ability: "str", value: 8 });
    editor.undo();
    const sheet = (editor.getSnapshot().character as PlayerCharacter).sheet;
    expect([sheet.abilities.dex, sheet.abilities.str]).toEqual([10, 10]);
  });

  it("saves changes not worth undoing without adding an undo step", async () => {
    const { server, editor } = setUp(aCharacter({ items: [anItem({ id: "gift", unseen: true })] }));
    editor.dispatchWithoutUndo({ type: "inventory", change: { type: "seen", id: "gift" } });
    await vi.advanceTimersByTimeAsync(300);
    expect(server.stored.inventory.items[0].unseen).toBe(false);
    expect(editor.getSnapshot().canUndo).toBe(false);
  });

  it("picks up changes made elsewhere when refreshed, unless it has unsaved ones", async () => {
    const { server, editor } = setUp();
    server.elsewhere({ type: "damage", amount: 0 }, dex(18));
    await editor.refresh();
    expect(dexOf(editor.getSnapshot().character)).toBe(18);

    editor.dispatch({ type: "ability", ability: "str", value: 8 });
    server.elsewhere({ type: "ability", ability: "con", value: 16 });
    const gets = server.fetch.mock.calls.length;
    await editor.refresh();
    expect(server.fetch.mock.calls.length).toBe(gets);
  });

  describe("give", () => {
    const withArrows = () =>
      aCharacter({ items: [anItem({ id: "arrows", name: "Arrows", quantity: 20 })] });

    it("saves waiting changes first, then shows the bag the server sent back", async () => {
      const { server, editor } = setUp(withArrows());
      editor.dispatch(dex(14));
      const problem = await editor.give({ item: "arrows", amount: 5, to: "dog" });
      expect(problem).toBeUndefined();
      expect(server.posts).toHaveLength(1);
      expect(server.gifts).toEqual([{ item: "arrows", amount: 5, to: "dog" }]);
      const { character, canUndo } = editor.getSnapshot();
      expect(character.inventory.items[0].quantity).toBe(15);
      expect(dexOf(character)).toBe(14);
      // Undo still covers the change made before; the gift itself can't be undone.
      expect(canUndo).toBe(true);
    });

    it("says why when the gift can't be made", async () => {
      const { editor } = setUp(withArrows());
      expect(await editor.give({ item: "gone", amount: 1, to: "dog" })).toBe(
        "That item isn't there any more.",
      );
    });

    it("gives nothing while other changes are still waiting to reach the server", async () => {
      const { server, editor } = setUp(withArrows());
      server.failWith.push("offline");
      editor.dispatch(dex(14));
      expect(await editor.give({ item: "arrows", amount: 1, to: "dog" })).toMatch(
        /haven't saved yet, so nothing was given/,
      );
      expect(server.gifts).toEqual([]);
    });

    it("goes ahead once a change the server refused has been let go", async () => {
      const { server, editor } = setUp(withArrows());
      server.failWith.push(409);
      editor.dispatch(dex(14));
      expect(await editor.give({ item: "arrows", amount: 1, to: "dog" })).toBeUndefined();
      expect(server.gifts).toHaveLength(1);
    });
  });

  it("saves straight away when flushed", async () => {
    const { server, editor } = setUp();
    editor.dispatch(dex(14));
    editor.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.posts).toHaveLength(1);
  });

  it("stops saving once disposed", async () => {
    const { server, editor } = setUp();
    editor.dispatch(dex(14));
    editor.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(server.posts).toEqual([]);
  });
});
