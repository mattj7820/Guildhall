import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readJson } from "./read-json";

const post = (body: string) =>
  new Request("http://localhost/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
const schema = z.object({ intent: z.literal("save"), name: z.string() });

describe("readJson", () => {
  it("gives the body when it matches", async () => {
    const result = await readJson(post('{"intent":"save","name":"Keep"}'), schema);
    expect(result).toEqual({ success: true, data: { intent: "save", name: "Keep" } });
  });

  it.each([
    ["a body that doesn't match", '{"intent":"save"}'],
    ["null", "null"],
    ["something that isn't JSON", "{not json"],
    ["nothing", ""],
  ])("fails, without throwing, for %s", async (_, body) => {
    expect((await readJson(post(body), schema)).success).toBe(false);
  });
});
