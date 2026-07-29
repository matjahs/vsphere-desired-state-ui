/** Decode a JSON Pointer segment (~0 / ~1). */
function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

/** Split `/a/b/c` into decoded path segments. */
export function splitJsonPointer(pointer: string): string[] {
  if (!pointer || pointer === "/") return [];
  return pointer
    .split("/")
    .slice(1)
    .map(decodePointerSegment);
}

/** Extract JSON Pointer from an AJV-style error string `/path: message`. */
export function pointerFromValidationError(error: string): string | null {
  const colon = error.indexOf(": ");
  if (colon <= 0) return null;
  const path = error.slice(0, colon).trim();
  if (!path.startsWith("/")) return null;
  return path;
}

export interface TextPosition {
  line: number;
  column: number;
  /** Absolute character offset of the match start */
  offset: number;
  /** Length of the matched key token including quotes, e.g. `"block_devices"` */
  length: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function offsetToPosition(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

/**
 * Locate a JSON Pointer in pretty-printed JSON text by walking key segments.
 * Returns the position of the final key (or array index token).
 */
export function locateJsonPointer(
  text: string,
  pointer: string,
): TextPosition | null {
  const parts = splitJsonPointer(pointer);
  if (parts.length === 0) {
    return { line: 1, column: 1, offset: 0, length: 1 };
  }

  let searchFrom = 0;
  let lastOffset = 0;
  let lastLength = 0;

  for (const part of parts) {
    const isIndex = /^\d+$/.test(part);
    if (isIndex) {
      // Array index: advance into the array value region; best-effort locate nth element
      const slice = text.slice(searchFrom);
      // Find opening `[` of the array after the previous key
      const bracket = slice.indexOf("[");
      if (bracket < 0) return null;
      let depth = 0;
      let i = bracket;
      let element = -1;
      let elementStart = -1;
      while (i < slice.length) {
        const ch = slice[i];
        if (ch === "[") {
          depth += 1;
          if (depth === 1) {
            // start scanning elements after this bracket
          }
        } else if (ch === "]") {
          depth -= 1;
          if (depth === 0) break;
        } else if (depth === 1 && (ch === "{" || ch === "[" || ch === '"' || /[0-9n-tf]/.test(ch))) {
          // start of an element (object, array, string, number, null/true/false)
          // Only count when we're at element boundary: after `[` or `,`
          let j = i - 1;
          while (j > bracket && /\s/.test(slice[j])) j -= 1;
          if (slice[j] === "[" || slice[j] === ",") {
            element += 1;
            if (element === Number(part)) {
              elementStart = searchFrom + i;
              break;
            }
          }
        }
        i += 1;
      }
      if (elementStart < 0) return null;
      lastOffset = elementStart;
      lastLength = 1;
      searchFrom = elementStart;
      continue;
    }

    const keyPattern = new RegExp(`"${escapeRegExp(part)}"\\s*:`);
    const slice = text.slice(searchFrom);
    const match = keyPattern.exec(slice);
    if (!match) return null;
    lastOffset = searchFrom + match.index;
    lastLength = match[0].length;
    searchFrom = lastOffset + lastLength;
  }

  const { line, column } = offsetToPosition(text, lastOffset);
  return { line, column, offset: lastOffset, length: lastLength };
}