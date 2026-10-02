import { describe, expect, it } from "vitest";
import { DEFAULT_STUNT_SETTINGS, readStuntSettings } from "./stunt-settings";

describe("readStuntSettings", () => {
  it("has everything on at the usual volume until someone changes it", () => {
    expect(readStuntSettings(null)).toEqual(DEFAULT_STUNT_SETTINGS);
  });

  it("reads saved settings, keeping the volume between silent and full", () => {
    expect(readStuntSettings('{"effects":false,"sound":false,"volume":0.3}')).toEqual({
      effects: false,
      sound: false,
      volume: 0.3,
    });
    expect(readStuntSettings('{"volume":4}').volume).toBe(1);
    expect(readStuntSettings('{"volume":-1}').volume).toBe(0);
  });

  it("falls back to the defaults for anything missing or damaged", () => {
    expect(readStuntSettings('{"effects":"no"}')).toEqual(DEFAULT_STUNT_SETTINGS);
    expect(readStuntSettings("not json")).toEqual(DEFAULT_STUNT_SETTINGS);
  });
});
