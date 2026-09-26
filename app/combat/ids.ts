/**
 * A random ID. Uses getRandomValues rather than randomUUID, which browsers only offer on HTTPS
 * or localhost, so the tracker still works when opened by LAN address from another device.
 */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
