import { describe, expect, it, vi } from "vitest";
import { cookieSettings, createSessions } from "./sessions";

const settings = (secrets: string[], secure = false) => ({ secrets, secure });

/** Signs a session in with these settings, and answers with the cookie it sets. */
async function signedCookie(secrets: string[], secure = false) {
  const sessions = createSessions(settings(secrets, secure));
  const session = await sessions.getSession();
  session.set("discordId", "123");
  session.set("sessionKey", "key");
  session.set("issuedAt", 1);
  return (await sessions.commitSession(session)).split(";")[0];
}

describe("cookieSettings", () => {
  it("sends cookies over HTTPS only when Guildhall is served over HTTPS", () => {
    const base = { sessionSecrets: ["s"] };
    expect(cookieSettings({ ...base, publicUrl: "https://guildhall.example" }).secure).toBe(true);
    expect(cookieSettings({ ...base, publicUrl: "http://localhost:3000" }).secure).toBe(false);
  });

  it("makes a random secret, and says so, when none is set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const local = { publicUrl: "http://localhost:3000", sessionSecrets: undefined };
    const first = cookieSettings(local).secrets;
    expect(first).toHaveLength(1);
    expect(first[0].length).toBeGreaterThanOrEqual(32);
    expect(cookieSettings(local).secrets).not.toEqual(first);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("createSessions", () => {
  it("reads back the session it signed", async () => {
    const sessions = createSessions(settings(["secret"]));
    const session = await sessions.getSession(await signedCookie(["secret"]));
    expect(session.get("discordId")).toBe("123");
    expect(session.get("sessionKey")).toBe("key");
  });

  it("ignores a cookie that's been tampered with or signed with another secret", async () => {
    const sessions = createSessions(settings(["secret"]));
    const cookie = await signedCookie(["secret"]);
    const [name, value] = cookie.split("=");
    const [payload, signature] = decodeURIComponent(value).split(".");
    const edited = `${name}=${encodeURIComponent(`${payload}x.${signature}`)}`;

    for (const forged of [edited, await signedCookie(["someone else's"])]) {
      expect((await sessions.getSession(forged)).get("discordId")).toBeUndefined();
    }
  });

  it("still reads cookies signed with an older secret, so a secret can be rotated", async () => {
    const old = await signedCookie(["old"]);
    const rotated = createSessions(settings(["new", "old"]));
    expect((await rotated.getSession(old)).get("discordId")).toBe("123");
  });

  it("names a secure cookie with the __Host- prefix, for this host only", async () => {
    expect(await signedCookie(["s"], true)).toMatch(/^__Host-guildhall=/);
    expect(await signedCookie(["s"], false)).toMatch(/^guildhall-session=/);
  });
});
