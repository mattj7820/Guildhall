import type { AddressInfo } from "node:net";
import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { prepareApp } from "./http";

let close: (() => void) | undefined;
afterEach(() => close?.());

/** Serves a prepared app on a free port, with a route that reports what it saw. */
async function serve(trustProxy: number): Promise<string> {
  const app = express();
  prepareApp(app, { trustProxy });
  app.get("/seen", (req, res) => {
    res.json({ protocol: req.protocol, host: req.host });
  });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  close = () => server.close();
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const forwarded = { "X-Forwarded-Proto": "https", "X-Forwarded-Host": "guildhall.example.com" };

describe("prepareApp", () => {
  it("believes the proxy about HTTPS and the host when told there is one", async () => {
    const base = await serve(1);
    const seen = await (await fetch(`${base}/seen`, { headers: forwarded })).json();
    expect(seen).toEqual({ protocol: "https", host: "guildhall.example.com" });
  });

  it("ignores forwarded headers when there's no proxy, since anyone could send them", async () => {
    const base = await serve(0);
    const seen = await (await fetch(`${base}/seen`, { headers: forwarded })).json();
    expect(seen.protocol).toBe("http");
    expect(seen.host).not.toBe("guildhall.example.com");
  });

  it("answers the health check", async () => {
    const response = await fetch(`${await serve(0)}/healthz`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("sends security headers on every response", async () => {
    const response = await fetch(`${await serve(0)}/seen`);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("same-origin");
  });
});
