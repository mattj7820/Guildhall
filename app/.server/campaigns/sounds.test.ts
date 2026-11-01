import { describe, expect, it } from "vitest";
import type { Services } from "~/context";
import { soundsFolderOf } from "./sounds";

const services = (soundsFolder: string, folder?: string) =>
  ({ config: { soundsFolder }, vault: { folder } }) as unknown as Pick<
    Services,
    "config" | "vault"
  >;

describe("soundsFolderOf", () => {
  it("is the setting itself for the whole vault", () => {
    expect(soundsFolderOf(services("Sounds"))).toBe("Sounds");
  });

  it("is inside the campaign's folder, so each campaign has its own", () => {
    expect(soundsFolderOf(services("Sounds", "Fixture Campaign"))).toBe("Fixture Campaign/Sounds");
  });

  it("takes a setting that already names a path in the campaign as it is", () => {
    expect(soundsFolderOf(services("Fixture Campaign/Voices/", "Fixture Campaign"))).toBe(
      "Fixture Campaign/Voices",
    );
  });
});
