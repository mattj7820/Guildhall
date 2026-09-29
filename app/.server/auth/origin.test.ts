import { describe, expect, it } from "vitest";
import { isOwnSocketOrigin, isSameOrigin } from "./origin";

const hosted = { publicUrl: "https://guildhall.example.com", publicUrlIsSet: true };
const local = { publicUrl: "http://localhost:3000", publicUrlIsSet: false };

const post = (url: string, origin?: string) =>
  new Request(url, { method: "POST", headers: origin ? { Origin: origin } : {} });

describe("isSameOrigin", () => {
  it("lets reading requests through without checking", () => {
    expect(isSameOrigin(new Request("https://guildhall.example.com/wiki"), hosted)).toBe(true);
  });

  it("accepts a post from Guildhall's own address", () => {
    const request = post("https://guildhall.example.com/logout", "https://guildhall.example.com");
    expect(isSameOrigin(request, hosted)).toBe(true);
  });

  it.each([
    ["another site", "https://evil.example.net"],
    ["another subdomain of the same site", "https://other.example.com"],
    ["plain HTTP", "http://guildhall.example.com"],
    ["no Origin at all", undefined],
  ])("refuses a post from %s", (_name, origin) => {
    expect(isSameOrigin(post("https://guildhall.example.com/logout", origin), hosted)).toBe(false);
  });

  it("accepts the request's own address until PUBLIC_URL is set, so LAN addresses work", () => {
    expect(
      isSameOrigin(post("http://192.168.1.20:3000/logout", "http://192.168.1.20:3000"), local),
    ).toBe(true);
    expect(isSameOrigin(post("http://192.168.1.20:3000/logout", "http://evil.test"), local)).toBe(
      false,
    );
  });
});

describe("isOwnSocketOrigin", () => {
  const opening = (url: string, origin?: string) =>
    new Request(url, { headers: origin ? { Origin: origin } : {} });

  it("accepts a connection opened by Guildhall's own pages", () => {
    const request = opening("https://guildhall.example.com/live", "https://guildhall.example.com");
    expect(isOwnSocketOrigin(request, hosted)).toBe(true);
  });

  it.each([
    ["another site", "https://evil.example.net"],
    ["another subdomain of the same site", "https://other.example.com"],
    ["no Origin at all", undefined],
  ])("refuses one from %s, although opening a connection is a GET", (_name, origin) => {
    expect(isOwnSocketOrigin(opening("https://guildhall.example.com/live", origin), hosted)).toBe(
      false,
    );
  });

  it("accepts the request's own address until PUBLIC_URL is set", () => {
    const request = opening("http://192.168.1.20:3000/live", "http://192.168.1.20:3000");
    expect(isOwnSocketOrigin(request, local)).toBe(true);
  });
});
