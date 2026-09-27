import { createHash } from "node:crypto";
import type { DiscordProfile } from "~/members/types";

/**
 * Dev sign-in: pretend Discord accounts for local development and end-to-end tests. Config only
 * allows it when PUBLIC_URL is this computer, and each sign-in must come from this computer too.
 */

/** A made-up Discord ID, the same every time for the same name, so members are stable. */
export function devDiscordId(name: string): string {
  const digits = BigInt(`0x${createHash("sha256").update(name).digest("hex").slice(0, 15)}`);
  return `9${digits.toString().padStart(18, "0").slice(0, 18)}`;
}

export const DEV_DM: DiscordProfile = {
  discordId: devDiscordId("dev dm"),
  username: "dev-dm",
  name: "Dev DM",
};

export function devProfile(name: string): DiscordProfile {
  return {
    discordId: devDiscordId(name.toLowerCase()),
    username: `dev-${name.toLowerCase().replace(/\W+/g, "-")}`,
    name,
  };
}

/** Whether a connection comes from this computer (IPv4, IPv6, or IPv4 written as IPv6). */
export function isLoopback(address: string | undefined): boolean {
  return address === "::1" || /^(::ffff:)?127\./.test(address ?? "");
}
