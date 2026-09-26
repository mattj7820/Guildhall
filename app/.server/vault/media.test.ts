import { describe, expect, it } from "vitest";
import { contentType, mediaKind } from "./media";

describe("media types", () => {
  it.each([
    ["Voices/Venger.m4a", "audio/mp4", "audio"],
    ["Recording 20260926.webm", "audio/webm", "audio"],
    ["clip.MP3", "audio/mpeg", "audio"],
    ["map.png", "image/png", "image"],
    ["handout.pdf", "application/pdf", "other"],
    ["notes.xyz", "application/octet-stream", "other"],
    ["no-extension", "application/octet-stream", "other"],
  ])("%s is served as %s (%s)", (file, type, kind) => {
    expect(contentType(file)).toBe(type);
    expect(mediaKind(file)).toBe(kind);
  });
});
