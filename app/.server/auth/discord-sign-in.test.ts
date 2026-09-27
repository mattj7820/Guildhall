import { describe, expect, it } from "vitest";
import { checkCallback, createAttemptCookie, newAttempt } from "./discord-sign-in";

const attempt = { state: "abc123", redirectTo: "/wiki/Home" };
const params = (query: string) => new URLSearchParams(query);

describe("checkCallback", () => {
  it("accepts Discord's answer to this browser's own attempt", () => {
    expect(checkCallback(params("code=xyz&state=abc123"), attempt)).toEqual({
      code: "xyz",
      redirectTo: "/wiki/Home",
    });
  });

  it("notices when they cancelled at Discord", () => {
    expect(checkCallback(params("error=access_denied&state=abc123"), attempt)).toEqual({
      problem: "cancelled",
    });
  });

  it.each([
    ["a different state (someone else's sign-in)", "code=xyz&state=other", attempt],
    ["no attempt remembered (expired, or another browser)", "code=xyz&state=abc123", null],
    ["no code", "state=abc123", attempt],
    ["no state", "code=xyz", attempt],
  ])("refuses %s", (_name, query, stored) => {
    expect(checkCallback(params(query), stored)).toEqual({ problem: "expired" });
  });
});

describe("sign-in attempts", () => {
  it("are unguessable and different every time", () => {
    const first = newAttempt("/");
    expect(first.state).toMatch(/^[\w-]{22}$/);
    expect(newAttempt("/").state).not.toBe(first.state);
  });

  it("round-trip through a signed cookie, and a tampered one is ignored", async () => {
    const cookie = createAttemptCookie({ secrets: ["s".repeat(32)], secure: true });
    const header = await cookie.serialize(attempt);
    expect(header).toMatch(/Path=\/auth/);
    expect(header).toMatch(/Secure/);
    expect(await cookie.parse(header.split(";")[0])).toEqual(attempt);

    const other = createAttemptCookie({ secrets: ["t".repeat(32)], secure: true });
    expect(await other.parse(header.split(";")[0])).toBeNull();
  });
});
