/** An inclusive byte range within a file, as requested by an HTTP `Range` header. */
export interface ByteRange {
  start: number;
  end: number;
}

/**
 * Parses a single-range `Range: bytes=…` header. Browsers use these to stream and seek audio.
 * Returns undefined when there is no usable header (serve the whole file), or "unsatisfiable"
 * when the range lies outside the file (respond 416).
 *
 * Multi-range requests (`bytes=0-1,5-6`) aren't needed for media and are served as a whole file.
 */
export function parseByteRange(
  header: string | null,
  size: number,
): ByteRange | "unsatisfiable" | undefined {
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!match || (match[1] === "" && match[2] === "")) return undefined;

  let start: number;
  let end: number;
  if (match[1] === "") {
    // Suffix range: the last N bytes.
    const length = Number(match[2]);
    if (length === 0) return "unsatisfiable";
    start = Math.max(0, size - length);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }

  return start >= size || start > end ? "unsatisfiable" : { start, end };
}
