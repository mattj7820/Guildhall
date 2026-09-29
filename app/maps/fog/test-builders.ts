/** Fog masks drawn as text for tests: `#` revealed, `.` hidden, one string per row. */
import type { FogMask } from "./types";

export function maskFrom(rows: string[]): FogMask {
  const cols = rows[0]?.length ?? 0;
  if (rows.some((row) => row.length !== cols)) throw new Error("Rows must be the same length");
  const cells = Uint8Array.from(rows.join(""), (cell) => (cell === "#" ? 1 : 0));
  return { cols, rows: rows.length, cells };
}

export function picture(mask: FogMask): string[] {
  return Array.from({ length: mask.rows }, (_, row) =>
    Array.from(mask.cells.subarray(row * mask.cols, (row + 1) * mask.cols), (cell) =>
      cell ? "#" : ".",
    ).join(""),
  );
}
