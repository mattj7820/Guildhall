import { expect, test } from "@playwright/test";
import { SIGNED_IN, SIGNED_OUT } from "./support/sign-in";

/**
 * The DM's sound board: audio in the vault's Sounds folder (the fixture's "Fixture Tone.wav"),
 * which players may have too, and nothing else in the vault that way.
 */
test.describe("Sounds", () => {
  test.use({ storageState: SIGNED_IN.playerOne });

  test("players get audio from the sounds folder, and nothing else that way", async ({
    request,
  }) => {
    const tone = await request.get("/sounds/Fixture%20Tone.wav");
    expect(tone.status()).toBe(200);
    expect(tone.headers()["content-type"]).toBe("audio/wav");

    for (const path of [
      "/sounds/Fixture%20Sounds.md",
      "/sounds/Missing.wav",
      "/sounds/..%2FAttachments%2Fvoice-sample.wav",
    ]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });
});

test.describe("Sounds, signed out", () => {
  test.use({ storageState: SIGNED_OUT });

  test("need signing in", async ({ request }) => {
    const response = await request.get("/sounds/Fixture%20Tone.wav", { maxRedirects: 0 });
    expect(response.status()).not.toBe(200);
  });
});
