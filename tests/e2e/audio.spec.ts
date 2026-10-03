import { expect, test } from "./support/fixtures";

test.describe("Audio embeds", () => {
  const url = "/vault-asset/Attachments/voice-sample.wav";

  test("play inline instead of downloading", async ({ wiki }) => {
    await wiki.openNote("NPCs/Mira Stonehand");
    const player = wiki.noteBody.locator('audio[aria-label="voice-sample.wav"]');

    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute("controls");
    // The browser could read the file: its duration is known once metadata loads.
    await expect
      .poll(() => player.evaluate((audio: HTMLAudioElement) => audio.duration))
      .toBeGreaterThan(0);
  });

  test("are served as audio, with range requests for seeking", async ({ request }) => {
    const whole = await request.get(url);
    expect(whole.status()).toBe(200);
    expect(whole.headers()["content-type"]).toBe("audio/wav");
    expect(whole.headers()["accept-ranges"]).toBe("bytes");

    const part = await request.get(url, { headers: { Range: "bytes=0-99" } });
    expect(part.status()).toBe(206);
    expect(part.headers()["content-range"]).toMatch(/^bytes 0-99\/\d+$/);
    expect((await part.body()).length).toBe(100);
  });
});
