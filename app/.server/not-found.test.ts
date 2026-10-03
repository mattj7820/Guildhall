import { describe, expect, it } from "vitest";
import { DM_VIEWER, PLAYER_VIEWER } from "~/campaign/types";
import { notFound, requireDm } from "./not-found";

/** What a helper threw, as React Router will answer it. */
function thrown(run: () => void) {
  try {
    run();
  } catch (error) {
    return error as { type?: string; data?: unknown; init?: ResponseInit };
  }
  return undefined;
}

describe("notFound", () => {
  it("ends the request with a 404 and the message", () => {
    expect(thrown(() => notFound("Map not found"))).toMatchObject({
      data: "Map not found",
      init: { status: 404 },
    });
  });
});

describe("requireDm", () => {
  it("lets the DM through", () => {
    expect(thrown(() => requireDm(DM_VIEWER))).toBeUndefined();
  });

  it("gives anyone else the same 404 as something missing", () => {
    expect(thrown(() => requireDm(PLAYER_VIEWER))).toEqual(thrown(() => notFound()));
  });
});
